import { auth } from "./auth.js";
import { safe } from "./utils.js";
import { TOPIC_BY_ID, topicsForProfile } from "./universe-topics.js";
import { getApp } from "@firebase/app";
import { getFirestore, collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from "@firebase/firestore";

const TYPES = ["news", "videos", "music", "quotes"];
const KIND_TITLES = { news: "Notícias", videos: "Vídeos", music: "Músicas", quotes: "Frases" };
const QUOTES = [
  { topic: "bts", title: "Existem melodias que se tornam lugares para voltar.", source: "Pensamento original" },
  { topic: "bts", title: "O que nos inspira também faz parte de quem somos.", source: "Pensamento original" },
  { topic: "ballet", title: "A leveza nasce de uma força que ninguém vê.", source: "Pensamento original" },
  { topic: "ballet", title: "Cada movimento pode contar uma história inteira.", source: "Pensamento original" }
];
const state = {
  topic: "all", kind: "all", search: "", items: {}, errors: {}, busy: false,
  favorites: new Map(), stop: null, stopProfile: null, user: null, open: false, initialized: false,
  topics: [], pendingReload: false
};
let root;
const text = (value) => safe(String(value == null ? "" : value));
function validLink(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "#";
  } catch { return "#"; }
}
function saveId(item) {
  // A stable, safe, deterministic ID for Firestore documents.
  const raw = state.user + "|" + item.id + "|" + item.topic;
  let hash = 2166136261;
  for (const char of raw) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return "u_" + (hash >>> 0).toString(36);
}
const localKey = () => "nc-universe:" + (state.user || "local");
function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(localKey()) || "[]");
    return new Map((Array.isArray(saved) ? saved : []).filter(i => i && typeof i.id === "string").map(i => [i.id, i]));
  } catch { return new Map(); }
}
function writeLocal() {
  localStorage.setItem(localKey(), JSON.stringify([...state.favorites.values()]));
}
function card(item, saved = false) {
  const isSaved = state.favorites.has(item.id);
  const target = validLink(item.url);
  const topic = TOPIC_BY_ID[item.topic]?.label || "Seu interesse";
  const category = KIND_TITLES[item.kind] || "Conteúdo";
  const photo = item.thumbnail && validLink(item.thumbnail) !== "#" ?
    '<div class="universe-card-image"><img loading="lazy" alt="" referrerpolicy="no-referrer" src="' + text(item.thumbnail) + '"></div>' : "";
  return '<article class="universe-card ' + (item.kind === "quotes" ? 'universe-quote-card' : '') + '">' +
    photo + '<div class="universe-card-body"><div class="universe-metadata"><span>' + topic + '</span><span>• ' + category + '</span></div>' +
    '<h3>' + text(item.title) + '</h3>' +
    '<p class="universe-source">' + text(item.source || "Conteúdo selecionado") + '</p>' +
    '<div class="universe-card-actions">' +
    (target !== "#" ? '<a target="_blank" rel="noopener noreferrer" href="' + text(target) + '">Ver na fonte ↗</a>' : '<span class="universe-original">Para guardar com carinho</span>') +
    '<button type="button" data-universe-save="' + text(item.id) + '" aria-pressed="' + isSaved + '" aria-label="' + (isSaved ? 'Remover dos favoritos' : 'Salvar nos favoritos') + '">' +
    (isSaved ? '♥ Salvo' : '♡ Salvar') + '</button></div></div></article>';
}
function allItems() {
  const collected = [...QUOTES.filter(q => state.topics.includes(q.topic)).map((q, i) => ({
    id: "quote:" + i, topic: q.topic, kind: "quotes", ...q, url: ""
  }))];
  for (const topic of state.topics) for (const kind of TYPES.slice(0, 3))
    collected.push(...(state.items[topic + ":" + kind] || []));
  return collected;
}
function visibleItems() {
  const base = state.kind === "saved" ? [...state.favorites.values()] : allItems();
  const term = state.search.trim().toLocaleLowerCase("pt-BR");
  return base.filter(item =>
    state.topics.includes(item.topic) &&
    (state.topic === "all" || item.topic === state.topic) &&
    (state.kind === "all" || state.kind === "saved" || item.kind === state.kind) &&
    (!term || [item.title, item.source, item.subtitle].some(x => String(x || "").toLocaleLowerCase("pt-BR").includes(term)))
  ).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}
