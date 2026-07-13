import { supabase } from '@/lib/supabase';

async function compressForMockup(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxWidth = 800;
      const maxHeight = 800;
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.80
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export async function uploadHeroMockupImage(file: File, screenId: string): Promise<string> {
  const compressed = await compressForMockup(file);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const filePath = `landing-hero/${screenId}/${timestamp}-${random}.jpg`;

  const { error } = await supabase.storage
    .from('public')
    .upload(filePath, compressed, { cacheControl: '3600', upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from('public').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteHeroMockupImage(url: string): Promise<void> {
  const bucket = supabase.storage.from('public');
  const baseUrl = bucket.getPublicUrl('').data.publicUrl;
  const path = url.replace(baseUrl, '').replace(/^\//, '');
  if (path.startsWith('landing-hero/')) {
    await bucket.remove([path]);
  }
}
