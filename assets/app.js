import { connectionCards, initConnections } from "./connections.js";
import { logout } from "./auth.js";
import { safe, uid, localDay, displayDate, dateTime } from "./utils.js";
import { MOODS, LEGACY_MOODS, TIPS, PRESETS, TYPES } from "./catalog.js";
import { moodChoices, moodPortrait } from "./mood-view.js";
import {
  mediaPut,
  mediaGet,
  mediaDelete,
  mediaClear,
  compress,
  attachImages,
  setMediaUser,
} from "./media.js";
const $ = (s) => document.querySelector(s);
let STORE = null;
let accountUser = null;
let localOnly = false;
function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE));
    if (x && Array.isArray(x.entries))
      return {
        ...x,
        profile: {
          self: "Voc\u00ea",
          partner: "Seu amor",
          anniversary: "",
          ...(x.profile || {}),
        },
      };
  } catch {}
  return {
    profile: { self: "Voc\u00ea", partner: "Seu amor", anniversary: "" },
    entries: [],
  };
}
let data = {
    profile: { self: "Você", partner: "Seu amor", anniversary: "" },
    entries: [],
  },
  tab = "inicio",
  filter = "todos",
  calendarMonth = new Date().getMonth(),
  calendarYear = new Date().getFullYear(),
  selectedDay = localDay(),
  dialogType = "",
  dialogMeta = null,
  moodChoice = "",
  tipRemote = "";
