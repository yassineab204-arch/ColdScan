/** Prepare a detailed JPEG while staying comfortably below Vercel's 4.5 MB request limit. */
const MAX_EDGE = 1920;
const MAX_DATA_URL_LENGTH = 3_500_000;

/** Reject unreadable, unsupported or cross-origin images rather than sending invalid data. */
export function downscaleImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('Invalid image dimensions');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        let scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        for (let attempt = 0; attempt < 5; attempt++) {
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL('image/jpeg', attempt === 0 ? 0.88 : 0.8);
          if (data.startsWith('data:image/jpeg;base64,') && data.length <= MAX_DATA_URL_LENGTH) return resolve(data);
          scale *= 0.8;
        }
        reject(new Error('Image is too large'));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error('Unable to load image'));
    img.src = src;
  });
}
