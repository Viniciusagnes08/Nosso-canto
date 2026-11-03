// A filename imported from a device is not a caption written by either person.
const filenamePattern = /^[^\r\n/\\]{1,190}\.(?:jpe?g|png|webp|heic|heif|gif|bmp|mp4|mov|webm)$/i;
export function isUploadFilename(value) {
  const raw = String(value || "").trim();
  return filenamePattern.test(raw);
}
export function visibleMediaCaption(item) {
  const title = String(item?.title || "").trim();
  if (!title || title === "Um momento nosso ♡" || isUploadFilename(title)) return "";
  return title;
}
