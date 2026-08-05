/**
 * Client-side image downscaling.
 *
 * Vercel serverless functions reject request bodies larger than 4.5 MB, and a
 * raw phone photo is routinely 4-12 MB once base64-encoded. Every image is
 * therefore resized and re-encoded in the browser before it is uploaded, which
 * also cuts scan latency and token cost. 1280px on the long edge is well above
 * what the vision model needs to identify fridge contents.
 */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;

/**
 * Returns a JPEG data URL no larger than MAX_EDGE on its longest side.
 * If the image cannot be loaded or drawn (e.g. a cross-origin host that does
 * not send CORS headers, which would taint the canvas), the original source is
 * returned unchanged so callers keep their existing behaviour.
 */
export function downscaleImage(src: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      // Needed to keep the canvas untainted for remote sample photos.
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const { width, height } = img;
          if (!width || !height) return resolve(src);

          const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);

          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(src);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch {
          resolve(src);
        }
      };

      img.onerror = () => resolve(src);
      img.src = src;
    } catch {
      resolve(src);
    }
  });
}
