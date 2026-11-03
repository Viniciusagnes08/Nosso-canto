const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function validateProfileImage(file) {
  if (!file || !TYPES.has(file.type)) throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (file.size < 1 || file.size > 6 * 1024 * 1024) throw new Error("A foto do perfil precisa ter até 6 MB.");
  return true;
}
async function decodeProfileImage(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function profileImageToDataUrl(file) {
  validateProfileImage(file);
  const decoded = await decodeProfileImage(file);
  try {
    const scale = Math.min(1, 260 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem neste aparelho.");
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
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
  } finally { decoded.close(); }
}

