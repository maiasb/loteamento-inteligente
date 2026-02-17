import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
});

const FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER || process.env.CLOUDINARY_FOLDER || 'vale-dos-carajas';

/**
 * Upload de data URL (base64) para o Cloudinary
 * Retorna a URL pública da imagem
 */
export async function uploadToCloudinary(
  dataUrl: string,
  options?: { folder?: string; publicId?: string }
): Promise<{ url: string; publicId: string }> {
  const folder = options?.folder || `${FOLDER}/overlays`;
  
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    public_id: options?.publicId,
    resource_type: 'image',
    overwrite: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Deletar imagem do Cloudinary por public_id
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

export default cloudinary;
