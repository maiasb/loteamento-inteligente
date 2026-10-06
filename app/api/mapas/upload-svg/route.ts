import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

// Aumentar limite de body para base64 grandes
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataUrl, mapId } = body;

    if (!dataUrl || !mapId) {
      return NextResponse.json({ error: 'dataUrl e mapId são obrigatórios' }, { status: 400 });
    }

    // Validar que é um data URL válido
    if (!dataUrl.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Formato inválido. Envie um data URL de imagem.' },
        { status: 400 }
      );
    }

    // Upload para Cloudinary
    const result = await uploadToCloudinary(dataUrl, {
      folder: `vale-dos-carajas/overlays`,
      publicId: `overlay-${mapId}-${Date.now()}`,
    });

    return NextResponse.json(
      {
        url: result.url,
        publicId: result.publicId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /mapas/upload-svg POST] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao fazer upload da imagem',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