function persist() {
  try {
    if (!STORE) throw new Error("Entre para salvar.");
    localStorage.setItem(STORE, JSON.stringify(data));
  } catch {
    data = load();
    throw new Error(
      "Não foi possível salvar. Exporte seus dados e libere espaço.",
    );
  }
}
function addRecord(record) {
  data.entries.push(record);
  persist();
}
function ownItems(type) {
  return data.entries
    .filter((e) => !type || e.type === type)
    .sort(
      (a, b) => new Date(b.date || b.created) - new Date(a.date || a.created),
    );
}
function latestMood(owner = "self") {
  return ownItems("mood").find(
    (e) => (e.owner || "self") === owner && e.date === localDay(),
  );
}
function moodInfo(id) {
  return (
    MOODS.find((x) => x.id === id) ||
    LEGACY_MOODS.find((x) => x.id === id) || {
      id: "unknown",
      name: "Humor registrado",
      sticker: "./assets/stickers/cat-tranquilo.svg",
    }
  );
}
function initial(name) {
  return (
    String(name || "V")
      .trim()
      .slice(0, 1)
      .toUpperCase() || "V"
  );
}
function announce() {
  const d = new Date();
  $("#topbarDate").textContent = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  $("#miniName").textContent = data.profile.self;
  $("#miniAvatar").textContent = initial(data.profile.self);
  $("#topAvatar").textContent = initial(data.profile.self);
  $("#modeBanner").innerHTML = localOnly
    ? '<span><strong>Modo local ativo:</strong> registros guardados somente neste dispositivo. Não há conta nem sincronização entre vocês.</span><button class="text-link" data-nav="ajustes">Entender</button>'
    : '<span><strong>Seu perfil neste aparelho:</strong> o login está ativo; os registros ainda não são sincronizados entre vocês.</span><button class="text-link" data-nav="ajustes">Meu perfil</button>';
}
function navigate(next) {
  if (
    ![
      "inicio",
      "humor",
      "diario",
      "calendario",
      "desafios",
      "memorias",
      "musicas",
      "ajustes",
    ].includes(next)
  )
    return;
  tab = next;
  filter = "todos";
  document.querySelectorAll("[data-nav]").forEach((b) => {
    const yes = b.dataset.nav === tab;
    b.classList.toggle("active", yes);
    if (yes) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  location.hash = next;
  render();
  $("#app").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function intro(kicker, title, description, button = "") {
  return `<div class="view-intro"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>${button}</div>`;
}
function sec(title, desc = "", action = "") {
  return `<div class="section-heading"><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div>${action}</div>`;
}
function empty(icon, title, desc, action = "") {
  return `<div class="empty-state ${action ? "" : "large-empty"}"><div class="empty-icon">${icon}</div><strong>${title}</strong><p>${desc}</p>${action}</div>`;
}
function timeTip() {
  const index = Math.floor(
    (new Date(localDay() + "T12:00:00") - new Date("2026-01-01T12:00:00")) /
      864e5,
  );
  return TIPS[((index % TIPS.length) + TIPS.length) % TIPS.length];
}
function partnerStatus() {
  const mine = latestMood("self");
  const theirs = latestMood("partner");
  const mineGraphic = mine
    ? moodPortrait(
        moodInfo(mine.mood),
        "cat-mood-avatar",
        moodInfo(mine.mood).name,
      )
    : "\u{1F90D}";
  const theirGraphic = theirs
    ? moodPortrait(
        moodInfo(theirs.mood),
        "cat-mood-avatar",
        moodInfo(theirs.mood).name,
      )
    : "\u{1F90D}";
  return `<div class="couple-list">
    <div class="person-line"><span class="person-avatar">${safe(initial(data.profile.self))}</span><div><strong>${safe(data.profile.self)}</strong><small>${mine ? displayDate(mine.date, { day: "2-digit", month: "short" }) : "Ainda sem registro"}</small></div><div class="person-right">${mineGraphic}</div></div>
    <div class="mini-divider"></div>
    <div class="person-line"><span class="person-avatar partner">${safe(initial(data.profile.partner))}</span><div><strong>${safe(data.profile.partner)}</strong><small>${theirs ? displayDate(theirs.date, { day: "2-digit", month: "short" }) : "Esperando conexão entre contas"}</small></div><div class="person-right">${theirGraphic}</div></div>
  </div>`;
}
function daysTogether() {
  if (!data.profile.anniversary) return null;
  const start = new Date(data.profile.anniversary + "T12:00:00");
  const now = new Date(localDay() + "T12:00:00");
  return Math.max(0, Math.floor((now - start) / 864e5));
}
function formatEntry(e, showPhoto = true) {
  const t = TYPES[e.type] || TYPES.message;
  const mood = e.type === "mood" ? moodInfo(e.mood) : null;
  const title =
    e.title || (mood ? "Me senti " + mood.name.toLowerCase() : t.label);
  const note = e.note || e.description || "";
  return `<article class="timeline-item"><span class="timeline-emoji ${mood ? "cat-timeline-emoji" : ""}" aria-hidden="true">${mood ? moodPortrait(mood, "cat-mood-thumb") : t.icon}</span><div class="timeline-body"><strong>${safe(title)}</strong> ${e.shared === false ? '<span class="tag neutral">Privado</span>' : ""}<small>${safe(e.owner === "partner" ? data.profile.partner : data.profile.self)} \u00b7 ${displayDate(e.date || e.created, { day: "2-digit", month: "short" })}${e.time ? " · " + safe(e.time) : ""}</small>${note ? `<p>${safe(note)}</p>` : ""}${e.type === "music" && e.url ? `<p><a class="text-link" href="${safe(validUrl(e.url))}" target="_blank" rel="noopener noreferrer">Ouvir a m\u00fasica \u2197</a></p>` : ""}${showPhoto && e.photoId ? `<img class="timeline-image" alt="Foto adicionada por voc\u00ea" data-photo="${safe(e.photoId)}">` : ""}</div><div class="timeline-actions"><button class="mini-action" data-delete="${safe(e.id)}" title="Apagar registro" aria-label="Apagar registro">\u2715</button></div></article>`;
}
function validUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "#";
  } catch {
    return "#";
  }
}
function renderHome() {
  const days = daysTogether(),
    moods = ownItems("mood").length,
    challenges = ownItems("challenge").length,
    media = ownItems("memory"),
    nextEvent = ownItems("event")
      .filter((e) => (e.date || "") >= localDay())
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  const recent = ownItems()
    .filter((e) => e.type !== "challenge")
    .slice(0, 3);
  return `
 ${intro("NOSSO PEQUENO UNIVERSO", `${new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite"}, ${safe(data.profile.self)} <span style="color:#bb798b">\u2661</span>`, "Que bom ter um espacinho onde a dist\u00e2ncia n\u00e3o precisa significar aus\u00eancia.", '<button class="btn btn-primary" data-open="message">\u2661 Deixar um carinho</button>')}
 <section class="quick-actions" aria-label="Registrar um momento">${[
   ["mood", "♡", "Meu humor"],
   ["meal", "♧", "Refeição"],
   ["event", "▦", "Um encontro"],
   ["memory", "✿", "Uma foto"],
   ["music", "♫", "Uma música"],
 ]
   .map(
     ([type, icon, label]) =>
       `<button data-open="${type}"><span aria-hidden="true">${icon}</span>${label}<span aria-hidden="true">＋</span></button>`,
   )
   .join("")}</section>
 <div class="grid dashboard-grid"><div class="stack">
  <section class="hero"><div><span class="hero-kicker">UM AMOR, DOIS LUGARES</span><h2 class="hero-title">Perto, mesmo <em>de longe.</em></h2><p class="hero-desc">Aqui cabem os detalhes do nosso dia, os sorrisos inesperados e as pequenas saudades.</p></div><div class="hero-actions"><button class="btn btn-white" data-open="mood">Como est\u00e1 meu cora\u00e7\u00e3o?</button><span class="hero-tag">\u2661 Sempre juntos</span></div></section>
  <div class="stat-strip"><div class="stat-pill"><strong>${days === null ? "\u221e" : days}</strong><small>${days === null ? "Dias para contar" : "Dias de hist\u00f3ria"}</small></div><div class="stat-pill"><strong>${moods}</strong><small>Humores registrados</small></div><div class="stat-pill"><strong>${challenges}</strong><small>Desafios propostos</small></div></div>
  <section class="paper-card">${sec("Nosso dia a dia", "Pequenos registros transformam dias em mem\u00f3rias.", `<button class="text-link" data-nav="diario">Ver tudo \u2192</button>`)}${recent.length ? `<div class="timeline-list">${recent.map((e) => formatEntry(e, false)).join("")}</div>` : empty("\u{1F4EE}", "Comecem por um pequeno detalhe", "Registre o que sentiu, o que comeu ou algo bonito que aconteceu hoje.", '<button class="btn btn-soft" data-open="meal">Contar sobre meu dia</button>')}</section>
  <section class="paper-card">${sec("Pr\u00f3ximos momentos", "Um encontro, uma chamada ou um compromisso especial.", '<button class="text-link" data-nav="calendario">Abrir agenda \u2192</button>')}${nextEvent ? `<div class="soft-highlight row-between"><div><span class="eyebrow">EST\u00c1 CHEGANDO</span><h3 style="margin:0 0 7px;font-size:17px">${safe(nextEvent.title)}</h3><span class="small muted">${displayDate(nextEvent.date, { weekday: "long", day: "numeric", month: "long" })}</span></div><span class="app-icon">\u{1F48C}</span></div>` : empty("\u{1F4C6}", "Planejem um momento a dois", "Marquem uma chamada, um jantar virtual ou o pr\u00f3ximo encontro.", '<button class="btn btn-soft" data-open="event">Adicionar um momento</button>')}</section>
 </div><div class="stack">
  <section class="paper-card">${sec("Como estamos hoje", "Um check-in sem cobran\u00e7as.")}${partnerStatus()}<div style="margin-top:17px"><button class="btn btn-soft" data-open="mood">Registrar meu humor \u2192</button></div></section>
  <section class="paper-card">${sec("E voc\u00ea, como se sente?", "Escolha seu gatinho do dia.", '<button class="text-link" data-nav="humor">Ver todos →</button>')}${moodChoices("", "preview")}<p class="mood-note">N\u00e3o existe sentimento errado. Escolha a figurinha que combina com o agora.</p></section>
  <section class="paper-card daily-tip"><span class="tip-badge">\u2727 UM CARINHO POR DIA</span><p class="tip-text">\u201c${safe(timeTip())}\u201d</p><span class="tip-foot">Uma ideia simples para se conectar hoje.</span><div style="margin-top:13px"><button class="btn btn-small btn-white" type="button" data-surprise>Conselho surpresa (API)</button><p class="small muted" id="externalTip" aria-live="polite" style="margin:10px 0 0"></p></div></section>
  <section class="paper-card">${sec("Nossas mem\u00f3rias", "Fotografias que aquecem a saudade.", `<button class="text-link" data-nav="memorias">Ver fotos \u2192</button>`)}${
    media.length
      ? `<div class="photo-grid">${media
          .slice(0, 3)
          .map(
            (e) =>
              `<div class="memory-tile"><img data-photo="${safe(e.photoId)}" alt="Mem\u00f3ria de ${safe(data.profile.self)}"></div>`,
          )
          .join("")}</div>`
      : empty(
          "\u{1F4F7}",
          "Guardem o primeiro instante",
          "Adicionem uma foto significativa e come\u00e7em o \u00e1lbum de voc\u00eas.",
          '<button class="btn btn-soft" data-open="memory">Adicionar foto</button>',
        )
  }</section>
 </div></div>`;
}
function renderMoodScreen() {
  const latest = latestMood("self");
  const latestInfo = latest ? moodInfo(latest.mood) : null;
  const current = MOODS.find((m) => m.id === moodChoice);
  return `${intro("NOSSO HUMOR DO DIA", "Como está seu coração hoje?", "Escolha a figurinha de gatinho que mais combina com você agora. Você pode contar um pouquinho sobre o seu dia, se quiser.")}
  <section class="cat-mood-page" aria-label="Registro de humor">
    <div class="cat-mood-top">
      <div><span class="eyebrow">PEQUENOS SENTIMENTOS, GRANDES HISTÓRIAS</span><h2>Um gatinho para cada sentimento.</h2><p>Todo humor merece acolhimento. Escolha sem pressa e registre apenas aquilo que quiser compartilhar.</p></div>
      <span class="cat-mood-top-note">♡ Um carinho por dia</span>
    </div>
    <div class="cat-mood-layout">
      <div class="cat-mood-main"><p class="cat-mood-subheading">ESCOLHA SUA FIGURINHA</p>${moodChoices(moodChoice, "full")}</div>
      <aside class="cat-mood-side">
        <form id="moodInlineForm" class="cat-mood-capture">
          <span class="eyebrow">SEU REGISTRO</span>
          <h3>Guardar esse momento ♡</h3>
          <p id="moodChosen" aria-live="polite">${current ? current.name + ": " + current.phrase : "Primeiro, escolha um gatinho que combine com você."}</p>
          <label for="moodNote">Quer contar mais? <span class="muted">(opcional)</span></label>
          <textarea id="moodNote" name="note" rows="3" maxlength="1500" placeholder="O que fez você se sentir assim?"></textarea>
          <label for="moodDate">Dia do registro</label>
          <input type="date" id="moodDate" name="date" value="${localDay()}" required>
          <label class="cat-mood-toggle" for="moodShared">
            <input type="checkbox" id="moodShared" name="shared">
            Compartilhar com meu amor quando a sincronização estiver ativa
          </label>
          <button type="submit" class="cat-mood-save" id="inlineSaveMood" ${current ? "" : "disabled"}>Salvar meu humor ♡</button>
          <p id="moodInlineFeedback" class="cat-mood-feedback" role="status" aria-live="polite"></p>
          <div class="cat-mood-latest">
            <div class="cat-mood-latest-header">SEU ÚLTIMO REGISTRO DE HOJE</div>
            ${latestInfo ? `<div class="cat-mood-last-row">${moodPortrait(latestInfo)}<div><strong>${safe(latestInfo.name)}</strong><small>${displayDate(latest.date, { day: "2-digit", month: "long" })}</small></div></div>` : "<p>Ainda não há registro de humor hoje. Seu primeiro gatinho está esperando!</p>"}
          </div>
        </form>
      </aside>
    </div>
  </section>`;
}
function renderJournal() {
  const tags = [
    "todos",
    "mood",
    "meal",
    "event",
    "message",
    "memory",
    "music",
    "proof",
  ];
  const labels = {
    todos: "Tudo",
    mood: "Humor",
    meal: "Comidas",
    event: "Agenda",
    message: "Cartinhas",
    memory: "Fotos",
    music: "M\u00fasicas",
    proof: "Miss\u00f5es",
  };
  const list = ownItems().filter(
    (e) => e.type !== "challenge" && (filter === "todos" || filter === e.type),
  );
  return `${intro("PEQUENOS ACONTECIMENTOS", "Nosso dia a dia", "O que voc\u00eas viveram n\u00e3o precisa se perder. Guarde aqui cada detalhe.", '<button class="btn btn-primary" data-open="meal">+ Novo registro</button>')}
 <div class="type-filters">${tags.map((t) => `<button class="filter-chip ${filter === t ? "active" : ""}" data-filter="${t}" aria-pressed="${filter === t}">${labels[t]}</button>`).join("")}</div>
 <div class="two-col"><div class="stack"><section class="paper-card">${sec("Registrar um momento", "Escolha o que combina com o seu dia.")}<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">${[
   ["mood", "\u{1F970}", "Meu humor"],
   ["meal", "\u{1F37D}", "O que comi"],
   ["message", "\u{1F48C}", "Uma cartinha"],
   ["music", "\u{1F3B5}", "Uma m\u00fasica"],
 ]
   .map(
     ([k, icon, l]) =>
       `<button class="btn btn-line" data-open="${k}"><span style="font-size:19px">${icon}</span>${l}</button>`,
   )
   .join(
     "",
   )}</div></section><section class="paper-card daily-tip"><span class="tip-badge">\u2661 UM LEMBRETE DELICADO</span><p class="tip-text">\u201cO cotidiano tamb\u00e9m \u00e9 uma forma de amor.\u201d</p></section></div>
 <section class="paper-card">${sec("Linha do tempo", `${list.length} registro(s) neste filtro.`)}${list.length ? `<div class="timeline-list">${list.map((e) => formatEntry(e)).join("")}</div>` : empty("\u2661", "Nada registrado por aqui", "Cada pequena coisa compartilhada conta uma hist\u00f3ria.", '<button class="btn btn-soft" data-open="mood">Fazer meu primeiro check-in</button>')}</section></div>`;
}
function calendarItems(day) {
  return ownItems().filter(
    (e) => (e.date || "").slice(0, 10) === day && e.type !== "challenge",
  );
}
function renderCalendar() {
  const first = new Date(calendarYear, calendarMonth, 1),
    pad = (first.getDay() + 6) % 7,
    last = new Date(calendarYear, calendarMonth + 1, 0).getDate(),
    cells = [];
  for (let i = 0; i < pad; i++) cells.push("<span></span>");
  for (let d = 1; d <= last; d++) {
    const day = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      events = calendarItems(day),
      dots = events
        .slice(0, 4)
        .map((e) => `<span class="cal-dot ${safe(e.type)}"></span>`)
        .join("");
    cells.push(
      `<button class="cal-cell ${day === localDay() ? "today" : ""} ${day === selectedDay ? "selected" : ""}" data-day="${day}" aria-label="${d} de ${first.toLocaleDateString("pt-BR", { month: "long" })}, ${events.length} registros">${d}<span class="cal-dots">${dots}</span></button>`,
    );
  }
  const chosen = calendarItems(selectedDay);
  return `${intro("TEMPO COMPARTILHADO", "Nosso calend\u00e1rio", "Organizem encontros, chamadas e compromissos. Nesta prévia, os registros ficam neste navegador.", '<button class="btn btn-primary" data-open="event">+ Adicionar evento</button>')}
 <div class="calendar-shell"><section class="paper-card"><div class="calendar-top"><h3>${first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3><div><button data-today>Hoje</button> <button data-calendar="prev" aria-label="M\u00eas anterior">\u2190</button> <button data-calendar="next" aria-label="Pr\u00f3ximo m\u00eas">\u2192</button></div></div><div class="cal-grid">${["Seg", "Ter", "Qua", "Qui", "Sex", "S\u00e1b", "Dom"].map((x) => `<span class="cal-label">${x}</span>`).join("")}${cells.join("")}</div><p class="mood-note">Os pontinhos mostram registros feitos em cada dia.</p></section><div class="stack"><section class="paper-card"><span class="eyebrow">O DIA ESCOLHIDO</span><h3 class="cal-side-date">${displayDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h3>${chosen.length ? `<div class="timeline-list">${chosen.map((e) => formatEntry(e, false)).join("")}</div>` : empty("\u2727", "Um dia para escrever", "Esse dia ainda n\u00e3o tem lembran\u00e7as.", '<button class="btn btn-soft" data-open="event">Adicionar ao dia</button>')}</section><div class="notice">Importe eventos escolhidos em Meu cantinho → Suas conexões. As cópias importadas não acompanham alterações posteriores no Google Agenda.</div></div></div>`;
}
function challengeCard(e) {
  const proofs = ownItems("proof").filter((p) => p.challengeId === e.id),
    mine = proofs.some((p) => p.owner === "self"),
    theirs = proofs.some((p) => p.owner === "partner");
  return `<article class="challenge-card"><span class="challenge-icon">${safe(e.emoji || "\u{1F49E}")}</span><h3>${safe(e.title)}</h3><p>${safe(e.description || "Um gesto simples para os dois compartilharem.")}</p><div class="challenge-bottom"><div style="display:flex;align-items:center;gap:6px"><span class="progress-dot ${mine ? "done" : ""}" title="${safe(data.profile.self)}"></span><span class="progress-dot ${theirs ? "done" : ""}" title="${safe(data.profile.partner)}"></span><span class="small muted">${Number(mine) + Number(theirs)}/2</span></div><button class="btn btn-small ${mine ? "btn-quiet" : "btn-primary"}" data-proof="${safe(e.id)}" ${mine ? "disabled" : ""}>${mine ? "Sua foto enviada" : "Enviar minha foto"}</button></div></article>`;
}
function renderChallenges() {
  const challenges = ownItems("challenge");
  return `${intro("PEQUENAS AVENTURAS", "Desafios para n\u00f3s dois", "Criem novos motivos para sorrir. Cada um envia uma foto do desafio quando quiser, sem press\u00e3o.", '<button class="btn btn-primary" data-open="challenge">+ Criar desafio</button>')}
 ${sec("Nossa lista", "Duas cidades, pequenos gestos de presen\u00e7a.")}<div class="challenge-list">${challenges.length ? challenges.map(challengeCard).join("") : empty("\u{1F49E}", "Ainda sem desafios", "Escolham um desafio da lista abaixo para come\u00e7ar.", "")}</div>
 <div style="height:27px"></div>${sec("Algumas ideias para come\u00e7ar", "O desafio s\u00f3 come\u00e7a quando voc\u00ea escolher.")}
 <div class="challenge-list">${PRESETS.map((p, i) => `<article class="challenge-card"><span class="challenge-icon">${p.emoji}</span><h3>${safe(p.title)}</h3><p>${safe(p.desc)}</p><div class="challenge-bottom"><span class="tag neutral">Sugest\u00e3o</span><button class="btn btn-small btn-soft" data-preset="${i}">Come\u00e7ar \u2192</button></div></article>`).join("")}</div>`;
}
function renderMemories() {
  const photos = ownItems("memory").filter((e) => e.photoId);
  const day = localDay().slice(5),
    thisDay = photos.filter(
      (e) =>
        e.date.slice(5) === day &&
        e.date.slice(0, 4) !== localDay().slice(0, 4),
    );
  return `${intro("FOTOS QUE ABRA\u00c7AM", "Nossas mem\u00f3rias", "Das fotografias mais antigas aos registros de hoje, todas t\u00eam um lugar especial.", '<button class="btn btn-primary" data-open="memory">+ Guardar uma foto</button>')}
 <div class="stack"><div class="notice">Google Fotos: por seguran\u00e7a, a API oficial s\u00f3 permite importar imagens que cada pessoa escolher. Selecione fotos do aparelho ou abra Meu cantinho → Suas conexões para importar fotos escolhidas no Google.</div>
 ${thisDay.length ? `<section class="paper-card">${sec("Neste dia, em outros anos", "Pequenos reencontros com o passado.")}<div class="photo-grid">${thisDay.map((e) => `<div class="memory-tile"><img data-photo="${safe(e.photoId)}" alt="Foto de ${safe(e.date)}"></div>`).join("")}</div></section>` : ""}
 <section class="paper-card">${sec("Nosso \u00e1lbum", `${photos.length} fotografia(s) guardada(s).`)}${photos.length ? `<div class="photo-grid">${photos.map((e) => `<div class="memory-tile"><img data-photo="${safe(e.photoId)}" alt="${safe(e.title || "Nossa mem\u00f3ria")}"><div class="photo-caption"><strong>${safe(e.title || "Nosso momento")}</strong><br>${displayDate(e.date, { day: "2-digit", month: "short", year: "numeric" })}</div><button class="photo-delete" data-delete="${safe(e.id)}" aria-label="Excluir foto">\u00d7</button></div>`).join("")}</div>` : empty("\u{1F4F7}", "O \u00e1lbum espera por voc\u00eas", "Que tal uma foto do primeiro encontro ou de um momento inesquec\u00edvel?", '<button class="btn btn-soft" data-open="memory">Adicionar nossa primeira foto</button>')}</section></div>`;
}
function renderMusic() {
  const tracks = ownItems("music");
  return `${intro("PLAYLIST DO CORA\u00c7\u00c3O", "Nossa trilha sonora", "As m\u00fasicas que lembram os dois, que marcaram momentos ou que voc\u00eas querem ouvir juntos.", '<button class="btn btn-primary" data-open="music">+ Adicionar m\u00fasica</button>')}
 <div class="two-col"><section class="paper-card">${sec("M\u00fasicas especiais", "Guarde um link do Spotify, YouTube ou outro servi\u00e7o.")}${tracks.length ? `<div class="music-list">${tracks.map((e) => `<div class="music-card"><span class="music-cover">\u266b</span><div style="min-width:0"><strong>${safe(e.title)}</strong><small>${safe(e.artist || "Escolhida com carinho")}</small></div>${e.url ? `<a class="music-link" href="${safe(validUrl(e.url))}" target="_blank" rel="noopener noreferrer">Ouvir \u2197</a>` : ""}<button class="mini-action" data-delete="${safe(e.id)}" aria-label="Apagar m\u00fasica">\u00d7</button></div>`).join("")}</div>` : empty("\u266b", "A trilha sonora come\u00e7a aqui", "Toda hist\u00f3ria tem uma m\u00fasica especial. Qual \u00e9 a primeira?", '<button class="btn btn-soft" data-open="music">Escolher uma m\u00fasica</button>')}</section><div class="stack"><section class="paper-card daily-tip"><span class="tip-badge">\u266b UMA IDEIA PARA OS DOIS</span><p class="tip-text">\u201cUma m\u00fasica pode ser a forma mais bonita de dizer: lembrei de voc\u00ea.\u201d</p></section><div class="notice">Conecte sua conta em Meu cantinho → Suas conexões para escolher favoritas ou músicas recentes. Nenhuma música é guardada automaticamente.</div></div></div>`;
}
function renderLocalSettings() {
  return `${intro("UM ESPAÇO SÓ DE VOCÊS", "Meu cantinho", "Você está usando a entrada local neste dispositivo.")}<div class="settings-grid">
  <section class="paper-card">
    ${sec("Meu perfil local", "Seus registros ficam somente neste navegador.")}
    <p class="notice">Modo local sem conta: não compartilha dados com seu amor nem importa dados de Google Fotos, Agenda ou Spotify. Não use em um dispositivo compartilhado.</p>
    <form id="profileForm">
      <div class="field"><label for="profileSelf">Como você quer ser chamado(a)?</label><input id="profileSelf" name="self" maxlength="40" required value="${safe(data.profile.self)}"></div>
      <div class="field"><label for="profilePartner">Como chamar seu amor?</label><input id="profilePartner" name="partner" maxlength="40" required value="${safe(data.profile.partner)}"></div>
      <div class="field"><label for="profileDate">Quando a história começou?</label><input id="profileDate" name="anniversary" type="date" value="${safe(data.profile.anniversary)}"></div>
      <button class="btn btn-primary" type="submit">Salvar perfil local</button>
    </form>
    <div class="divider"></div><button class="btn btn-line" type="button" data-logout>Voltar à tela de entrada</button>
  </section>
  <section class="paper-card">
    ${sec("Meus registros locais", "Guarde uma cópia antes de trocar de aparelho.")}
    <p class="setting-note">Esta prévia mantém os dados em um espaço separado das contas autenticadas. Exportar o backup permite guardar suas anotações e fotos em um lugar privado.</p>
    <div class="setting-actions"><button class="btn btn-soft" data-export type="button">Exportar backup</button><label class="btn btn-line" for="backupInput">Importar backup<input id="backupInput" type="file" accept="application/json,.json" hidden></label></div>
    <p class="setting-note">Registros antigos são preservados separadamente e não são importados automaticamente.</p>
    <button type="button" class="text-link" data-legacy-export>Exportar registros da versão anterior</button>
    <div class="divider"></div><button class="btn btn-quiet" type="button" data-clear>Apagar os dados deste espaço local</button>
  </section>
  </div>`;
}
function renderSettings() {
  if (localOnly) return renderLocalSettings();
  return `${intro("UM ESPAÇO SÓ DE VOCÊS", "Meu cantinho", "Seu perfil, suas conexões e seus registros.")}<div class="settings-grid"><section class="paper-card">${sec("Seu perfil", "Cada pessoa entra com sua própria conta.")}<p class="setting-note">${safe(accountUser?.email || "Conta conectada")}</p><form id="profileForm"><div class="field"><label for="profileSelf">Como você quer ser chamado(a)?</label><input id="profileSelf" name="self" maxlength="40" required value="${safe(data.profile.self)}"></div><div class="field"><label for="profilePartner">Como chamar seu amor?</label><input id="profilePartner" name="partner" maxlength="40" required value="${safe(data.profile.partner)}"></div><div class="field"><label for="profileDate">Quando a história começou?</label><input id="profileDate" name="anniversary" type="date" value="${safe(data.profile.anniversary)}"></div><button class="btn btn-primary">Salvar perfil</button></form><div class="divider"></div><button class="btn btn-line" data-logout>Sair da minha conta</button></section>${connectionCards()}<section class="paper-card">${sec("Seus registros", "Guarde uma cópia antes de trocar de aparelho.")}<p class="setting-note">O backup inclui suas fotos e anotações deste perfil. Guarde o arquivo em um lugar privado.</p><div class="setting-actions"><button class="btn btn-soft" data-export>Exportar backup</button><label class="btn btn-line" for="backupInput">Importar backup<input id="backupInput" type="file" accept="application/json,.json" hidden></label></div><p class="setting-note">Seus registros anteriores à criação do login foram preservados neste navegador. Eles não são atribuídos automaticamente a uma conta.</p><button class="text-link" data-legacy-export>Exportar registros da versão anterior</button><div class="divider"></div><button class="btn btn-quiet" data-clear>Apagar os dados locais deste perfil</button></section><section class="paper-card">${sec("Sobre este espaço")}<p class="setting-note">As conexões importam somente o conteúdo que você escolher. Fotos, eventos e músicas importados começam como privados.</p><p class="setting-note">Os registros ficam neste navegador, separados por perfil, e ainda não são sincronizados com outro aparelho. O login não criptografa o armazenamento local: use seu próprio dispositivo.</p><p class="setting-note">Desconectar uma conta não apaga as cópias que você já guardou aqui.</p></section></div>`;
}

function render() {
  announce();
  const routes = {
    inicio: renderHome,
    humor: renderMoodScreen,
    diario: renderJournal,
    calendario: renderCalendar,
    desafios: renderChallenges,
    memorias: renderMemories,
    musicas: renderMusic,
    ajustes: renderSettings,
  };
  $("#app").innerHTML = routes[tab]();
  attachImages();
}
const textField = (
  name,
  label,
  placeholder = "",
  required = true,
  value = "",
) =>
  `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" ${required ? "required" : ""} maxlength="170" value="${safe(value)}" placeholder="${safe(placeholder)}"></div>`;
const noteField = (label = "Quer contar mais?") =>
  `<div class="field"><label for="f-note">${label}</label><textarea id="f-note" name="note" maxlength="1500" placeholder="Escreva com carinho..."></textarea></div>`;
const dateField = () =>
  `<div class="field"><label for="f-date">Quando?</label><input id="f-date" type="date" name="date" value="${safe(tab === "calendario" ? selectedDay : localDay())}" required></div>`;
const uploadField = (required = false) =>
  `<div class="field"><label for="f-photo">Uma foto ${required ? "para comprovar o desafio" : "(opcional)"}</label><div class="upload-zone">Uma imagem de at\u00e9 16 MB. Ela ficar\u00e1 salva neste aparelho.<input id="f-photo" name="photo" type="file" accept="image/*" ${required ? "required" : ""}></div></div>`;
const shareField = (checked = true) =>
  `<label class="toggle-label"><input type="checkbox" name="shared" ${checked ? "checked" : ""}> Compartilhar este registro com meu amor, quando a sincroniza\u00e7\u00e3o estiver ativa</label>`;
function openModal(type, meta) {
  dialogType = type;
  dialogMeta = meta || null;
  moodChoice = "";
  let title = "",
    fields = "";
  switch (type) {
    case "mood":
      title = "Como est\u00e1 seu cora\u00e7\u00e3o?";
      fields = `<p class="setting-note">Escolha o que est\u00e1 sentindo. O registro pode ficar s\u00f3 para voc\u00ea.</p>${moodChoices(moodChoice, "modal")}${noteField("O que fez voc\u00ea se sentir assim?")}${dateField()}${shareField(false)}`;
      break;
    case "meal":
      title = "O que voc\u00ea comeu?";
      fields =
        textField(
          "title",
          "Nome da refei\u00e7\u00e3o",
          "Ex.: meu almo\u00e7o de hoje",
        ) +
        noteField("Como foi esse momento?") +
        dateField() +
        uploadField() +
        shareField(true);
      break;
    case "event":
      title = "Um momento para lembrar";
      fields =
        textField(
          "title",
          "Qual o compromisso?",
          "Ex.: nosso jantar por chamada",
        ) +
        dateField() +
        `<div class="field"><label for="f-time">Horário (opcional)</label><input id="f-time" name="time" type="time"></div>` +
        noteField("Um detalhe ou lembrete") +
        shareField(true);
      break;
    case "message":
      title = "Um recadinho de carinho";
      fields =
        textField(
          "title",
          "Um t\u00edtulo para a mensagem",
          "Ex.: pensei em voc\u00ea hoje",
        ) +
        noteField("Sua mensagem") +
        dateField() +
        shareField(true);
      break;
    case "music":
      title = "Nossa trilha sonora";
      fields =
        textField(
          "title",
          "Nome da m\u00fasica",
          "Ex.: aquela que nos lembra o primeiro encontro",
        ) +
        textField("artist", "Artista", "Quem canta?", false) +
        `<div class="field"><label for="f-url">Link para ouvir (opcional)</label><input id="f-url" type="url" name="url" placeholder="https://open.spotify.com/..."></div>` +
        noteField("Por que essa m\u00fasica importa?") +
        dateField() +
        shareField(true);
      break;
    case "memory":
      title = "Guardar uma lembran\u00e7a";
      fields =
        textField(
          "title",
          "Nome da lembran\u00e7a",
          "Ex.: nosso primeiro passeio",
        ) +
        dateField() +
        uploadField(true) +
        noteField("O que torna esse momento especial?") +
        shareField(true);
      break;
    case "challenge":
      title = "Um desafio para os dois";
      fields =
        textField(
          "title",
          "Nome do desafio",
          "Ex.: uma foto do caf\u00e9 da manh\u00e3",
        ) +
        noteField("Como vai funcionar?") +
        shareField(true);
      break;
    case "proof": {
      const ch = data.entries.find((e) => e.id === meta);
      title = "Miss\u00e3o cumprida!";
      fields =
        `<p class="setting-note">${safe(ch?.title || "Desafio")}: envie sua foto para mostrar como foi.</p>` +
        uploadField(true) +
        noteField("Quer contar como foi?");
      break;
    }
    default:
      return;
  }
  $("#dialogTitle").textContent = title;
  $("#formFields").innerHTML = fields;
  $("#formFeedback").textContent = "";
  const dialog = $("#entryDialog");
  if (!dialog.open) dialog.showModal();
}
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3300);
}
async function saveModal(e) {
  e.preventDefault();
  if (!$("#entryForm").reportValidity()) return;
  const b = $("#saveButton");
  b.disabled = true;
  $("#formFeedback").textContent = "";
  try {
    const form = new FormData($("#entryForm"));
    const rawDate = String(form.get("date") || localDay());
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : localDay();
    const type = dialogType;
    const record = {
      id: uid(),
      type,
      owner: "self",
      created: new Date().toISOString(),
      date,
      title: String(form.get("title") || "")
        .trim()
        .slice(0, 170),
      note: String(form.get("note") || "")
        .trim()
        .slice(0, 1500),
      shared: form.has("shared"),
    };
    if (type === "mood") {
      if (!MOODS.some((m) => m.id === moodChoice))
        throw new Error("Escolha uma figurinha antes de salvar.");
      record.mood = moodChoice;
      record.title = "";
    }
    if (type === "music") {
      record.artist = String(form.get("artist") || "")
        .trim()
        .slice(0, 170);
      record.url = validUrl(String(form.get("url") || ""));
      if (record.url === "#") record.url = "";
    }
    if (type === "event") {
      record.time = String(form.get("time") || "")
        .trim()
        .slice(0, 16);
    }
    if (type === "challenge") {
      record.description = record.note;
      record.emoji = "\u{1F49E}";
      record.shared = true;
    }
    if (type === "proof") {
      record.challengeId = dialogMeta;
      record.title = "Cumpri o desafio";
      record.shared = true;
      if (
        ownItems("proof").some(
          (p) => p.challengeId === dialogMeta && p.owner === "self",
        )
      )
        throw new Error("Voc\u00ea j\u00e1 enviou sua foto para este desafio.");
    }
    if (["memory", "meal", "proof"].includes(type)) {
      const file = form.get("photo");
      if (
        (type === "memory" || type === "proof") &&
        !(file instanceof File && file.size)
      )
        throw new Error("Escolha uma foto para continuar.");
      if (file instanceof File && file.size) {
        record.photoId = uid();
        await mediaPut(record.photoId, await compress(file));
      }
    }
    if (!record.title && !["mood", "proof"].includes(type))
      throw new Error("Preencha o t\u00edtulo do registro.");
    addRecord(record);
    $("#entryDialog").close();
    render();
    toast("Seu registro foi guardado com carinho \u2661");
  } catch (err) {
    $("#formFeedback").textContent =
      err?.message || "N\u00e3o foi poss\u00edvel salvar.";
  } finally {
    b.disabled = false;
  }
}
function saveInlineMood(e) {
  e.preventDefault();
  const feedback = $("#moodInlineFeedback");
  const button = $("#inlineSaveMood");
  if (!MOODS.some((m) => m.id === moodChoice)) {
    feedback.textContent = "Escolha uma figurinha antes de salvar.";
    return;
  }
  if (!e.target.reportValidity()) return;
  button.disabled = true;
  feedback.textContent = "";
  try {
    const form = new FormData(e.target);
    const rawDate = String(form.get("date") || localDay());
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : localDay();
    addRecord({
      id: uid(),
      type: "mood",
      owner: "self",
      created: new Date().toISOString(),
      date,
      title: "",
      mood: moodChoice,
      note: String(form.get("note") || "")
        .trim()
        .slice(0, 1500),
      shared: form.has("shared"),
    });
    moodChoice = "";
    render();
    toast("Seu humor foi salvo com carinho ♡");
  } catch (err) {
    feedback.textContent = err?.message || "Não foi possível salvar o humor.";
    button.disabled = false;
  }
}
function selectMood(id) {
  if (!MOODS.some((m) => m.id === id)) return;
  moodChoice = id;
  document.querySelectorAll("[data-pick-mood]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.pickMood === id);
    b.setAttribute("aria-pressed", String(b.dataset.pickMood === id));
  });
  const save = document.querySelector("#inlineSaveMood");
  if (save) save.disabled = false;
  const chosen = document.querySelector("#moodChosen");
  const info = MOODS.find((m) => m.id === id);
  if (chosen && info) chosen.textContent = info.name + ": " + info.phrase;
  const feedback = document.querySelector("#moodInlineFeedback");
  if (feedback) feedback.textContent = "";
}
async function addPreset(index) {
  const p = PRESETS[index];
  if (!p) return;
  const existing = ownItems("challenge").some((x) => x.title === p.title);
  if (existing) {
    toast("Este desafio j\u00e1 est\u00e1 na lista.");
    return;
  }
  data.entries.push({
    id: uid(),
    type: "challenge",
    owner: "self",
    created: new Date().toISOString(),
    date: localDay(),
    title: p.title,
    description: p.desc,
    emoji: p.emoji,
    shared: true,
  });
  persist();
  render();
  toast("Desafio adicionado!");
}
async function removeItem(id) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) return;
  if (
    !window.confirm(
      "Excluir este registro? Essa a\u00e7\u00e3o n\u00e3o pode ser desfeita.",
    )
  )
    return;
  data.entries = data.entries.filter(
    (x) =>
      x.id !== id &&
      !(e.type === "challenge" && x.type === "proof" && x.challengeId === id),
  );
  persist();
  if (e.photoId) await mediaDelete(e.photoId);
  render();
  toast("Registro exclu\u00eddo.");
}
const blobToBase64 = (blob) =>
  new Promise((res, rej) => {
    const f = new FileReader();
    f.onload = () => res(f.result);
    f.onerror = () => rej(f.error);
    f.readAsDataURL(blob);
  });
