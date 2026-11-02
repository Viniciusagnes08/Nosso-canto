const imgCache = new Map();
let mediaDatabase = "entre-nos-images";
export function setMediaUser(userId) {
  for (const url of imgCache.values()) URL.revokeObjectURL(url);
  imgCache.clear();
  mediaDatabase = userId ? "entre-nos-images:" + userId : "entre-nos-images";
}
function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window))
      return reject(new Error("IndexedDB indispon\u00edvel"));
    const req = indexedDB.open(mediaDatabase, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("media"))
        req.result.createObjectStore("media");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function mediaPut(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("media", "readwrite");
    t.objectStore("media").put(blob, id);
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}
async function mediaGet(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("media", "readonly"),
      req = t.objectStore("media").get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
async function mediaDelete(id) {
  if (!id) return;
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const t = db.transaction("media", "readwrite");
      t.objectStore("media").delete(id);
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
    db.close();
    const old = imgCache.get(id);
    if (old) URL.revokeObjectURL(old);
    imgCache.delete(id);
  } catch {}
}
async function mediaClear() {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const t = db.transaction("media", "readwrite");
      t.objectStore("media").clear();
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
    db.close();
    for (const u of imgCache.values()) URL.revokeObjectURL(u);
    imgCache.clear();
  } catch {}
}
async function compress(file) {
  if (!file.type.startsWith("image/"))
    throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 16 * 1024 * 1024)
    throw new Error("A imagem deve ter at\u00e9 16 MB.");
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const output = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.83),
    );
    if (output) return output;
  } catch {}
  return file;
}
async function attachImages() {
  const nodes = [...document.querySelectorAll("img[data-photo]")];
  for (const el of nodes) {
    const id = el.getAttribute("data-photo");
    if (!id) continue;
    try {
      if (!imgCache.has(id)) {
        const blob = await mediaGet(id);
        if (!blob) continue;
        imgCache.set(id, URL.createObjectURL(blob));
      }
      if (el.isConnected) el.src = imgCache.get(id);
    } catch {}
  }
}

export { mediaPut, mediaGet, mediaDelete, mediaClear, compress, attachImages };
