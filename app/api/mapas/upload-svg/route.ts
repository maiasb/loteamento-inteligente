import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

// Aumentar limite de body para base64 grandes
export const maxDuration = 60;

const MAX_DATA_URL_LENGTH = 10 * 1024 * 1024;

// O editor de overlay envia SVG, então SVG continua permitido (decisão mantida).
const FORMATOS_PERMITIDOS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
const DATA_URL_IMAGEM = /^data:image\/(png|jpeg|webp|svg\+xml);base64,/;

export async function POST(request: NextRequest) {
  try {
    // Rejeita cedo pelo cabeçalho, antes de ler o corpo na memória.
    const tamanho = Number(request.headers.get('content-length'));
    if (Number.isFinite(tamanho) && tamanho > MAX_DATA_URL_LENGTH) {
      return NextResponse.json({ error: 'Imagem maior que o limite de 10 MB' }, { status: 413 });
    }

    const body = await request.json();
    const { dataUrl, mapId } = body;

    if (!dataUrl || !mapId) {
      return NextResponse.json({ error: 'dataUrl e mapId são obrigatórios' }, { status: 400 });
    }

    if (!/^\d+$/.test(String(mapId))) {
      return NextResponse.json({ error: 'mapId inválido' }, { status: 400 });
    }

    if (typeof dataUrl !== 'string') {
      return NextResponse.json({ error: 'dataUrl inválido' }, { status: 400 });
    }

    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      return NextResponse.json({ error: 'Imagem maior que o limite de 10 MB' }, { status: 413 });
    }

    // Validar que é um data URL de imagem em formato permitido
    if (!DATA_URL_IMAGEM.test(dataUrl)) {
      return NextResponse.json(
        { error: 'Formato inválido. Envie uma imagem PNG, JPEG, WebP ou SVG.' },
        { status: 400 }
      );
    }

    // Upload para Cloudinary
    const result = await uploadToCloudinary(dataUrl, {
      folder: `vale-dos-carajas/overlays`,
      publicId: `overlay-${mapId}-${Date.now()}`,
      allowedFormats: FORMATOS_PERMITIDOS,
    });

    return NextResponse.json(
      {
        url: result.url,
        publicId: result.publicId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /mapas/upload-svg] Erro ao fazer upload:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload da imagem' }, { status: 500 });
  }
}
