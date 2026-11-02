import { MOODS } from "./catalog.js";
import { safe } from "./utils.js";

function moodPortrait(mood, className = "cat-mood-avatar") {
  return `<img class="${className}" src="${safe(mood.sticker)}" alt="" width="160" height="160" loading="lazy" decoding="async">`;
}

function stickerCard(mood, selected = false, mode = "full") {
  return `<button type="button" class="cat-sticker ${selected ? "selected" : ""}" data-pick-mood="${safe(mood.id)}" aria-pressed="${selected}" aria-label="${safe(mood.name)}: ${safe(mood.phrase)}">
    <span class="cat-sticker-image">${moodPortrait(mood, "cat-sticker-picture")}</span>
    <span class="cat-sticker-title">${safe(mood.name)}</span>
    <span class="cat-sticker-phrase">${safe(mood.phrase)}</span>
  </button>`;
}

function moodChoices(selected = "", mode = "full") {
  const modes = ["full", "modal", "preview"];
  if (!modes.includes(mode)) mode = "full";
  const options = mode === "preview"
    ? ["feliz", "saudade", "carente", "tranquilo"].map(id => MOODS.find(m => m.id === id))
    : MOODS;
  return `<div class="cat-mood-grid cat-mood-grid--${mode}" role="group" aria-label="Escolha seu humor">
    ${options.filter(Boolean).map(m => stickerCard(m, selected === m.id, mode)).join("")}
  </div>`;
}

export { moodChoices, moodPortrait };
