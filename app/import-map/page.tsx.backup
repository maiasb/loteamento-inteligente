'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

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
  const [showExample, setShowExample] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploaded, setImageUploaded] = useState(false);

  const exampleJson = {
    name: "Loteamento Exemplo",
    imageUrl: "",
    imageType: "image/png",
    width: 800,
    height: 600,
    blocks: [
      {
        name: "Quadra A",
        description: "Primeira quadra do loteamento",
        lots: [
          {
            lotNumber: "01",
            status: "available",
            price: 50000,
            size: 300,
            description: "Lote de esquina disponível",
            features: ["Esquina", "Frente norte"]
          },
          {
            lotNumber: "02",
            status: "reserved",
            price: 45000,
            size: 250,
            description: "Lote reservado - Financiamento aprovado",
            features: ["Frente sul"],
            reservation: {
              customer_name: "João Silva",
              customer_email: "joao.silva@email.com",
              customer_phone: "(11) 98765-4321",
              customer_cpf: "12345678900",
              customer_address: "Rua Exemplo, 123 - São Paulo/SP",
              payment_method: "financing",
              status: "approved",
              notes: "Cliente aprovado para financiamento bancário"
            }
          },
          {
            lotNumber: "03",
            status: "sold",
            price: 48000,
            size: 260,
            description: "Lote vendido - Pagamento à vista",
            features: ["Meio de quadra"],
            reservation: {
              customer_name: "Maria Santos",
              customer_email: "maria.santos@email.com",
              customer_phone: "(11) 91234-5678",
              customer_cpf: "98765432100",
              customer_address: "Av. Principal, 456 - São Paulo/SP",
              payment_method: "cash",
              status: "completed",
              notes: "Pagamento à vista realizado com sucesso"
            }
          },
          {
            lotNumber: "04",
            status: "blocked",
            price: 47000,
            size: 240,
            description: "Lote bloqueado para manutenção",
            features: []
          },
          {
            lotNumber: "05",
            status: "reserved",
            price: 52000,
            size: 280,
            description: "Lote reservado - Aguardando documentação",
            features: ["Frente leste"],
            reservation: {
              customer_name: "Carlos Mendes",
              customer_email: "carlos.mendes@email.com",
              customer_phone: "(11) 99999-8888",
              customer_cpf: "11122233344",
              customer_address: "Rua das Flores, 789 - São Paulo/SP",
              payment_method: "installments",
              status: "pending",
              notes: "Aguardando análise de documentação para parcelamento"
            }
          }
        ]
      },
      {
        name: "Quadra B",
        description: "Segunda quadra com vista privilegiada",
        lots: [
          {
            lotNumber: "01",
            status: "available",
            price: 60000,
            size: 350,
            description: "Lote maior disponível",
            features: ["Vista privilegiada", "Esquina"]
          },
          {
            lotNumber: "02",
            status: "reserved",
            price: 55000,
            size: 320,
            description: "Lote reservado com vista para o lago",
            features: ["Vista para lago"],
            reservation: {
              customer_name: "Pedro Oliveira",
              customer_email: "pedro.oliveira@email.com",
              customer_phone: "(11) 99876-5432",
              customer_cpf: "45678912300",
              customer_address: "Alameda Santos, 321 - São Paulo/SP",
              payment_method: "installments",
              status: "pending",
              notes: "Aguardando análise de crédito para parcelamento em 60x"
            }
          },
          {
            lotNumber: "03",
            status: "sold",
            price: 58000,
            size: 330,
            description: "Lote vendido - Vista panorâmica",
            features: ["Vista panorâmica", "Frente norte"],
            reservation: {
              customer_name: "Ana Paula Costa",
              customer_email: "ana.costa@email.com",
              customer_phone: "(11) 97777-6666",
              customer_cpf: "55566677788",
              customer_address: "Rua Bela Vista, 100 - São Paulo/SP",
              payment_method: "financing",
              status: "completed",
              notes: "Financiamento aprovado e documentação finalizada"
            }
          },
          {
            lotNumber: "04",
            status: "available",
            price: 57000,
            size: 310,
            description: "Lote disponível com área verde",
            features: ["Próximo à área verde"]
          }
        ]
      },
      {
        name: "Quadra C",
        description: "Terceira quadra - Área comercial",
        lots: [
          {
            lotNumber: "01",
            status: "sold",
            price: 75000,
            size: 400,
            description: "Lote comercial vendido",
            features: ["Esquina comercial", "Frente dupla"],
            reservation: {
              customer_name: "Empresa XYZ Ltda",
              customer_email: "contato@empresaxyz.com.br",
              customer_phone: "(11) 3333-4444",
              customer_cpf: "99999999000199",
              customer_address: "Av. Comercial, 1000 - São Paulo/SP",
              payment_method: "cash",
              status: "completed",
              notes: "Compra para construção de estabelecimento comercial"
            }
          },
          {
            lotNumber: "02",
            status: "reserved",
            price: 70000,
            size: 380,
            description: "Lote comercial reservado",
            features: ["Localização estratégica"],
            reservation: {
              customer_name: "Roberto Ferreira",
              customer_email: "roberto.ferreira@email.com",
              customer_phone: "(11) 98888-7777",
              customer_cpf: "22233344455",
              customer_address: "Rua Comércio, 555 - São Paulo/SP",
              payment_method: "financing",
              status: "approved",
              notes: "Aprovado para construção de loja. Entrada de 30%"
            }
          },
          {
            lotNumber: "03",
            status: "blocked",
            price: 68000,
            size: 360,
            description: "Lote bloqueado - Área verde preservada",
            features: ["Preservação ambiental"]
          }
        ]
      }
    ]
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonContent(content);
      setError('');
      setSuccess(null);
    };
    reader.readAsText(file);
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

      console.log('[ImportMap] ✅ Importação bem-sucedida:', response.data);
      setSuccess(response.data);
      setJsonContent('');
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

  const handleUseExample = () => {
    setJsonContent(JSON.stringify(exampleJson, null, 2));
    setShowExample(false);
    setError('');
    setSuccess(null);
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

            console.log('[ImportMap] ✅ PDF atualizado:', response.data);
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

              console.log('[ImportMap] ✅ Imagem atualizada:', response.data);
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
        <h1 className="text-3xl font-bold text-white mb-2">Importar Loteamento</h1>
        <p className="text-white/70">
          Faça upload de um arquivo JSON com os dados do mapa, quadras e lotes
        </p>
      </div>

      {/* Card de sucesso */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-500 file:text-white file:text-sm file:font-semibold hover:file:bg-blue-600 transition-colors disabled:opacity-50"
                    />
                    {imagePreview && (
                      <div className="relative">
                        {imagePreview === 'PDF' ? (
                          <div className="w-full h-40 bg-gray-900 rounded-lg flex flex-col items-center justify-center border border-gray-700">
                            <svg className="w-16 h-16 text-red-400 mb-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <p className="text-white font-semibold">{imageFile?.name}</p>
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
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
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
                  onClick={() => router.push(`/admin/map-details?mapId=${success.mapId}`)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors"
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
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-colors"
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
        <h2 className="text-xl font-bold text-white mb-4">Como Usar</h2>
        <ol className="space-y-2 text-white/80">
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">1</span>
            <span>Prepare um arquivo JSON com os dados do loteamento</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">2</span>
            <span>Faça upload do arquivo ou cole o conteúdo JSON no campo abaixo</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">3</span>
            <span>Clique em "Importar Loteamento" e aguarde o processamento</span>
          </li>
        </ol>
        <button
          onClick={() => setShowExample(!showExample)}
          className="mt-4 text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showExample ? 'Ocultar' : 'Ver'} Exemplo de JSON
        </button>
      </div>

      {/* Card de exemplo */}
      {showExample && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Exemplo de Arquivo JSON</h3>
            <button
              onClick={handleUseExample}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors text-sm"
            >
              Usar Este Exemplo
            </button>
          </div>
          <pre className="bg-black rounded-lg p-4 overflow-x-auto text-sm text-green-400">
            {JSON.stringify(exampleJson, null, 2)}
          </pre>
          <div className="mt-4 text-white/70 text-sm space-y-3">
            <div>
              <p className="font-semibold text-white mb-1">Campos obrigatórios:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><code className="text-blue-400">name</code>: Nome do mapa</li>
                <li><code className="text-blue-400">blocks</code>: Array de quadras (pelo menos 1)</li>
                <li><code className="text-blue-400">blocks[].name</code>: Nome da quadra</li>
                <li><code className="text-blue-400">lots[].lotNumber</code>: Número do lote</li>
                <li><code className="text-blue-400">lots[].price</code>: Preço do lote</li>
                <li><code className="text-blue-400">lots[].size</code>: Tamanho em m²</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white mb-1">Status dos lotes:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><code className="text-green-400">available</code>: Lote disponível para venda</li>
                <li><code className="text-yellow-400">reserved</code>: Lote reservado (requer dados de reservation) ⭐</li>
                <li><code className="text-red-400">sold</code>: Lote vendido (requer dados de reservation) ⭐</li>
                <li><code className="text-gray-400">blocked</code>: Lote bloqueado (indisponível)</li>
              </ul>
            </div>
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3">
              <p className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                ⭐ Dados de reserva (OBRIGATÓRIO para status reserved/sold):
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-blue-200">
                <li><code className="text-blue-400">reservation.customer_name</code>: Nome completo do cliente</li>
                <li><code className="text-blue-400">reservation.customer_email</code>: Email do cliente</li>
                <li><code className="text-blue-400">reservation.customer_phone</code>: Telefone com DDD</li>
                <li><code className="text-blue-400">reservation.customer_cpf</code>: CPF (apenas números, 11 dígitos) ou CNPJ (14 dígitos) - opcional</li>
                <li><code className="text-blue-400">reservation.customer_address</code>: Endereço completo (opcional)</li>
                <li><code className="text-blue-400">reservation.payment_method</code>: cash, financing ou installments</li>
                <li><code className="text-blue-400">reservation.status</code>: pending, approved, completed, cancelled ou rejected</li>
                <li><code className="text-blue-400">reservation.notes</code>: Observações adicionais (opcional)</li>
              </ul>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3">
              <p className="font-semibold text-yellow-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Importante sobre reservas:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1 text-yellow-200 text-xs">
                <li>O sistema criará automaticamente registros em <code>purchase_requests</code></li>
                <li>Cada lote reservado/vendido terá sua reserva vinculada em <code>purchase_request_lots</code></li>
                <li>Status <code>approved</code> será convertido para <code>completed</code> no banco</li>
                <li>Status <code>rejected</code> será convertido para <code>cancelled</code> no banco</li>
                <li>O exemplo acima contém 6 lotes com reservas simuladas (3 reserved, 3 sold)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Card de upload/editor */}
      <div className="bg-[var(--card-bg)] rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Upload do Arquivo</h2>
        
        {/* Input de arquivo */}
        <div className="mb-4">
          <label className="block text-white/80 font-semibold mb-2">
            Selecionar Arquivo JSON
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:font-semibold hover:file:bg-blue-600 transition-colors"
          />
        </div>

        <div className="text-center text-white/50 font-semibold my-4">OU</div>

        {/* Editor de texto */}
        <div className="mb-4">
          <label className="block text-white/80 font-semibold mb-2">
            Colar Conteúdo JSON
          </label>
          <textarea
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            placeholder='{"name": "Meu Loteamento", "blocks": [...]}'
            rows={15}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          <p className="text-white/50 text-sm mt-2">
            Cole aqui o conteúdo do arquivo JSON ou edite o texto carregado
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={isUploading || !jsonContent.trim()}
            className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            }}
            disabled={isUploading}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
