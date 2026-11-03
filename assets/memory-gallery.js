import { mediaGet } from "./media.js";

export function galleryIndex(current, length, direction) {
  return Math.max(0, Math.min(length - 1, current + direction));
}

let installed = false;
let dialog, image, caption, details, previous, next, zoomButton;
let items = [], index = 0, angle = 0, zoom = 1, imageUrl = "", requestId = 0;

function mediaEntries(root) {
  const unique = new Map();
  for (const button of root.querySelectorAll("[data-memory-open]")) {
    const id = button.dataset.memoryOpen;
    if (id && !unique.has(id))
      unique.set(id, { id, title: button.dataset.memoryCaption || "", date: button.dataset.memoryDate || "" });
  }
  return [...unique.values()];
}

function ensureDialog() {
  if (dialog) return;
  dialog = document.createElement("dialog");
  dialog.className = "nc-gallery-dialog";
  dialog.setAttribute("aria-labelledby", "ncGalleryTitle");
  dialog.innerHTML = [
    '<div class="nc-gallery-panel">',
    '<header class="nc-gallery-header">',
    '<div><span class="nc-gallery-eyebrow">NOSSO ÁLBUM</span><h2 id="ncGalleryTitle">Um instante nosso</h2></div>',
    '<button type="button" class="nc-gallery-close" data-gallery-action="close" aria-label="Fechar fotografia">Fechar ×</button>',
    '</header><div class="nc-gallery-stage">',
    '<button type="button" class="nc-gallery-arrow" data-gallery-action="previous" aria-label="Fotografia anterior">‹</button>',
    '<div class="nc-gallery-picture"><img alt="" /><p class="nc-gallery-loading" role="status">Abrindo a lembrança…</p></div>',
    '<button type="button" class="nc-gallery-arrow" data-gallery-action="next" aria-label="Próxima fotografia">›</button>',
    '</div><footer class="nc-gallery-footer"><div class="nc-gallery-caption"><strong></strong><small></small></div>',
    '<div class="nc-gallery-tools">',
    '<button type="button" data-gallery-action="rotate" aria-label="Girar fotografia em noventa graus">Girar 90°</button>',
    '<button type="button" data-gallery-action="zoom" aria-pressed="false" aria-label="Ampliar fotografia">Ampliar</button>',
    '</div></footer></div>'
  ].join("");
  document.body.append(dialog);
  image = dialog.querySelector("img");
  caption = dialog.querySelector(".nc-gallery-caption strong");
  details = dialog.querySelector(".nc-gallery-caption small");
  previous = dialog.querySelector('[data-gallery-action="previous"]');
  next = dialog.querySelector('[data-gallery-action="next"]');
  zoomButton = dialog.querySelector('[data-gallery-action="zoom"]');
  dialog.addEventListener("click", event => {
    const action = event.target.closest("[data-gallery-action]")?.dataset.galleryAction;
    if (action === "close") dialog.close();
    else if (action === "previous" && index > 0) void show(index - 1);
    else if (action === "next" && index < items.length - 1) void show(index + 1);
    else if (action === "rotate") { angle = (angle + 90) % 360; applyTransform(); }
    else if (action === "zoom") { zoom = zoom === 1 ? 1.5 : 1; applyTransform(); }
    else if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); void show(index - 1); }
    if (event.key === "ArrowRight" && index < items.length - 1) { event.preventDefault(); void show(index + 1); }
  });
  dialog.addEventListener("close", () => {
    requestId++;
    image.removeAttribute("src");
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = "";
    document.body.classList.remove("nc-gallery-open");
    items = [];
  });
}

function applyTransform() {
  image.style.transform = "rotate(" + angle + "deg) scale(" + zoom + ")";
  zoomButton.setAttribute("aria-pressed", String(zoom > 1));
  zoomButton.textContent = zoom > 1 ? "Reduzir" : "Ampliar";
}

async function show(nextIndex) {
  if (nextIndex < 0 || nextIndex >= items.length) return;
  const item = items[nextIndex];
  index = nextIndex;
  angle = 0;
  zoom = 1;
  applyTransform();
  previous.disabled = index === 0;
  next.disabled = index === items.length - 1;
  caption.textContent = item.title;
  details.textContent = item.date;
  image.alt = item.title || "Fotografia guardada no Nosso Canto";
  image.removeAttribute("src");
  image.hidden = true;
  const feedback = dialog.querySelector(".nc-gallery-loading");
  feedback.textContent = "Abrindo a lembrança…";
  feedback.hidden = false;
  const ticket = ++requestId;
  const old = imageUrl;
  imageUrl = "";
  if (old) URL.revokeObjectURL(old);
  try {
    const blob = await mediaGet(item.id);
    if (ticket !== requestId || !dialog.open) return;
    if (!blob) throw new Error("Imagem não encontrada neste dispositivo.");
    const url = URL.createObjectURL(blob);
    imageUrl = url;
    image.src = url;
    image.hidden = false;
    feedback.hidden = true;
  } catch {
    if (ticket === requestId && dialog.open)
      feedback.textContent = "Esta foto ainda não está disponível aqui. Verifique a sincronização.";
  }
}

export function installMemoryGallery(root = document.querySelector("#app")) {
  if (!root || installed) return;
  installed = true;
  root.addEventListener("click", event => {
    const trigger = event.target.closest("[data-memory-open]");
    if (!trigger || !root.contains(trigger)) return;
    event.preventDefault();
    items = mediaEntries(root);
    index = items.findIndex(item => item.id === trigger.dataset.memoryOpen);
    if (index < 0) return;
    ensureDialog();
    dialog.showModal();
    document.body.classList.add("nc-gallery-open");
    void show(index);
  });
  const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (finePointer?.matches) {
    root.addEventListener("pointermove", event => {
      if (reducedMotion?.matches) return;
      const tile = event.target.closest(".memory-tile");
      if (!tile || !root.contains(tile)) return;
      const rect = tile.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      tile.style.setProperty("--nc-tilt-x", (-y * 3).toFixed(2) + "deg");
      tile.style.setProperty("--nc-tilt-y", (x * 3).toFixed(2) + "deg");
    });
    root.addEventListener("pointerout", event => {
      const tile = event.target.closest(".memory-tile");
      if (!tile || tile.contains(event.relatedTarget)) return;
      tile.style.removeProperty("--nc-tilt-x");
      tile.style.removeProperty("--nc-tilt-y");
    });
  }
}
