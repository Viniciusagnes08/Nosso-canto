/** A bounded set of videos/images around the current reel. */
export function visibleMediaWindow(activeIndex, total, radius = 1) {
  if (!Number.isInteger(activeIndex) || total <= 0) return [];
  const start = Math.max(0, activeIndex - radius);
  const end = Math.min(total - 1, activeIndex + radius);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
export function inMediaWindow(candidate, activeIndex, total) {
  return visibleMediaWindow(activeIndex, total).includes(candidate);
}
export function reelViewVersion(items) {
  return items.map(item => [
    item.id, item.updatedAt?.seconds || item.created || "",
    item.shared, item.title, item.storagePath, item.photoId, (item.photoData || "").length
  ].join(":")).join("|");
}
