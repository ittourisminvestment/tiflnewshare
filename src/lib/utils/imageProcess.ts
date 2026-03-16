/**
 * Utility to compress and convert images to WebP on the client side.
 * This helps save storage space and bandwidth.
 */

export async function processImage(file: File, quality: number = 0.8, maxWidth: number = 1920): Promise<File | Blob> {
  // If not an image, return as is
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // If already WebP and small enough, return as is (optional optimization)
  // if (file.type === 'image/webp' && file.size < 500000) return file;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback to original
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP with quality compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Create a new file from the blob
              const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              
              // Only return if it's actually smaller or if we want the uniform format
              if (newFile.size < file.size || file.type !== 'image/webp') {
                resolve(newFile);
              } else {
                resolve(file);
              }
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}
