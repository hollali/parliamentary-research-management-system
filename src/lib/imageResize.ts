const MAX_WIDTH = 1200;
const MAX_DATA_URL_LENGTH = 400_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that image file.'));
    };
    image.src = objectUrl;
  });
}

export async function fileToResizedDataUrl(file: File, maxWidth = MAX_WIDTH): Promise<string> {
  const image = await loadImage(file);
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
