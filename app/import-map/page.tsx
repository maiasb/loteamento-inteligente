'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const API_URL = '/api';

interface ImportResult {
  mapId: string;
  mapName: string;
  totalBlocks: number;
  totalLots: number;
}

interface UploadImageResult {
  message: string;
  mapId: string;
  imageType: string;
  width: number;
  height: number;
}

export default function ImportMapPage() {
  const router = useRouter();
  const [jsonContent, setJsonContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<ImportResult | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Limpar estados anteriores
    setExcelFile(null);
    setJsonContent('');
    setError('');
    setSuccess(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Processar planilha
      const jsonData = processExcelToJson(workbook);
      const jsonString = JSON.stringify(jsonData, null, 2);
      
      // Atualizar estados com os novos dados
      setJsonContent(jsonString);
      setExcelFile(file);
    } catch (err) {
      console.error('[ImportMap] ❌ Erro ao processar Excel:', err);
      setError('Erro ao processar arquivo Excel. Verifique o formato e tente novamente.');
      setExcelFile(null);
      setJsonContent('');
    }
  };

  const processExcelToJson = (workbook: XLSX.WorkBook) => {
    const result: any = {
      name: '',
      blocks: []
    };

    // Ler dados da primeira planilha (Info)
    const infoSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (infoSheet) {
      const infoData = XLSX.utils.sheet_to_json(infoSheet, { header: 1 }) as any[][];
      
      // Buscar nome do mapa
      for (const row of infoData) {
        if (row[0] === 'Nome do Loteamento' && row[1]) {
          result.name = row[1];
          break;
        }
      }
    }

    // Processar demais planilhas como quadras
    for (let i = 1; i < workbook.SheetNames.length; i++) {
      const sheetName = workbook.SheetNames[i];
      const sheet = workbook.Sheets[sheetName];
      
      const data = XLSX.utils.sheet_to_json(sheet) as any[];
      
      if (data.length > 0) {
        const block: any = {
          name: sheetName,
          description: '',
          lots: []
        };

        for (const row of data) {
          // Mapear colunas do Excel para propriedades do lote
          const lot: any = {
            lotNumber: String(row['Número'] || row['Lote'] || row['lotNumber'] || '').trim(),
            status: normalizeStatus(row['Status'] || row['status'] || 'available'),
            price: parseFloat(String(row['Preço'] || row['Preco'] || row['price'] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')),
            size: parseFloat(String(row['Área'] || row['Area'] || row['Tamanho'] || row['size'] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')),
            description: row['Descrição'] || row['Descricao'] || row['description'] || '',
            features: []
          };

          // Processar características
          const features = row['Características'] || row['Caracteristicas'] || row['features'] || '';
          if (features) {
            lot.features = String(features).split(',').map((f: string) => f.trim()).filter(Boolean);
          }

          // Processar reserva se o lote estiver reservado ou vendido
          if (lot.status === 'reserved' || lot.status === 'sold') {
            const reservation: any = {
              customer_name: row['Cliente'] || row['customer_name'] || '',
              customer_email: row['Email'] || row['customer_email'] || '',
              customer_phone: row['Telefone'] || row['customer_phone'] || '',
              customer_cpf: row['CPF'] || row['customer_cpf'] || '',
              customer_address: row['Endereço'] || row['Endereco'] || row['customer_address'] || '',
              payment_method: normalizePaymentMethod(row['Pagamento'] || row['payment_method'] || 'cash'),
              status: lot.status === 'sold' ? 'completed' : 'approved',
              notes: row['Observações'] || row['Observacoes'] || row['notes'] || ''
            };

            // Só adicionar reserva se tiver ao menos nome e telefone
            if (reservation.customer_name && reservation.customer_phone) {
              lot.reservation = reservation;
            }
          }

          if (lot.lotNumber) {
            block.lots.push(lot);
          }
        }

        if (block.lots.length > 0) {
          result.blocks.push(block);
        }
      }
    }

    return result;
  };

  const normalizeStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'disponivel': 'available',
      'disponível': 'available',
      'livre': 'available',
      'available': 'available',
      'reservado': 'reserved',
      'reserved': 'reserved',
      'vendido': 'sold',
      'sold': 'sold',
      'bloqueado': 'blocked',
      'blocked': 'blocked'
    };
    return statusMap[status.toLowerCase()] || 'available';
  };

  const normalizePaymentMethod = (method: string): string => {
    const methodMap: { [key: string]: string } = {
      'dinheiro': 'cash',
      'à vista': 'cash',
      'avista': 'cash',
      'cash': 'cash',
      'financiamento': 'financing',
      'financing': 'financing',
      'parcelado': 'installments',
      'parcelas': 'installments',
      'installments': 'installments'
    };
    return methodMap[method.toLowerCase()] || 'cash';
  };

  const handleImport = async () => {
    if (!jsonContent.trim()) {
      setError('Por favor, selecione um arquivo JSON ou cole o conteúdo');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess(null);

    try {
      // Validar JSON
      let data;
      try {
        data = JSON.parse(jsonContent);
      } catch (e) {
        setError('JSON inválido. Verifique a sintaxe do arquivo.');
        setIsUploading(false);
        return;
      }

      // Enviar para API
      const response = await axios.post(`${API_URL}/mapas/importar`, data, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      setSuccess(response.data);
      setJsonContent('');
      
      // Mostrar mensagem de sucesso
      alert(`✅ Loteamento importado com sucesso!\n\nO loteamento foi cadastrado e está disponível para visualização.`);
    } catch (err: any) {
      console.error('[ImportMap] ❌ Erro na importação:', err);

      if (axios.isAxiosError(err) && err.response) {
        const errorMessage = err.response.data?.message || err.response.data?.error;
        setError(errorMessage || 'Erro ao importar dados');
      } else {
        setError('Erro ao processar arquivo. Verifique o formato e tente novamente.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo (imagem ou PDF)
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      setError('Por favor, selecione uma imagem (JPG, PNG, GIF) ou um arquivo PDF');
      return;
    }

    // Validar tamanho (máximo 50MB para PDF, 10MB para imagem)
    const maxSize = isPDF ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`O arquivo deve ter no máximo ${isPDF ? '50MB' : '10MB'}`);
      return;
    }

    setImageFile(file);
    
    // Criar preview (apenas para imagens)
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // Para PDF, mostrar ícone
      setImagePreview('PDF');
    }
    setError('');
  };

  const handleDownloadTemplate = () => {
    // Criar workbook
    const wb = XLSX.utils.book_new();

    // Aba Info
    const infoData = [
      ['Nome do Loteamento', 'Meu Loteamento - Exemplo']
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
    infoSheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, infoSheet, 'Info');

    // Aba Quadra A - 10 lotes disponíveis
    const quadraAData = [
      ['Número', 'Status', 'Preço', 'Área', 'Descrição', 'Características'],
      ['1', 'disponível', 'R$ 150.000,00', '300', 'Lote de esquina', 'Esquina, Próximo à entrada'],
      ['2', 'disponível', 'R$ 145.000,00', '280', 'Lote plano', 'Plano, Arborizado'],
      ['3', 'disponível', 'R$ 140.000,00', '275', '', 'Vista privilegiada'],
      ['4', 'disponível', 'R$ 148.000,00', '290', 'Lote amplo', 'Amplo, Ventilado'],
      ['5', 'disponível', 'R$ 142.000,00', '285', '', 'Acesso pavimentado'],
      ['6', 'disponível', 'R$ 155.000,00', '320', 'Lote premium', 'Premium, Vista panorâmica'],
      ['7', 'disponível', 'R$ 138.000,00', '270', '', 'Próximo ao parque'],
      ['8', 'disponível', 'R$ 147.000,00', '295', 'Lote ensolarado', 'Ensolarado, Ventilado'],
      ['9', 'disponível', 'R$ 143.000,00', '282', '', 'Infraestrutura completa'],
      ['10', 'disponível', 'R$ 152.000,00', '310', 'Lote de frente', 'Frente, Localização privilegiada']
    ];
    const quadraASheet = XLSX.utils.aoa_to_sheet(quadraAData);
    quadraASheet['!cols'] = [
      { wch: 10 }, // Número
      { wch: 12 }, // Status
      { wch: 15 }, // Preço
      { wch: 10 }, // Área
      { wch: 25 }, // Descrição
      { wch: 35 }  // Características
    ];
    XLSX.utils.book_append_sheet(wb, quadraASheet, 'Quadra A');

    // Aba Quadra B - 8 lotes disponíveis
    const quadraBData = [
      ['Número', 'Status', 'Preço', 'Área', 'Descrição', 'Características'],
      ['1', 'disponível', 'R$ 135.000,00', '260', '', 'Tranquilo, Arborizado'],
      ['2', 'disponível', 'R$ 132.000,00', '255', 'Lote compacto', 'Compacto, Bem localizado'],
      ['3', 'disponível', 'R$ 138.000,00', '270', '', 'Próximo à área verde'],
      ['4', 'disponível', 'R$ 140.000,00', '275', 'Lote plano', 'Plano, Fácil acesso'],
      ['5', 'disponível', 'R$ 145.000,00', '285', '', 'Localização estratégica'],
      ['6', 'disponível', 'R$ 136.000,00', '265', 'Bom custo-benefício', 'Econômico, Infraestrutura'],
      ['7', 'disponível', 'R$ 142.000,00', '280', '', 'Vista agradável'],
      ['8', 'disponível', 'R$ 148.000,00', '295', 'Lote amplo', 'Amplo, Ensolarado']
    ];
    const quadraBSheet = XLSX.utils.aoa_to_sheet(quadraBData);
    quadraBSheet['!cols'] = [
      { wch: 10 }, // Número
      { wch: 12 }, // Status
      { wch: 15 }, // Preço
      { wch: 10 }, // Área
      { wch: 25 }, // Descrição
      { wch: 35 }  // Características
    ];
    XLSX.utils.book_append_sheet(wb, quadraBSheet, 'Quadra B');

    // Aba Instruções
    const instrucoesData = [
      ['COMO USAR ESTA PLANILHA'],
      [''],
      ['1. ESTRUTURA BÁSICA'],
      ['- Aba "Info": Contém o nome do loteamento'],
      ['- Demais abas: Uma aba para cada quadra do loteamento'],
      [''],
      ['2. COLUNAS OBRIGATÓRIAS PARA CADA LOTE'],
      ['- Número: Número identificador do lote'],
      ['- Status: disponível, reservado, vendido ou bloqueado'],
      ['- Preço: Valor do lote (pode usar formatação de moeda)'],
      ['- Área: Tamanho do lote em m²'],
      [''],
      ['3. COLUNAS OPCIONAIS'],
      ['- Descrição: Texto descritivo sobre o lote'],
      ['- Características: Lista separada por vírgulas (ex: "Esquina, Vista privilegiada")'],
      [''],
      ['4. PARA LOTES RESERVADOS OU VENDIDOS'],
      ['Adicione estas colunas extras:'],
      ['- Cliente: Nome do cliente'],
      ['- Email: Email do cliente'],
      ['- Telefone: Telefone com DDD'],
      ['- CPF: CPF do cliente (opcional)'],
      ['- Endereço: Endereço completo (opcional)'],
      ['- Pagamento: dinheiro, financiamento ou parcelado'],
      ['- Observações: Notas adicionais (opcional)'],
      [''],
      ['5. DICAS IMPORTANTES'],
      ['- Você pode criar quantas quadras quiser (uma aba por quadra)'],
      ['- O nome da aba será o nome da quadra no sistema'],
      ['- Certifique-se de que cada lote tenha um número único dentro da sua quadra'],
      ['- Os preços podem estar formatados como moeda (R$ 150.000,00) ou números simples'],
      ['- As características devem ser separadas por vírgulas'],
      [''],
      ['6. EXEMPLO DE USO'],
      ['Esta planilha já contém exemplos prontos nas abas "Quadra A" e "Quadra B".'],
      ['Você pode:'],
      ['- Editar os dados de exemplo'],
      ['- Adicionar novas quadras (criar novas abas)'],
      ['- Remover as quadras de exemplo'],
      [''],
      ['Após preencher, salve e faça o upload na página de importação!']
    ];
    const instrucoesSheet = XLSX.utils.aoa_to_sheet(instrucoesData);
    instrucoesSheet['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, instrucoesSheet, 'Instruções');

    // Gerar arquivo e fazer download
    XLSX.writeFile(wb, 'template-importacao-loteamento.xlsx');
  };

  const handleUploadImage = async () => {
    if (!imageFile || !success) return;

    setIsUploadingImage(true);
    setError('');

    try {
      const isPDF = imageFile.type === 'application/pdf';
      
      // Converter arquivo para base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;

        try {
          if (isPDF) {
            // Para PDF, enviar direto sem verificar dimensões
            const response = await axios.post(`${API_URL}/mapas/atualizar-imagem`, {
              mapId: success.mapId,
              imageUrl: base64Data,
              width: 800,  // Valor padrão para PDFs
              height: 600, // Valor padrão para PDFs
            }, {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 120000,
            });

            setImageUploaded(true);
            setIsUploadingImage(false);
          } else {
            // Para imagem, obter dimensões
            const img = new Image();
            img.onload = async () => {
              const width = img.width;
              const height = img.height;

              const response = await axios.post(`${API_URL}/mapas/atualizar-imagem`, {
                mapId: success.mapId,
                imageUrl: base64Data,
                width,
                height,
              }, {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 30000,
              });

              setImageUploaded(true);
              setIsUploadingImage(false);
            };
            img.onerror = () => {
              setError('Erro ao processar imagem');
              setIsUploadingImage(false);
            };
            img.src = base64Data;
          }
        } catch (err: any) {
          console.error('[ImportMap] ❌ Erro ao enviar arquivo:', err);
          setError(err.response?.data?.error || 'Erro ao fazer upload do arquivo');
          setIsUploadingImage(false);
        }
      };
      reader.onerror = () => {
        setError('Erro ao ler arquivo');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      console.error('[ImportMap] ❌ Erro:', err);
      setError('Erro ao processar arquivo');
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Importar Loteamento</h1>
        <p className="text-[var(--foreground)] opacity-70">
          Faça upload de um arquivo JSON com os dados do mapa, quadras e lotes
        </p>
      </div>

      {/* Card de sucesso */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-[var(--foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-300 mb-2">Importação Concluída!</h3>
              <p className="text-green-200 mb-4">O loteamento foi criado com sucesso.</p>
              <div className="bg-green-900/30 rounded-lg p-4 space-y-2 text-green-100">
                <p><span className="font-semibold">Mapa:</span> {success.mapName}</p>
                <p><span className="font-semibold">ID:</span> {success.mapId}</p>
                <p><span className="font-semibold">Quadras criadas:</span> {success.totalBlocks}</p>
                <p><span className="font-semibold">Lotes criados:</span> {success.totalLots}</p>
              </div>

              {/* Upload de imagem após importação */}
              {!imageUploaded && (
                <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
                  <h4 className="text-blue-300 font-semibold mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Adicionar Imagem ou PDF (Opcional)
                  </h4>
                  <p className="text-blue-200 text-sm mb-3">
                    Faça upload de uma imagem ou PDF do mapa do loteamento
                  </p>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleImageSelect}
                      disabled={isUploadingImage}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-[var(--foreground)] text-sm cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-500 file:text-[var(--foreground)] file:text-sm file:font-semibold hover:file:bg-blue-600 transition-colors disabled:opacity-50"
                    />
                    {imagePreview && (
                      <div className="relative">
                        {imagePreview === 'PDF' ? (
                          <div className="w-full h-40 bg-gray-900 rounded-lg flex flex-col items-center justify-center border border-gray-700">
                            <svg className="w-16 h-16 text-red-400 mb-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <p className="text-[var(--foreground)] font-semibold">{imageFile?.name}</p>
                            <p className="text-gray-400 text-sm">Arquivo PDF selecionado</p>
                          </div>
                        ) : (
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full max-h-64 object-contain bg-gray-900 rounded-lg"
                          />
                        )}
                      </div>
                    )}
                    {imageFile && !isUploadingImage && (
                      <button
                        onClick={handleUploadImage}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-[var(--foreground)] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Fazer Upload da Imagem
                      </button>
                    )}
                    {isUploadingImage && (
                      <div className="flex items-center justify-center gap-2 text-blue-300">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Enviando arquivo...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {imageUploaded && (
                <div className="mt-4 p-4 bg-green-900/30 rounded-lg border border-green-500/30">
                  <p className="text-green-300 font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Arquivo adicionado com sucesso!
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => router.push(`/map-details?mapId=${success.mapId}`)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-[var(--foreground)] rounded-lg font-semibold transition-colors"
                >
                  Ver Mapa
                </button>
                <button
                  onClick={() => {
                    setSuccess(null);
                    setJsonContent('');
                    setImageFile(null);
                    setImagePreview('');
                    setImageUploaded(false);
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-[var(--foreground)] rounded-lg font-semibold transition-colors"
                >
                  Importar Outro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card de erro */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-red-300 font-semibold">Erro na Importação</p>
            <p className="text-red-200 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Card de instruções */}
      <div className="bg-[var(--card-bg)] rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Como Usar</h2>
        <ol className="space-y-2 text-[var(--foreground)] opacity-80">
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">1</span>
            <span>Baixe a planilha modelo clicando no botão abaixo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">2</span>
            <span>Edite a planilha com os dados do seu loteamento</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">3</span>
            <span>Faça upload do arquivo Excel abaixo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">4</span>
            <span>Revise o JSON gerado e clique em "Importar Loteamento"</span>
          </li>
        </ol>
        
        {/* Botão de download */}
        <div className="mt-4">
          <button
            onClick={handleDownloadTemplate}
            className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar Planilha Modelo
          </button>
        </div>
      </div>

      {/* Card de upload/editor */}
      <div className="bg-[var(--card-bg)] rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Upload da Planilha</h2>
        
        {/* Upload de Excel */}
        <div className="mb-4">
          <label className="block text-[var(--foreground)] opacity-80 font-semibold mb-2">
            Selecionar Planilha Excel (.xlsx)
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelUpload}
            onClick={(e) => {
              // Resetar o valor do input para permitir selecionar o mesmo arquivo novamente
              (e.target as HTMLInputElement).value = '';
            }}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-500 file:text-white file:font-semibold hover:file:bg-green-600 transition-colors"
          />
          <p className="text-xs text-[var(--foreground)] opacity-60 mt-2">
            📊 A planilha deve ter uma aba "Info" com o nome do loteamento e demais abas com os dados dos lotes de cada quadra.
          </p>
        </div>

        {/* Instruções para Excel */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <p className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Estrutura da Planilha Excel
          </p>
          <div className="text-sm text-blue-200 space-y-2">
            <p><strong>Aba "Info":</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li>Linha com "Nome do Loteamento" na coluna A e o nome na coluna B</li>
            </ul>
            <p><strong>Demais abas (uma por quadra):</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li><strong>Número</strong> ou <strong>Lote</strong>: Número do lote</li>
              <li><strong>Status</strong>: disponível, reservado, vendido ou bloqueado</li>
              <li><strong>Preço</strong>: Valor do lote (aceita formatação de moeda)</li>
              <li><strong>Área</strong>: Tamanho em m²</li>
              <li><strong>Descrição</strong>: Texto descritivo (opcional)</li>
              <li><strong>Características</strong>: Lista separada por vírgulas (opcional)</li>
            </ul>
            <p><strong>Para lotes reservados/vendidos (colunas adicionais):</strong></p>
            <ul className="list-disc list-inside ml-4">
              <li><strong>Cliente</strong>: Nome do cliente</li>
              <li><strong>Email</strong>: Email do cliente</li>
              <li><strong>Telefone</strong>: Telefone com DDD</li>
              <li><strong>CPF</strong>: CPF do cliente (opcional)</li>
              <li><strong>Endereço</strong>: Endereço completo (opcional)</li>
              <li><strong>Pagamento</strong>: dinheiro, financiamento ou parcelado</li>
              <li><strong>Observações</strong>: Notas adicionais (opcional)</li>
            </ul>
          </div>
        </div>

        {excelFile && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-green-300 font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Arquivo processado: {excelFile.name}
            </p>
            <p className="text-green-200 text-sm mt-1">
              JSON gerado com sucesso! Revise o conteúdo abaixo antes de importar.
            </p>
          </div>
        )}

        {/* Editor de texto */}
        <div className="mb-4">
          <label className="block text-[var(--foreground)] opacity-80 font-semibold mb-2">
            JSON Gerado (pode editar antes de importar)
          </label>
          <textarea
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            placeholder='Faça upload da planilha Excel para gerar o JSON...'
            rows={15}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-[var(--foreground)] font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          <p className="text-[var(--foreground)] opacity-50 text-sm mt-2">
            JSON convertido da planilha. Revise e edite se necessário antes de importar.
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={isUploading || !jsonContent.trim()}
            className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-[var(--foreground)] rounded-xl font-bold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importar Loteamento
              </>
            )}
          </button>
          <button
            onClick={() => {
              setJsonContent('');
              setError('');
              setSuccess(null);
              setExcelFile(null);
            }}
            disabled={isUploading}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-[var(--foreground)] rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
