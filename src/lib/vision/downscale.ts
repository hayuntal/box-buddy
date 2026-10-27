/**
 * Shrinks a camera photo in the browser before it is sent.
 *
 * A phone photo is several megabytes, which is slower than the model call
 * itself to upload and buys nothing: beyond roughly 1568px on the long edge
 * the model sees no more detail, it just costs more tokens. Doing it here
 * also keeps the Server Action payload well inside its body limit.
 */

export const MAX_EDGE = 1568;
const QUALITY = 0.82;

export type Shot = { base64: string; mediaType: "image/jpeg"; previewUrl: string };

export async function downscaleToJpeg(file: File): Promise<Shot> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("לא הצלחנו לעבד את התמונה בדפדפן.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const comma = dataUrl.indexOf(",");
  return {
    base64: dataUrl.slice(comma + 1),
    mediaType: "image/jpeg",
    previewUrl: dataUrl,
  };
}