async function exportBackup() {
  const backup = {
    format: "entre-nos-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: data.profile,
    entries: data.entries,
    media: {},
  };
  try {
    for (const e of data.entries) {
      if (e.photoId) {
        const blob = await mediaGet(e.photoId);
        if (blob) backup.media[e.photoId] = await blobToBase64(blob);
      }
    }
    const b = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = url;
    a.download = "entre-nos-backup-" + localDay() + ".json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup pronto. Guarde em um lugar seguro.");
  } catch {
    toast("N\u00e3o foi poss\u00edvel exportar o backup.");
  }
}
async function importBackup(file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    toast("O backup tem mais de 50 MB.");
    return;
  }
  try {
    const b = JSON.parse(await file.text());
    if (
      b.format !== "entre-nos-backup" ||
      b.version !== 1 ||
      !Array.isArray(b.entries)
    )
      throw new Error("Backup incompat\u00edvel.");
    if (
      !confirm(
        "Importar substituir\u00e1 os registros locais atuais. Continuar?",
      )
    )
      return;
    const validEntries = b.entries
      .filter(
        (e) =>
          e &&
          typeof e.id === "string" &&
          TYPES[e.type] &&
          typeof e.created === "string",
      )
      .slice(0, 3000);
    await mediaClear();
    for (const [id, url] of Object.entries(b.media || {})) {
      if (!validEntries.some((e) => e.photoId === id)) continue;
      if (
        typeof url !== "string" ||
        !/^data:image\/(jpeg|png|webp);base64,/.test(url)
      )
        continue;
      const blob = await (await fetch(url)).blob();
      await mediaPut(id, blob);
    }
    data = {
      profile: {
        self: String(b.profile?.self || "Voc\u00ea").slice(0, 40),
        partner: String(b.profile?.partner || "Seu amor").slice(0, 40),
        anniversary: String(b.profile?.anniversary || ""),
      },
      entries: validEntries,
    };
    persist();
    navigate("inicio");
    toast("Backup importado com sucesso.");
  } catch (err) {
    toast(err?.message || "Arquivo inv\u00e1lido.");
  }
}
async function showAdvice() {
  const slot = $("#externalTip");
  if (!slot) return;
  slot.textContent = "Buscando um conselho...";
  try {
    const res = await fetch("https://api.adviceslip.com/advice", {
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) throw new Error("API temporariamente indispon\u00edvel");
    const json = await res.json();
    const advice = String(json.slip?.advice || "");
    if (!advice) throw new Error("Sem conselho");
    slot.textContent = "Conselho externo (em ingl\u00eas): " + advice;
  } catch {
    slot.textContent = "A dica de hoje continua sendo: " + timeTip();
  }
}
window.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    e.preventDefault();
    navigate(nav.dataset.nav);
    return;
  }
  const close = e.target.closest("[data-close]");
  if (close) {
    $("#entryDialog").close();
    return;
  }
  const open = e.target.closest("[data-open]");
  if (open) {
    openModal(open.dataset.open);
    return;
  }
  const mood = e.target.closest("[data-pick-mood]");
  if (mood) {
    const id = mood.dataset.pickMood;
    if ($("#entryDialog").open || tab === "humor") selectMood(id);
    else {
      navigate("humor");
      selectMood(id);
    }
    return;
  }
  const preset = e.target.closest("[data-preset]");
  if (preset) {
    addPreset(Number(preset.dataset.preset));
    return;
  }
  const proof = e.target.closest("[data-proof]");
  if (proof) {
    openModal("proof", proof.dataset.proof);
    return;
  }
  const del = e.target.closest("[data-delete]");
  if (del) {
    removeItem(del.dataset.delete);
    return;
  }
  const f = e.target.closest("[data-filter]");
  if (f) {
    filter = f.dataset.filter;
    render();
    return;
  }
  if (e.target.closest("[data-today]")) {
    calendarMonth = new Date().getMonth();
    calendarYear = new Date().getFullYear();
    selectedDay = localDay();
    render();
    return;
  }
  const cal = e.target.closest("[data-calendar]");
  if (cal) {
    calendarMonth += cal.dataset.calendar === "next" ? 1 : -1;
    if (calendarMonth > 11) {
      calendarYear++;
      calendarMonth = 0;
    }
    if (calendarMonth < 0) {
      calendarYear--;
      calendarMonth = 11;
    }
    selectedDay = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-01`;
    render();
    return;
  }
  const day = e.target.closest("[data-day]");
  if (day) {
    selectedDay = day.dataset.day;
    render();
    return;
  }
  if (e.target.closest("[data-export]")) {
    exportBackup();
    return;
  }
  if (e.target.closest("[data-clear]")) {
    if (
      confirm(
        "Apagar todos os registros, fotos e nomes salvos neste navegador?",
      )
    ) {
      await mediaClear();
      data = {
        profile: { self: "Voc\u00ea", partner: "Seu amor", anniversary: "" },
        entries: [],
      };
      persist();
      navigate("inicio");
      toast("Dados locais apagados.");
    }
    return;
  }
  if (e.target.closest("[data-surprise]")) {
    showAdvice();
    return;
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "entryForm") saveModal(e);
  if (e.target.id === "moodInlineForm") saveInlineMood(e);
  if (e.target.id === "profileForm") {
    e.preventDefault();
    const form = new FormData(e.target);
    data.profile = {
      self: String(form.get("self") || "Voc\u00ea")
        .trim()
        .slice(0, 40),
      partner: String(form.get("partner") || "Seu amor")
        .trim()
        .slice(0, 40),
      anniversary: String(form.get("anniversary") || ""),
    };
    persist();
    render();
    toast("Seu cantinho foi personalizado!");
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "backupInput") importBackup(e.target.files?.[0]);
});
$("#entryDialog").addEventListener("click", (e) => {
  if (e.target === $("#entryDialog")) $("#entryDialog").close();
});
if (location.hash) {
  const hash = location.hash.slice(1);
  if (
    [
      "inicio",
      "humor",
      "diario",
      "calendario",
      "desafios",
      "memorias",
      "musicas",
      "ajustes",
    ].includes(hash)
  )
    tab = hash;
}
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1) || "inicio";
  if (next !== tab) navigate(next);
});
if (
  ("serviceWorker" in navigator && location.protocol === "https:") ||
  ("serviceWorker" in navigator && location.hostname === "localhost")
)
  navigator.serviceWorker.register("./sw.js").catch(() => {});

export function startApp(user, options = {}) {
  if (!user?.id) throw new Error("Entre para continuar.");
  localOnly = options.localOnly === true;
  if (localOnly && user.id !== "local-only-v1")
    throw new Error("Perfil local inválido.");
  accountUser = user;
  STORE = localOnly ? "entre-nos-local-isolated-v1" : "entre-nos-user-v1:" + user.id;
  setMediaUser(localOnly ? "local-isolated-v1" : user.id);
  data = load();
  if (!localOnly) initConnections(user, {
    refresh: render,
    toast,
    importRecords: async (records, { blob } = {}) => {
      let count = 0;
      for (const input of records) {
        if (!["event", "music", "memory"].includes(input.type)) continue;
        if (
          data.entries.some(
            (x) =>
              x.source === input.source && x.externalId === input.externalId,
          )
        )
          continue;
        const record = {
          ...input,
          id: uid(),
          owner: "self",
          created: new Date().toISOString(),
          shared: false,
        };
        if (blob) {
          record.photoId = uid();
          await mediaPut(record.photoId, await compress(blob));
        }
        try {
          data.entries.push(record);
          persist();
          count++;
        } catch (error) {
          if (record.photoId) await mediaDelete(record.photoId);
          throw error;
        }
      }
      render();
      return count;
    },
  });
  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-logout]")) {
      if (localOnly) {
        location.replace("/");
        return;
      }
      try {
        await logout();
      } catch (error) {
        toast(error.message);
      }
    }
    if (event.target.closest("[data-legacy-export]")) {
      const oldStore = STORE,
        oldData = data;
      try {
        STORE = "entre-nos-local-v1";
        data = load();
        if (!data.entries.length) {
          toast("Não há registros anteriores neste navegador.");
          return;
        }
        setMediaUser(null);
        await exportBackup();
      } finally {
        STORE = oldStore;
        data = oldData;
        setMediaUser(localOnly ? "local-isolated-v1" : user.id);
      }
    }
  });
  navigate(tab);
}
