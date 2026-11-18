import { AI_IMAGE_BYTES, AI_IMAGE_EDGE } from "../shared/kapsAppAi";

export async function prepareKapsAiPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("JPEG, PNG veya telefonunun açabildiği bir fotoğraf seç.");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("Fotoğraf en fazla 20 MB olabilir.");
  const url = URL.createObjectURL(file);
  try {
    const photo = new Image();
    photo.src = url;
    await photo.decode();
    if (!photo.naturalWidth || !photo.naturalHeight
        || photo.naturalWidth * photo.naturalHeight > 40_000_000) {
      throw new Error("Fotoğraf çok büyük. Daha küçük bir kopyasını seç.");
    }
    const scale = Math.min(1, AI_IMAGE_EDGE / Math.max(photo.naturalWidth, photo.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Fotoğraf hazırlanamadı.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.58]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.startsWith("data:image/jpeg;base64,") && (data.length - 23) * 3 / 4 <= AI_IMAGE_BYTES) return data;
    }
    throw new Error("Fotoğraf sıkıştırılamadı. Daha küçük bir fotoğraf seç.");
  } catch (error) {
    if (error instanceof Error && error.name !== "EncodingError") throw error;
    throw new Error("Fotoğraf açılamadı. JPEG veya PNG olarak tekrar seç.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
