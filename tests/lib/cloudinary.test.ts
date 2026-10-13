import { afterEach, describe, expect, it, vi } from 'vitest';

describe('lib/cloudinary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('ignora variáveis NEXT_PUBLIC_* e repassa allowed_formats', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLOUDINARY_API_SECRET', 'publico');
    vi.stubEnv('CLOUDINARY_API_SECRET', '');
    const { default: cloudinary, uploadToCloudinary } = await import('@/lib/cloudinary');
    expect(cloudinary.config().api_secret).toBeFalsy();

    const upload = vi
      .spyOn(cloudinary.uploader, 'upload')
      .mockResolvedValue({ secure_url: 'https://x/y.png', public_id: 'y' } as never);
    await uploadToCloudinary('data:image/png;base64,AAAA', { allowedFormats: ['png'] });
    expect(upload.mock.calls[0][1]).toMatchObject({ allowed_formats: ['png'] });
  });
});