function renderTopics() {
  if (!root) return;
  const holder = root.querySelector(".universe-topic-pills");
  if (holder) holder.innerHTML =
    '<button type="button" data-universe-topic="all" aria-pressed="true">✧ Tudo</button>' +
    state.topics.map(id => {
      const topic = TOPIC_BY_ID[id];
      return topic ? '<button type="button" data-universe-topic="' + text(id) + '" aria-pressed="false">' +
        text(topic.icon) + ' ' + text(topic.label) + '</button>' : '';
    }).join("");
  const caption = root.querySelector("#universe-caption");
  if (caption) caption.textContent = state.topics.length ?
    state.topics.slice(0, 2).map(id => TOPIC_BY_ID[id]?.label).filter(Boolean).join(" & ") :
    "um lugar só seu";
}
function renderCards() {
  if (!root) return;
  const output = root.querySelector("#universe-results");
  if (!output) return;
  const entries = visibleItems();
  output.innerHTML = !state.topics.length ?
    '<div class="universe-empty"><span aria-hidden="true">✧</span><h3>O que inspira você?</h3>' +
      '<p>Escolha seus assuntos preferidos no Meu cantinho. Este feed é exclusivo do seu perfil.</p>' +
      '<button type="button" data-universe-settings class="universe-configure-button">Escolher meus temas</button></div>' :
    entries.length ?
      '<div class="universe-grid">' + entries.map(x => card(x)).join("") + '</div>' :
      '<div class="universe-empty"><span aria-hidden="true">✧</span><h3>Suas descobertas estão a caminho.</h3>' +
      '<p>Experimente outra categoria ou atualize novamente.</p></div>';
  root.querySelector("#universe-count").textContent = entries.length + (entries.length === 1 ? " descoberta" : " descobertas");
  root.querySelector("#universe-status").textContent = !state.topics.length ?
    "Escolha assuntos em Meu cantinho" : state.busy ? "Atualizando fontes…" :
    Object.keys(state.errors).length ? "Algumas fontes estão indisponíveis. Os outros conteúdos continuam acessíveis." :
    "Recomendações do seu perfil • fontes públicas";
  root.querySelectorAll("[data-universe-topic]").forEach(node =>
    node.setAttribute("aria-pressed", String(node.dataset.universeTopic === state.topic)));
  root.querySelectorAll("[data-universe-kind]").forEach(node =>
    node.setAttribute("aria-pressed", String(node.dataset.universeKind === state.kind)));
}
function initialView() {
  if (!root) {
    root = document.createElement("section");
    root.id = "universeView";
    root.className = "universe-view";
    root.setAttribute("aria-label", "Meu Universo");
    root.hidden = true;
    document.querySelector("#app")?.insertAdjacentElement("afterend", root);
  }
  root.innerHTML = '<div class="universe-shell">' +
    '<div class="universe-topline"><span>ENTRE NÓS  /  MEU UNIVERSO</span><span class="universe-star">✦</span></div>' +
    '<header class="universe-hero"><div class="universe-hero-content"><span class="universe-eyebrow">UM LUGAR PARA TUDO O QUE TE INSPIRA</span>' +
    '<h1>Seu universo,<br><em>seu jeito.</em></h1><p>Descubra notícias, músicas e histórias sobre os assuntos que você escolher. Este espaço pertence ao seu perfil.</p>' +
    '<div class="universe-hero-decor" aria-hidden="true">✧  ♡  ✧</div></div>' +
    '<div class="universe-art" aria-hidden="true"><span class="universe-art-circle"></span><span class="universe-art-note">♪</span><span class="universe-art-flower">✿</span><span id="universe-caption" class="universe-art-caption">um lugar só seu</span></div></header>' +
    '<section class="universe-controls"><div class="universe-control-heading"><div><span class="universe-eyebrow">SUAS DESCOBERTAS</span><h2>Suas descobertas</h2></div><div class="universe-heading-actions"><button type="button" data-universe-settings>Editar meus temas</button><button type="button" id="universe-refresh">↻ Atualizar</button></div></div>' +
    '<div class="universe-topic-pills" role="group" aria-label="Interesses">' +
    '<button data-universe-topic="all" aria-pressed="true">✧ Tudo</button></div>' +
    '<div class="universe-toolbar"><div class="universe-kind-pills" role="group" aria-label="Tipo de conteúdo">' +
    '<button data-universe-kind="all" aria-pressed="true">Para você</button>' +
    '<button data-universe-kind="news" aria-pressed="false">Notícias</button>' +
    '<button data-universe-kind="videos" aria-pressed="false">Vídeos</button>' +
    '<button data-universe-kind="music" aria-pressed="false">Músicas</button>' +
    '<button data-universe-kind="quotes" aria-pressed="false">Frases</button>' +
    '<button data-universe-kind="saved" aria-pressed="false">♥ Salvos</button></div>' +
    '<label class="universe-search-label"><span class="sr-only">Buscar conteúdo</span><input id="universe-search" type="search" placeholder="Buscar descobertas…" autocomplete="off" maxlength="100"></label></div>' +
    '<div class="universe-list-heading"><span id="universe-count">0 descobertas</span><span id="universe-status" role="status" aria-live="polite"></span></div>' +
    '<div id="universe-results" aria-live="polite"></div></section>' +
    '<footer class="universe-footnote">Feito para descobrir, sentir e compartilhar. ♡<br><small>Links para plataformas originais; o aplicativo não reproduz músicas protegidas.</small></footer></div>';
  root.addEventListener("click", handleClick);
  root.querySelector("#universe-search").addEventListener("input", e => {
    state.search = e.target.value;
    renderCards();
  });
  renderTopics();
  renderCards();
}
async function connectFavorites() {
  let data = null;
  try { ({ data } = await auth?.auth?.getSession?.() || {}); } catch {}
  const uid = data?.session?.user?.id || null;
  if (state.user !== uid) {
    state.stop?.();
    state.stopProfile?.();
    state.stop = null;
    state.stopProfile = null;
    state.user = uid;
    state.topics = [];
    state.topic = "all";
    state.kind = "all";
    state.items = {};
    state.errors = {};
    state.initialized = false;
    state.favorites = readLocal();
    renderTopics();
    renderCards();
  }
  if (!uid || !navigator.onLine || state.stopProfile) return;
  try {
    const db = getFirestore(getApp());
    const records = collection(db, "spaces", "nosso-canto", "entries");
    state.stop = onSnapshot(query(records, where("authorId", "==", uid)), snapshot => {
      const fav = new Map();
      for (const item of snapshot.docs) {
        const value = item.data();
        if (value.type === "universe" && value.item?.id) fav.set(value.item.id, value.item);
      }
      state.favorites = fav;
      try { writeLocal(); } catch {}
      renderCards();
    }, () => {
      root.querySelector("#universe-status").textContent = "Favoritos locais disponíveis; sincronização indisponível.";
    });
    state.stopProfile = onSnapshot(doc(db, "spaces", "nosso-canto", "profiles", uid), snapshot => {
      const next = topicsForProfile(snapshot.data() || {});
      if (JSON.stringify(next) !== JSON.stringify(state.topics)) {
        state.topics = next;
        state.topic = "all";
        state.items = {};
        state.errors = {};
        state.initialized = false;
        renderTopics();
        renderCards();
        void loadAll(true);
      } else {
        renderTopics();
        renderCards();
      }
    }, () => {
      root.querySelector("#universe-status").textContent = "Não foi possível consultar seus interesses. Abra Meu cantinho.";
    });
  } catch {
    root.querySelector("#universe-status").textContent = "Não foi possível conectar seu perfil. Tente novamente.";
  }
}
async function toggleFavorite(id) {
  const item = [...allItems(), ...state.favorites.values()].find(i => i.id === id);
  if (!item) return;
  const previous = new Map(state.favorites);
  const saving = !state.favorites.has(id);
  if (saving) state.favorites.set(id, item); else state.favorites.delete(id);
  try { writeLocal(); } catch {
    state.favorites = previous;
    root.querySelector("#universe-status").textContent = "Não foi possível salvar neste aparelho.";
    renderCards();
    return;
  }
  renderCards();
  if (!state.user) return;
  try {
    if (!navigator.onLine) throw new Error("offline");
    const db = getFirestore(getApp());
    const document = doc(db, "spaces", "nosso-canto", "entries", saveId(item));
    if (saving) {
      await setDoc(document, { id: saveId(item), type: "universe",
        authorId: state.user, shared: false, item, date: new Date().toISOString(), updatedAt: serverTimestamp() });
    } else {
      await deleteDoc(document);
    }
  } catch {
    state.favorites = previous;
    try { writeLocal(); } catch {}
    renderCards();
    root.querySelector("#universe-status").textContent = "Não foi possível sincronizar. A alteração foi desfeita.";
  }
}
function closeUniverse() {
  state.open = false;
  if (root) root.hidden = true;
  const app = document.querySelector("#app");
  if (app) app.hidden = false;
  document.querySelectorAll("[data-universe-open]").forEach(b => b.classList.remove("active"));
}
function handleClick(event) {
  if (event.target.closest("[data-universe-settings]")) {
    closeUniverse();
    document.querySelector('[data-nav="ajustes"]')?.click();
    return;
  }
  const topic = event.target.closest("[data-universe-topic]");
  if (topic) { state.topic = topic.dataset.universeTopic; renderCards(); return; }
  const kind = event.target.closest("[data-universe-kind]");
  if (kind) { state.kind = kind.dataset.universeKind; renderCards(); return; }
  const save = event.target.closest("[data-universe-save]");
  if (save) { void toggleFavorite(save.dataset.universeSave); return; }
  if (event.target.closest("#universe-refresh")) void loadAll(true);
}
async function loadAll(force = false) {
  if (!state.topics.length) {
    state.items = {};
    state.errors = {};
    state.initialized = false;
    renderCards();
    return;
  }
  if (state.busy) { state.pendingReload = true; return; }
  if (!force && state.initialized) { renderCards(); return; }
  state.busy = true;
  state.errors = {};
  const requestedTopics = [...state.topics];
  renderCards();
  const kinds = ["news", "videos", "music"];
  const requests = requestedTopics.flatMap(topic => kinds.map(async kind => {
    const key = topic + ":" + kind;
    try {
      const response = await fetch("/api/universe?topic=" + encodeURIComponent(topic) + "&kind=" + kind,
        { signal: AbortSignal.timeout(12000), credentials: "omit" });
      if (!response.ok) throw new Error("Fonte indisponível");
      const payload = await response.json();
      if (!Array.isArray(payload.items)) throw new Error("Resposta inválida");
      state.items[key] = payload.items.filter(item =>
        item && item.kind === kind && item.topic === topic && typeof item.id === "string" &&
        typeof item.title === "string" && validLink(item.url) !== "#").slice(0, 12);
    } catch {
      state.errors[key] = true;
      state.items[key] ||= [];
    }
  }));
  await Promise.all(requests);
  state.busy = false;
  state.initialized = true;
  renderCards();
  if (state.pendingReload || JSON.stringify(requestedTopics) !== JSON.stringify(state.topics)) {
    state.pendingReload = false;
    void loadAll(true);
  }
}
function open() {
  if (!state.initialized) void loadAll();
  const app = document.querySelector("#app");
  if (app) app.hidden = true;
  root.hidden = false;
  state.open = true;
  document.querySelectorAll("[data-universe-open]").forEach(b => b.classList.add("active"));
  document.querySelectorAll("[data-nav]").forEach(b => b.classList.remove("active"));
  root.querySelector("h1")?.setAttribute("tabindex", "-1");
  root.querySelector("h1")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-universe-open]")) {
    event.preventDefault();
    if (document.querySelector("#privateApp")?.hidden) return;
    if (!root) initialView();
    if (state.user === null && !state.stop) void connectFavorites().catch(() => {});
    open();
  } else if (event.target.closest("[data-nav],[data-reels-open]") && state.open) {
    closeUniverse();
  }
});

