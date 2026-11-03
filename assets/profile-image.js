const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function validateProfileImage(file) {
  if (!file || !TYPES.has(file.type)) throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (file.size < 1 || file.size > 6 * 1024 * 1024) throw new Error("A foto do perfil precisa ter até 6 MB.");
  return true;
}
export async function profileImageToDataUrl(file) {
  validateProfileImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 260 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.68, 0.54, 0.42]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob || blob.size > 90000) continue;
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível preparar a imagem."));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    throw new Error("A imagem ficou grande demais. Tente outra foto.");
  } finally { bitmap.close?.(); }
}
