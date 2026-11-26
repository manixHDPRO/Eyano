export type RotationDeg = 0 | 90 | 180 | 270;

export type CropTransform = {
  offsetX: number;
  offsetY: number;
  zoom: number;
  rotation: RotationDeg;
  flipH: boolean;
};

export type CropStage = {
  width: number;
  height: number;
};

export const PRODUCT_PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const PRODUCT_PHOTO_EXPORT_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_PHOTO_ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;

const EXPORT_LONG_EDGE = 1400;

export function isAcceptedPhotoType(type: string): boolean {
  return (PRODUCT_PHOTO_ACCEPT as readonly string[]).includes(type);
}

export function displayedSize(naturalWidth: number, naturalHeight: number, rotation: RotationDeg): {
  width: number;
  height: number;
} {
  if (rotation === 90 || rotation === 270) {
    return { width: naturalHeight, height: naturalWidth };
  }
  return { width: naturalWidth, height: naturalHeight };
}

export function coverScale(naturalWidth: number, naturalHeight: number, rotation: RotationDeg, stage: CropStage): number {
  const displayed = displayedSize(naturalWidth, naturalHeight, rotation);
  return Math.max(stage.width / displayed.width, stage.height / displayed.height);
}

export function clampOffsets(
  offsetX: number,
  offsetY: number,
  naturalWidth: number,
  naturalHeight: number,
  rotation: RotationDeg,
  zoom: number,
  stage: CropStage,
): { offsetX: number; offsetY: number } {
  const scale = coverScale(naturalWidth, naturalHeight, rotation, stage) * zoom;
  const displayed = displayedSize(naturalWidth, naturalHeight, rotation);
  const maxX = Math.max(0, (displayed.width * scale - stage.width) / 2);
  const maxY = Math.max(0, (displayed.height * scale - stage.height) / 2);
  return {
    offsetX: Math.min(maxX, Math.max(-maxX, offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, offsetY)),
  };
}

export function nextRotation(current: RotationDeg, direction: 1 | -1): RotationDeg {
  const values: RotationDeg[] = [0, 90, 180, 270];
  const index = values.indexOf(current);
  const next = values[(index + direction + values.length) % values.length];
  if (next === undefined) {
    return 0;
  }
  return next;
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de lire l’image."));
    image.src = src;
  });
}

export async function exportCroppedJpeg(
  image: HTMLImageElement,
  stage: CropStage,
  transform: CropTransform,
): Promise<Blob> {
  const scale = coverScale(image.naturalWidth, image.naturalHeight, transform.rotation, stage) * transform.zoom;
  const longEdge = Math.max(stage.width, stage.height);
  const outScale = EXPORT_LONG_EDGE / longEdge;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(stage.width * outScale));
  canvas.height = Math.max(1, Math.round(stage.height * outScale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Export visuel impossible.");
  }
  context.fillStyle = "#0c1222";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.translate(transform.offsetX * outScale, transform.offsetY * outScale);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.flipH ? -scale * outScale : scale * outScale, scale * outScale);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const qualities = [0.92, 0.84, 0.74, 0.62, 0.5];
  let last: Blob | null = null;
  for (const quality of qualities) {
    const blob = await canvasToJpeg(canvas, quality);
    last = blob;
    if (blob.size <= PRODUCT_PHOTO_EXPORT_MAX_BYTES) {
      return blob;
    }
  }
  if (!last) {
    throw new Error("Export visuel impossible.");
  }
  return last;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Export visuel impossible."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}
