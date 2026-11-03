import { topicsForProfile } from "./universe-topics.js";
export const SPACE_ID = "nosso-canto";
export const MEDIA_LIMITS = Object.freeze({
  photo: 12 * 1024 * 1024,
  gif: 8 * 1024 * 1024,
  video: 24 * 1024 * 1024
});
const MEDIA_TYPES = Object.freeze({
  "image/jpeg": ["photo", "jpg"],
  "image/png": ["photo", "jpg"],
  "image/webp": ["photo", "jpg"],
  "image/gif": ["gif", "gif"],
  "video/mp4": ["video", "mp4"],
  "video/webm": ["video", "webm"]
});
export function identifyMedia(file) {
  const info = MEDIA_TYPES[file?.type];
  if (!info) throw new Error("Use JPG, PNG, WebP, GIF, MP4 ou WebM.");
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MEDIA_LIMITS[info[0]])
    throw new Error("Arquivo acima do limite: fotos 12 MB, GIFs 8 MB e vídeos 24 MB.");
  return { kind: info[0], ext: info[1] };
}
export function cleanProfile(input = {}) {
  const normalized = (key, len) => String(input[key] || "").trim().slice(0, len);
  const rawAvatar = normalized("avatarData", 180000);
  const avatarData = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,179970}$/.test(rawAvatar) ? rawAvatar : "";
  return {
    self: normalized("self", 40) || "Você",
    partner: normalized("partner", 40) || "Seu amor",
    anniversary: /^\d{4}-\d{2}-\d{2}$/.test(normalized("anniversary", 10)) ? normalized("anniversary", 10) : "",
    bio: normalized("bio", 240),
    interests: normalized("interests", 160),
    favoriteMusic: normalized("favoriteMusic", 100),
    avatarData,
    universeTopics: topicsForProfile(input)
  };
}
export function isReelItem(doc) {
  if (!doc || typeof doc !== "object") return false;
  if (doc.type === "reel")
    return ["photo", "gif", "video"].includes(doc.mediaKind) &&
      ((doc.mediaKind === "photo" && /^data:image\/jpeg;base64,/.test(doc.mediaData || "")) ||
       (doc.storagePath && /^reels\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(gif|mp4|webm)$/.test(doc.storagePath)));
  return doc.type === "memory" && Boolean(doc.photoData || doc.photoId);
}
export function uniqueFeed(own, shared, uid, filter = "shared") {
  const entries = new Map();
  for (const item of [...shared, ...own]) {
    if (!isReelItem(item)) continue;
    if (filter === "shared" && item.shared !== true) continue;
    if (filter === "mine" && item.authorId !== uid) continue;
    if (item.shared !== true && item.authorId !== uid) continue;
    entries.set(item.id, item);
  }
  return [...entries.values()].sort((a,b) => String(b.created || b.date || "").localeCompare(String(a.created || a.date || ""))).slice(0, 80);
}
export function canEditPost(item, uid) {
  return Boolean(uid && item?.authorId === uid);
}

