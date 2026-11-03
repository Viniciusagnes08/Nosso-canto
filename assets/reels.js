import { getApp } from "@firebase/app";
import { getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp } from "@firebase/firestore";
import { getStorage, ref as fileRef, uploadBytes, deleteObject, getBlob, updateMetadata } from "@firebase/storage";
import { config } from "./config.js";
import { mediaGet } from "./media.js";
import { safe } from "./utils.js";
import { visibleMediaCaption } from "./reels-caption.js";
import { SPACE_ID, identifyMedia, cleanProfile, uniqueFeed, canEditPost } from "./reels-model.js";

const e = (value) => safe(String(value ?? ""));
const validImage = (value) =>
  /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value || "") ? value : "";
const shortDate = (date) => {
  const d = new Date(date);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(d) : "";
};
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
const state = {
  user: null, own: [], shared: [], selected: "shared",
  root: null, feed: null, profile: cleanProfile(), screen: "feed",
  open: false, unsub: [], observer: null, active: null, urls: new Map(),
  previewUrl: "", photoPreview: "", loading: false, status: "", currentList: [],
  favorites: new Set(), currentFile: null
};

function storage() {
  if (!config.FIREBASE_STORAGE_BUCKET) throw new Error("O armazenamento de vídeos e GIFs ainda precisa ser ativado no Firebase.");
  return getStorage(getApp(), "gs://" + config.FIREBASE_STORAGE_BUCKET);
}
function accountLabel(item) {
  return item.authorId === state.user?.id
    ? state.profile.self
    : String(item.authorSnapshot?.name || "Seu amor").slice(0, 40);
}
function avatarMarkup(item) {
  const candidate = item.authorId === state.user?.id ? state.profile.avatarData : item.authorSnapshot?.avatarData;
  const img = validImage(candidate);
  return img
    ? '<img class="reels-avatar" src="' + e(img) + '" alt="">'
    : '<span class="reels-avatar reels-avatar-letter" aria-hidden="true">' + e(accountLabel(item).slice(0, 1).toUpperCase()) + "</span>";
}
function getVisual(item) {
  const data = validImage(item.mediaData || item.photoData);
  if (data) return '<img class="reels-image" src="' + e(data) + '" alt="' + e(visibleMediaCaption(item) || "Foto") + '" loading="lazy">';
  if (item.storagePath && (item.mediaKind === "video" || item.mediaKind === "gif"))
    return item.mediaKind === "video"
      ? '<video class="reels-video" playsinline muted loop preload="none" aria-label="' + e(visibleMediaCaption(item) || "Vídeo do casal") + '"></video>'
      : '<img class="reels-image reels-gif" alt="' + e(visibleMediaCaption(item) || "Animação do casal") + '">';
  if (item.photoId) return '<img class="reels-image" data-reels-photo="' + e(item.photoId) + '" alt="' + e(visibleMediaCaption(item) || "Memória") + '">';
  return '<div class="reels-no-media">Mídia indisponível neste aparelho.</div>';
}
function renderCard(item, index) {
  const own = canEditPost(item, state.user?.id);
  const caption = visibleMediaCaption(item);
  return '<article class="reels-card" data-reels-index="' + index + '" data-reels-id="' + e(item.id) + '" aria-label="Memória ' + (index + 1) + ' de ' + state.currentList.length + '">' +
    '<div class="reels-media">' + getVisual(item) + '</div>' +
    '<div class="reels-shade"></div><div class="reels-caption">' +
    '<div class="reels-author">' + avatarMarkup(item) + '<span><strong>' + e(accountLabel(item)) + '</strong><small>' + e(shortDate(item.date || item.created)) + '</small></span></div>' +
    (caption ? '<p>' + e(caption) + '</p>' : '') + '</div><div class="reels-actions">' +
    '<button type="button" data-reels-fav="' + e(item.id) + '" aria-pressed="' + state.favorites.has(item.id) + '" title="Favorito neste aparelho"><span>' + (state.favorites.has(item.id) ? "♥" : "♡") + '</span><small>Gostei</small></button>' +
    (own && item.type === "reel" ? '<button type="button" data-reels-delete="' + e(item.id) + '" title="Apagar publicação"><span>×</span><small>Apagar</small></button>' : '') +
    (item.mediaKind === "video" ? '<button type="button" data-reels-sound="' + e(item.id) + '" title="Ativar ou silenciar áudio"><span>♪</span><small>Som</small></button>' : '') +
    '</div></article>';
}
function clearMedia() {
  state.observer?.disconnect();
  state.observer = null;
  for (const video of state.root?.querySelectorAll("video") || []) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  for (const url of state.urls.values()) URL.revokeObjectURL(url);
  state.urls.clear();
  state.active = null;
}
async function hydrateMedia(card, item) {
  if (!card?.isConnected || card.dataset.assetReady || card.dataset.assetLoading) return;
  const el = card.querySelector(".reels-video,.reels-gif,img[data-reels-photo]");
  if (!el) return;
  card.dataset.assetLoading = "true";
  try {
    let blob;
    if (item.storagePath) {
      if (!config.FIREBASE_STORAGE_BUCKET) throw new Error("Armazenamento não configurado.");
      blob = await getBlob(fileRef(storage(), item.storagePath), 26 * 1024 * 1024);
    } else if (item.photoId && item.authorId === state.user?.id) {
      blob = await mediaGet(item.photoId);
    }
    if (!blob) throw new Error("Não foi possível carregar o arquivo.");
    if (!card.isConnected || state.root?.hidden) return;
    const url = URL.createObjectURL(blob);
    state.urls.set(item.id, url);
    el.src = url;
    card.dataset.assetReady = "true";
    if (el.tagName === "VIDEO" && state.active === card && !prefersReducedMotion() && document.visibilityState === "visible")
      await el.play().catch(() => {});
  } catch {
    if (card.isConnected) {
      const note = document.createElement("div");
      note.className = "reels-media-error";
      note.textContent = "Não foi possível abrir esta mídia. Verifique as permissões de armazenamento.";
      card.querySelector(".reels-media")?.append(note);
    }
  } finally {
    if (card.isConnected) delete card.dataset.assetLoading;
  }
}
function activate(card) {
  if (state.active === card) return;
  for (const video of state.root?.querySelectorAll(".reels-video") || []) video.pause();
  state.active = card;
  const index = Number(card.dataset.reelsIndex);
  for (const offset of [-1,0,1]) {
    const target = state.root?.querySelector('[data-reels-index="' + (index + offset) + '"]');
    const item = state.currentList[index + offset];
    if (target && item) void hydrateMedia(target, item);
  }
  const video = card.querySelector("video");
  if (video && video.src && !prefersReducedMotion() && document.visibilityState === "visible")
    void video.play().catch(() => {});
}
function observeFeed() {
  state.feed = state.root?.querySelector("#reels-scroll");
  if (!state.feed) return;
  const cards = [...state.feed.querySelectorAll(".reels-card")];
  if (!cards.length) return;
  state.observer = new IntersectionObserver(items => {
    if (!state.open || state.screen !== "feed") return;
    let best = null;
    for (const row of items) if (row.isIntersecting && (!best || row.intersectionRatio > best.intersectionRatio)) best = row;
    if (best && best.intersectionRatio > .55) activate(best.target);
  }, { root: state.feed, threshold: [.25,.55,.75,.95] });
  cards.forEach(card => state.observer.observe(card));
  activate(cards[0]);
}
function feedHtml() {
  state.currentList = uniqueFeed(state.own, state.shared, state.user?.id, state.selected);
  const emptyMessage = state.selected === "mine"
    ? "Suas lembranças aparecerão aqui depois que você guardar fotos, vídeos ou GIFs."
    : "Um espaço para os momentos que vocês escolherem compartilhar.";
  return '<div class="reels-topbar"><button type="button" data-reels-close aria-label="Voltar ao Nosso Canto">‹ <span>Voltar</span></button><div class="reels-logo">entre nós<span>·</span> momentos</div><span aria-hidden="true" class="reels-topbar-end"></span></div>' +
    '<div class="reels-navline"><div role="group" aria-label="Escolha as memórias do feed"><button data-reels-filter="shared" aria-pressed="' + (state.selected === "shared") + '">Para nós</button><button data-reels-filter="mine" aria-pressed="' + (state.selected === "mine") + '">Minhas</button></div><button class="reels-add" data-reels-compose>＋ Publicar</button></div>' +
    '<div id="reels-scroll" class="reels-scroll" tabindex="0" aria-label="Feed de momentos, deslize para ver o próximo">' +
    (state.currentList.length ? state.currentList.map(renderCard).join("") :
    '<div class="reels-empty"><span>✧</span><h2>Algumas memórias merecem um lugar só delas.</h2><p>' + emptyMessage + '</p><button type="button" data-reels-compose>Guardar o primeiro momento</button></div>') +
    '</div>';
}
function composeHtml() {
  const storageEnabled = Boolean(config.FIREBASE_STORAGE_BUCKET);
  const mediaHelp = storageEnabled
    ? "JPG, PNG, WebP até 12 MB · GIF até 8 MB · MP4 e WebM até 24 MB"
    : "JPG, PNG e WebP até 12 MB · Vídeos e GIFs temporariamente indisponíveis";
  const mediaLabel = storageEnabled ? "foto, vídeo ou GIF" : "foto";
  const accept = storageEnabled
    ? "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
    : "image/jpeg,image/png,image/webp";
  return '<dialog id="reels-compose" class="reels-compose"><form id="reels-post-form">' +
    '<div class="reels-compose-head"><span>CRIAR UMA MEMÓRIA</span><button type="button" data-reels-cancel aria-label="Fechar">×</button></div>' +
    '<h2>Um instante<br><em>para guardar.</em></h2><p>' + (storageEnabled ? "Uma foto, um vídeo curto ou uma animação." : "Uma foto especial para guardar.") + ' Aqui cada detalhe tem história.</p>' +
    '<label class="reels-upload-area">+ Escolher ' + mediaLabel + '<input required type="file" name="media" accept="' + accept + '"></label>' +
    '<div id="reels-file-preview" aria-live="polite">' + mediaHelp + '</div>' +
    '<label class="reels-field">Legenda<textarea name="caption" maxlength="280" rows="3" placeholder="O que essa lembrança significa para você?"></textarea></label>' +
    '<p class="reels-sharing-note">Esta lembrança será compartilhada automaticamente no espaço de vocês dois.</p>' +
    '<button class="reels-primary" type="submit">Publicar lembrança</button><p id="reels-upload-status" role="status"></p>' +
    '</form></dialog>';
}
function render() {
  if (!state.root || !state.open) return;
  const oldIndex = state.active ? Number(state.active.dataset.reelsIndex || 0) : 0;
  clearMedia();
  state.root.innerHTML = '<div class="reels-frame">' + feedHtml() + '</div>' + composeHtml();
  observeFeed();
  if (oldIndex > 0 && state.currentList[oldIndex]) state.feed.scrollTop = oldIndex * state.feed.clientHeight;
}
function userId() { return state.user?.id; }
function open() {
  if (!userId() || !state.root || state.open) return;
  state.open = true;
  state.screen = "feed";
  state.root.hidden = false;
  document.body.classList.add("reels-active");
  render();
}
function close() {
  clearMedia();
  state.open = false;
  state.root.hidden = true;
  document.body.classList.remove("reels-active");
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = "";
}
function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem("nc-reels-likes:" + userId()) || "[]");
    state.favorites = new Set(Array.isArray(stored) ? stored.filter(x => typeof x === "string") : []);
  } catch { state.favorites = new Set(); }
}
async function removePost(item) {
  if (!canEditPost(item, userId()) || item.type !== "reel") return;
  if (!window.confirm("Apagar esta publicação do feed? Essa ação não pode ser desfeita.")) return;
  try {
    // Delete the protected file before its record to avoid silent orphaned media.
    if (item.storagePath) await deleteObject(fileRef(storage(), item.storagePath));
    await deleteDoc(doc(getFirestore(getApp()), "spaces", SPACE_ID, "entries", item.id));
  } catch {
    window.alert("Não foi possível remover a publicação.");
  }
}
function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
async function scaledJpeg(file, size, maxBytes) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [.82,.73,.64,.54]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob?.size && blob.size <= maxBytes) return blob;
  }
  if (size >= 960) return scaledJpeg(file, 720, maxBytes);
  throw new Error("A foto é grande demais para este formato. Escolha outra imagem.");
}
async function submitPost(form) {
  if (state.loading || !userId()) return;
  const file = form.querySelector('input[type="file"]')?.files?.[0];
  const status = form.querySelector("#reels-upload-status");
  const button = form.querySelector('[type="submit"]');
  let info;
  try { info = identifyMedia(file); } catch (err) { status.textContent = err.message; return; }
  state.loading = true;
  button.disabled = true;
  status.textContent = "Preparando sua lembrança…";
  const shared = true;
  const db = getFirestore(getApp());
  const target = doc(collection(db, "spaces", SPACE_ID, "entries"));
  const now = new Date().toISOString();
  let storagePath = "";
  try {
    if (!navigator.onLine) throw new Error("Conecte-se à internet para publicar nos dois aparelhos.");
    const post = {
      id: target.id, type: "reel", mediaKind: info.kind,
      title: String(form.elements.caption.value || "").trim().slice(0, 280),
      authorId: userId(), authorSnapshot: { name: state.profile.self, avatarData: state.profile.avatarData },
      created: now, date: now.slice(0, 10), shared, source: "upload",
      updatedAt: serverTimestamp()
    };
    if (info.kind === "photo") {
      const jpeg = await scaledJpeg(file, 1280, 550000);
      post.mediaData = await toDataUrl(jpeg);
      if (post.mediaData.length > 780000) throw new Error("Não foi possível compactar esta foto.");
    } else {
      if (!config.FIREBASE_STORAGE_BUCKET)
        throw new Error("Vídeos e GIFs exigem ativação do Firebase Storage. Fotos já podem ser publicadas.");
      storagePath = "reels/" + userId() + "/" + target.id + "." + info.ext;
      status.textContent = "Enviando arquivo com segurança…";
      await uploadBytes(fileRef(storage(), storagePath), file, {
        contentType: file.type,
        customMetadata: { authorId: userId(), shared: String(shared) }
      });
      post.storagePath = storagePath;
    }
    await setDoc(target, post);
    form.closest("dialog")?.close();
    state.selected = shared ? "shared" : "mine";
    render();
  } catch (err) {
    if (storagePath) await deleteObject(fileRef(storage(), storagePath)).catch(() => {});
    status.textContent = err?.message || "Não foi possível publicar. Tente novamente.";
  } finally {
    state.loading = false;
    button.disabled = false;
  }
}
function onClick(event) {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.matches("[data-reels-close]")) { close(); return; }
  if (b.matches("[data-reels-filter]")) { state.selected = b.dataset.reelsFilter; render(); return; }
  if (b.matches("[data-reels-compose]")) { state.root.querySelector("#reels-compose")?.showModal(); return; }
  if (b.matches("[data-reels-cancel]")) { state.root.querySelector("#reels-compose")?.close(); return; }
  const id = b.dataset.reelsFav || b.dataset.reelsDelete || b.dataset.reelsSound;
  if (!id) return;
  const item = state.currentList.find(x => x.id === id);
  if (!item) return;
  if (b.hasAttribute("data-reels-fav")) {
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    try { localStorage.setItem("nc-reels-likes:" + userId(), JSON.stringify([...state.favorites])); } catch {}
    b.setAttribute("aria-pressed", String(state.favorites.has(id)));
    b.querySelector("span").textContent = state.favorites.has(id) ? "♥" : "♡";
  } else if (b.hasAttribute("data-reels-delete")) void removePost(item);
  else if (b.hasAttribute("data-reels-sound")) {
    const card = b.closest(".reels-card");
    const video = card?.querySelector("video");
    if (video) { video.muted = !video.muted; b.querySelector("small").textContent = video.muted ? "Som" : "Mudo"; }
  }
}
async function onChange(event) {
  if (event.target?.name === "media" && event.target.files?.[0]) {
    const node = state.root.querySelector("#reels-file-preview");
    try {
      const info = identifyMedia(event.target.files[0]);
      node.textContent = event.target.files[0].name + " · " + (info.kind === "video" ? "vídeo" : info.kind === "gif" ? "animação" : "foto");
      if (info.kind !== "photo" && !config.FIREBASE_STORAGE_BUCKET)
        node.textContent += " — armazenamento de vídeos/GIFs ainda não ativado";
    } catch(err) { node.textContent = err.message; }
  }
}
function onSubmit(event) {
  if (event.target?.id === "reels-post-form") {
    event.preventDefault();
    void submitPost(event.target);
  }
}
function install() {
  state.root = document.getElementById("reelsRoot");
  if (!state.root) return;
  state.root.addEventListener("click", onClick);
  state.root.addEventListener("submit", onSubmit);
  state.root.addEventListener("change", e => void onChange(e));
  state.root.addEventListener("click", e => {
    if (e.target?.matches?.(".reels-video")) {
      const v = e.target;
      if (v.paused) void v.play().catch(() => {}); else v.pause();
    }
  });
  document.addEventListener("click", event => {
    if (event.target.closest("[data-reels-open]")) {
      event.preventDefault();
      if (!document.querySelector("#privateApp")?.hidden) open();
    }
  });
  document.addEventListener("visibilitychange", () => {
    const video = state.active?.querySelector("video");
    if (!video) return;
    if (document.visibilityState !== "visible") video.pause();
  });
  document.addEventListener("keydown", event => {
    if (!state.open || state.screen !== "feed" || !state.feed || event.target.closest("input,textarea,dialog")) return;
    if (event.key === "Escape") { close(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      state.feed.scrollBy({ top: (event.key === "ArrowDown" ? 1 : -1) * state.feed.clientHeight, behavior: "smooth" });
    }
  });
}
let installed = false;
export function mountReels(user, options = {}) {
  if (!user?.id || options.localOnly) return;
  state.user = user;
  state.profile = cleanProfile({ self: user.user_metadata?.full_name || "Você" });
  loadFavorites();
  if (!installed) { install(); installed = true; }
  const db = getFirestore(getApp());
  const coll = collection(db, "spaces", SPACE_ID, "entries");
  const ownMap = new Map(), sharedMap = new Map();
  const update = () => {
    state.own = [...ownMap.values()];
    state.shared = [...sharedMap.values()];
    if (state.open && state.screen === "feed") render();
  };
  state.unsub.push(onSnapshot(query(coll, where("authorId", "==", user.id)),
    snapshot => { ownMap.clear(); snapshot.docs.forEach(d => ownMap.set(d.id, { ...d.data(), id: d.id })); update(); },
    () => { if (state.open) state.root.querySelector(".reels-empty p")?.replaceChildren("Não foi possível carregar suas memórias."); }));
  state.unsub.push(onSnapshot(query(coll, where("shared", "==", true)),
    snapshot => { sharedMap.clear(); snapshot.docs.forEach(d => sharedMap.set(d.id, { ...d.data(), id: d.id })); update(); },
    () => { if (state.open) state.root.querySelector(".reels-empty p")?.replaceChildren("A sincronização entre vocês está indisponível."); }));
  state.unsub.push(onSnapshot(doc(db, "spaces", SPACE_ID, "profiles", user.id),
    snapshot => { if (snapshot.exists()) { state.profile = cleanProfile(snapshot.data()); if (state.open) render(); } },
    () => {}));
}


