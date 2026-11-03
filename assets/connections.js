import { config } from "./config.js";
import { auth, requireUser } from "./auth.js";
import { safe, uid, localDay } from "./utils.js";
import {
  eventToRecord,
  trackToRecord,
  validateOAuthAttempt,
  seconds,
} from "./integration-models.js";
const googleTokens = new Map();
const persistent = {};
async function api(provider, action, payload) {
  const { data } = await auth.auth.getSession();
  if (!data.session?.access_token) throw new Error("Entre novamente.");
  const path = provider ? `/api/connections/${provider}/${action}` : "/api/connections/status";
  const response = await fetch(path, {method:provider?"POST":"GET",headers:{"Authorization":`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:provider?JSON.stringify(payload||{}):undefined,cache:"no-store"});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível acessar a conexão.");
  return result;
}
let googleScript,
  contextUser = null,
  callbacks = null,
  picker = null,
  pollTimer = null,
  busy = false;
const SCOPES = {
  photos: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
  calendar:
    "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  youtube: "https://www.googleapis.com/auth/youtube.readonly",
};
const spotifyKey = () => `nc-spotify:${contextUser.id}`;
const pendingKey = "nc-oauth:spotify";
const MAX_PHOTO_SELECTION = 2000;
function notify() {
  callbacks?.refresh?.();
}
function googleReady() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!googleScript)
    googleScript = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        googleScript = null;
        reject(new Error("Não foi possível carregar a conexão com o Google."));
      };
      document.head.append(s);
    });
  return googleScript;
}
function tokenFor(provider) { return persistent[provider]?.connected ? `provider:${provider}` : null; }
function spotifyToken() { return tokenFor("spotify"); }
export function connectionCards() {
  return `<section class="paper-card connections"><div class="section-heading"><div><h2>Suas conexões</h2><p>Escolha o que traz para o nosso cantinho.</p></div></div>${[
    [
      "photos",
      "Google Fotos",
      "Escolha fotos antigas ou recentes para guardar.",
    ],
    [
      "calendar",
      "Google Agenda",
      "Importe automaticamente os eventos das suas agendas.",
    ],
    [
      "youtube",
      "YouTube",
      "Importe playlists e vídeos salvos para o nosso cantinho.",
    ],
  ]
    .map(([id, name, desc]) => {
      const configured =
          Boolean(persistent[id]?.configured),
        connected =
          Boolean(persistent[id]?.connected);
      return `<div class="connection-card"><div><strong>${name}</strong><p>${desc}</p><span class="tag ${connected ? "green" : "neutral"}">${connected ? "Conectado à sua conta" : configured ? "Não conectado" : "Disponível em breve"}</span></div><div class="connection-actions"><button type="button" class="btn btn-soft" data-connect="${id}" ${configured ? "" : "disabled"}>${connected ? "Escolher conteúdo" : "Conectar"}</button>${connected ? `<button class="text-link" data-disconnect="${id}">Desconectar</button>` : ""}</div></div>`;
    })
    .join(
      "",
    )}<p class="form-hint">Você escolhe o que importar. Eventos e músicas ficam privados até você compartilhar cada item; fotos escolhidas aparecem para vocês dois.</p><p class="form-hint">Spotify: adicione links de músicas na Nossa trilha.</p></section>`;
}
async function googleConnect(provider) {
  if (tokenFor(provider)) return;
  const result = await api(provider,"start");
  location.assign(result.url);
  return new Promise(() => {});
}
async function jsonFetch(url, token, options = {}) {
  if (token?.startsWith("provider:")) {
    return api(token.slice(9),"fetch",{url:String(url),method:options.method||"GET",body:options.body?JSON.parse(options.body):undefined});
  }
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 401)
      throw new Error("A conexão expirou. Conecte sua conta novamente.");
    if (res.status === 403)
      throw new Error(
        "O serviço não autorizou o acesso. Confira as permissões e o cadastro do aplicativo.",
      );
    if (res.status === 429)
      throw new Error(
        "Muitas solicitações. Aguarde um pouco e tente novamente.",
      );
    throw new Error("Não foi possível buscar o conteúdo. Tente novamente.");
  }
  return res.status === 204 ? {} : res.json();
}
function modal(title, body) {
  let d = document.querySelector("#connectionDialog");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "connectionDialog";
    d.className = "entry-dialog connection-dialog";
    d.setAttribute("aria-labelledby", "connectionTitle");
    document.body.append(d);
    d.addEventListener("close", () => {
      clearTimeout(pollTimer);
      picker = null;
      busy = false;
      d.replaceChildren();
    });
  }
  d.innerHTML = `<div class="dialog-header"><div><span class="eyebrow">ESCOLHIDO POR VOCÊ</span><h2 id="connectionTitle">${safe(title)}</h2></div><button class="close-icon" aria-label="Fechar conexão">×</button></div><div id="connectionBody">${body}</div><p id="connectionFeedback" role="status" aria-live="polite"></p>`;
  d.querySelector(".close-icon").onclick = () => d.close();
  if (!d.open) d.showModal();
  return d;
}
function feedback(text) {
  const el = document.querySelector("#connectionFeedback");
  if (el) el.textContent = text;
}
function active() {
  return Boolean(document.querySelector("#connectionDialog")?.open);
}
async function importSelected(records, options = {}) {
  if (busy) return;
  busy = true;
  const d = document.querySelector("#connectionDialog");
  d?.querySelectorAll("button,input,select").forEach(
    (x) => (x.disabled = true),
  );
  try {
    await requireUser();
    const count = await callbacks.importRecords(
      records.filter(Boolean),
      options,
    );
    feedback(`${count} registro(s) guardado(s). Você pode fechar esta janela.`);
    notify();
  } catch (e) {
    feedback(e.message);
  } finally {
    busy = false;
    d?.querySelectorAll("button,input,select").forEach(
      (x) => (x.disabled = false),
    );
  }
}
function chooseRows(items, toRecord, extra = "") {
  const body = document.querySelector("#connectionBody");
  body.innerHTML = `${extra}<p class="setting-note">Selecione o conteúdo que deseja guardar. Eventos e músicas ficam privados até você escolher compartilhar cada item.</p><div class="connection-choices">${items.map((item, i) => `<label class="connection-choice"><input type="checkbox" value="${i}"><span><strong>${safe(item.label)}</strong><small>${safe(item.detail || "")}</small></span></label>`).join("")}</div>${items.length ? '<button id="importChosen" class="btn btn-primary">Guardar selecionados</button>' : '<div class="empty-state">Nenhum item encontrado neste período.</div>'}`;
  body.querySelector("#importChosen")?.addEventListener("click", () => {
    const selected = [
      ...body.querySelectorAll(
        ".connection-choices input[type=checkbox]:checked",
      ),
    ].map((x) => toRecord(items[Number(x.value)].raw));
    if (!selected.length) {
      feedback("Escolha pelo menos um item.");
      return;
    }
    importSelected(selected);
  });
}
async function calendar() {
  await googleConnect("calendar");
  const d = modal("Sua agenda", "<p>Buscando os eventos das suas agendas. Eles ficarão privados até você escolher compartilhar.</p>");
  const all = [];
  let next;
  do {
    const u = new URL(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    );
    u.searchParams.set("maxResults", "100");
    if (next) u.searchParams.set("pageToken", next);
    const page = await jsonFetch(u, tokenFor("calendar"));
    all.push(...(page.items || []));
    next = page.nextPageToken;
  } while (next && all.length < 500);
  if (!active()) return;
  try {
      const now = new Date();
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      const end = new Date(now);
      end.setFullYear(end.getFullYear() + 2);
      const records = [];
      for (const calendarInfo of all.filter((x) => !x.deleted)) {
        const id = calendarInfo.id;
        const entries = [];
      let pageToken;
      do {
        const u = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`,
        );
        u.search = new URLSearchParams({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "100",
          ...(pageToken ? { pageToken } : {}),
        }).toString();
        const page = await jsonFetch(u, tokenFor("calendar"));
        entries.push(...(page.items || []));
        pageToken = page.nextPageToken;
      } while (pageToken && entries.length < 500);
        records.push(...entries
          .filter((x) => x.status !== "cancelled")
          .map((raw) => eventToRecord(raw, id, false)));
      }
      await importSelected(records);
    } catch (err) {
      feedback(err.message);
    }
}
async function photos() {
  await googleConnect("photos");
  modal("Suas fotos", "<p>Preparando a seleção…</p>");
  const session = await jsonFetch(
    "https://photospicker.googleapis.com/v1/sessions",
    tokenFor("photos"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickingConfig: { maxItemCount: String(MAX_PHOTO_SELECTION) },
      }),
    },
  );
  if (!active()) return;
  const pickerUrl = new URL(session.pickerUri);
  if (
    pickerUrl.protocol !== "https:" ||
    pickerUrl.hostname !== "photos.google.com"
  )
    throw new Error("O Google retornou uma seleção inválida.");
  picker = {
    id: session.id,
    deadline:
      Date.now() + seconds(session.pollingConfig?.timeoutIn, 600) * 1000,
  };
  document.querySelector("#connectionBody").innerHTML =
    `<p>Abra o Google Fotos, escolha até ${MAX_PHOTO_SELECTION.toLocaleString("pt-BR")} fotos e conclua a seleção. Vídeos não são importados nesta versão.</p><a class="btn btn-primary" href="${safe(pickerUrl.href)}" target="_blank" rel="noopener noreferrer">Escolher no Google Fotos ↗</a><p class="form-hint">Uma seleção grande pode demorar e usar bastante armazenamento. Esta janela verificará a conclusão enquanto estiver aberta.</p>`;
  const current = picker;
  async function poll() {
    if (!active() || picker !== current) return;
    if (Date.now() > current.deadline) {
      feedback("O tempo de seleção terminou. Feche e tente novamente.");
      return;
    }
    try {
      const result = await jsonFetch(
        `https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(current.id)}`,
        tokenFor("photos"),
      );
      if (!active() || picker !== current) return;
      if (result.mediaItemsSet) {
        const items = [];
        let nextPageToken;
        do {
          const u = new URL(
            "https://photospicker.googleapis.com/v1/mediaItems",
          );
          u.search = new URLSearchParams({
            sessionId: current.id,
            pageSize: "100",
            ...(nextPageToken ? { pageToken: nextPageToken } : {}),
          }).toString();
          const page = await jsonFetch(u, tokenFor("photos"));
          items.push(...(page.mediaItems || []));
          nextPageToken = page.nextPageToken;
        } while (nextPageToken && items.length < MAX_PHOTO_SELECTION);
        const photos = items
          .filter((x) => x.type === "PHOTO")
          .slice(0, MAX_PHOTO_SELECTION);
        const preview = photos.slice(0, 100);
        document.querySelector("#connectionBody").innerHTML =
          `<p>${photos.length} foto(s) selecionada(s). As fotos selecionadas serão compartilhadas automaticamente no espaço do casal e poderão aparecer em Momentos.</p><ul>${preview.map((x) => `<li>${safe(x.mediaFile?.filename || "Foto")}</li>`).join("")}</ul>${photos.length > preview.length ? `<p class="form-hint">E mais ${photos.length - preview.length} foto(s).</p>` : ""}<button class="btn btn-primary" id="savePhotos" ${photos.length ? "" : "disabled"}>Guardar fotos selecionadas</button>`;
        document.querySelector("#savePhotos").onclick = async (e) => {
          if (busy) return;
          busy = true;
          e.target.disabled = true;
          let imported = 0;
          try {
            for (const item of photos) {
              feedback(`Guardando foto ${imported + 1} de ${photos.length}…`);
              const { data } = await auth.auth.getSession();
              if (!data.session) throw new Error("Entre novamente.");
              const res = await fetch("/api/photo", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${data.session.access_token}`,
                },
                body: JSON.stringify({
                  sessionId: current.id,
                  mediaId: item.id,
                }),
                signal: AbortSignal.timeout(30000),
              });
              if (!res.ok)
                throw new Error(
                  "Não foi possível guardar esta foto. As anteriores foram mantidas; você pode tentar novamente.",
                );
              const blob = await res.blob();
              const count = await callbacks.importRecords(
                [
                  {
                    type: "memory",
                    title: "", // The Google Photos filename is not a caption.
                    date: item.createTime
                      ? localDay(new Date(item.createTime))
                      : localDay(),
                    source: "google-photos",
                    externalId: item.id,
                    shared: true,
                  },
                ],
                { blob },
              );
              imported += count;
            }
            feedback(`${imported} foto(s) guardada(s).`);
            notify();
            await jsonFetch(
              `https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(current.id)}`,
              tokenFor("photos"),
              { method: "DELETE" },
            ).catch(() => {});
          } catch (err) {
            feedback(err.message);
          } finally {
            busy = false;
            e.target.disabled = false;
          }
        };
      } else
        pollTimer = setTimeout(
          poll,
          Math.max(2, seconds(result.pollingConfig?.pollInterval, 5)) * 1000,
        );
    } catch (err) {
      feedback(err.message);
    }
  }
  pollTimer = setTimeout(
    poll,
    Math.max(2, seconds(session.pollingConfig?.pollInterval, 5)) * 1000,
  );
}
function randomString() {
  const b = crypto.getRandomValues(new Uint8Array(48));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
export async function connectSpotify() {
  const result = await api("spotify","start");
  location.assign(result.url);
  return new Promise(() => {});
  const verifier = randomString(),
    state = randomString(),
    digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const redirect = location.origin + "/spotify-callback.html";
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({
      verifier,
      state,
      userId: user.id,
      redirect,
      created: Date.now(),
    }),
  );
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: config.SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirect,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: "user-library-read user-read-recently-played",
    show_dialog: "true",
  }).toString();
  location.assign(url);
}
export async function completeSpotify() {
  if (location.pathname === "/spotify-callback.html") return;
  const user = await requireUser();
  contextUser = user;
  const params = new URLSearchParams(location.search),
    attempt = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
  sessionStorage.removeItem(pendingKey);
  history.replaceState(null, "", location.pathname);
  if (
    !validateOAuthAttempt(attempt, {
      state: params.get("state"),
      userId: user.id,
    })
  )
    throw new Error(
      "Esta conexão expirou ou não pertence à sua sessão. Volte e tente novamente.",
    );
  if (params.get("error"))
    throw new Error(
      "A conexão não foi autorizada. Você pode tentar novamente quando quiser.",
    );
  if (!params.get("code"))
    throw new Error("O Spotify não retornou um código válido.");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.SPOTIFY_CLIENT_ID,
      grant_type: "authorization_code",
      code: params.get("code"),
      redirect_uri: attempt.redirect,
      code_verifier: attempt.verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error("Não foi possível concluir a conexão com o Spotify.");
  const token = await res.json();
  if (!token.access_token)
    throw new Error("O Spotify não retornou uma sessão válida.");
  // No refresh token is retained. Reconnect after expiry; sign-out removes this session token.
  sessionStorage.setItem(
    spotifyKey(),
    JSON.stringify({
      userId: user.id,
      token: token.access_token,
      expires: Date.now() + Math.max(0, Number(token.expires_in) - 60) * 1000,
    }),
  );
}
async function spotify() {
  if (!spotifyToken()) return connectSpotify();
  modal(
    "Sua trilha sonora",
    '<div class="setting-actions"><button class="btn btn-soft" data-music-source="saved">Favoritas</button><button class="btn btn-soft" data-music-source="recent">Ouvidas recentemente</button></div>',
  );
  document.querySelectorAll("[data-music-source]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          const path =
            b.dataset.musicSource === "saved"
              ? "me/tracks?limit=50"
              : "me/player/recently-played?limit=50";
          const page = await jsonFetch(
            "https://api.spotify.com/v1/" + path,
            spotifyToken(),
          );
          const unique = new Map(
            (page.items || []).map((x) => [x.track?.id, x.track]),
          );
          if (!active()) return;
          chooseRows(
            [...unique.values()]
              .filter((x) => trackToRecord(x))
              .map((x) => ({
                raw: x,
                label: x.name,
                detail: (x.artists || []).map((a) => a.name).join(", "),
              })),
            trackToRecord,
            '<p class="form-hint">Mostrando até 50 músicas. O áudio continua no Spotify.</p>',
          );
        } catch (err) {
          feedback(err.message);
        } finally {
          b.disabled = false;
        }
      }),
  );
}
async function youtube() {
  await googleConnect("youtube");
  const d = modal("Seu YouTube", "<p>Buscando suas playlists…</p>");
  try {
    const page = await jsonFetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50",
      tokenFor("youtube"),
    );
    const playlists = page.items || [];
    if (!playlists.length) {
      feedback("Nenhuma playlist encontrada nessa conta do YouTube.");
      return;
    }
    d.querySelector("#connectionBody").innerHTML = `<p>Escolha uma playlist para importar seus vídeos salvos.</p><div class="connection-choices">${playlists.map((p, i) => `<label class="connection-choice"><input type="radio" name="yt-playlist" value="${i}"><span><strong>${safe(p.snippet?.title || "Playlist")}</strong><small>${safe(String(p.contentDetails?.itemCount || 0))} vídeo(s)</small></span></label>`).join("")}</div><button id="importYoutube" class="btn btn-primary">Importar playlist</button>`;
    d.querySelector("#importYoutube").onclick = async (e) => {
      const selected = d.querySelector('input[name="yt-playlist"]:checked');
      if (!selected) return feedback("Escolha uma playlist.");
      e.target.disabled = true;
      try {
        const playlist = playlists[Number(selected.value)];
        const items = await jsonFetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlist.id)}&maxResults=50`, tokenFor("youtube"));
        const videos = (items.items || []).filter((x) => x.snippet?.resourceId?.videoId);
        chooseRows(videos.map((x) => ({ raw: x, label: x.snippet.title || "Vídeo do YouTube", detail: playlist.snippet?.title || "YouTube" })), (x) => ({
          type: "music",
          title: x.snippet.title || "Vídeo do YouTube",
          date: localDay(),
          source: "youtube",
          externalId: x.snippet.resourceId.videoId,
          url: `https://www.youtube.com/watch?v=${x.snippet.resourceId.videoId}`,
          shared: false,
        }));
      } catch (err) { feedback(err.message); } finally { e.target.disabled = false; }
    };
  } catch (err) { feedback(err.message); }
}
async function disconnect(provider) {
  await api(provider,"disconnect");
  persistent[provider] = { ...persistent[provider],connected:false };
  modal("Conta desconectada","<p>A conexão foi removida. Os registros já importados permanecem no seu cantinho.</p>");
  notify();
  return;
  if (provider === "spotify") {
    sessionStorage.removeItem(spotifyKey());
    modal(
      "Spotify desconectado",
      '<p>A sessão foi removida deste navegador. As músicas que você guardou continuam no seu perfil.</p><a class="text-link" href="https://www.spotify.com/account/apps/" target="_blank" rel="noopener noreferrer">Gerenciar e revogar acesso no Spotify ↗</a>',
    );
  } else {
    const token = tokenFor(provider);
    if (token && globalThis.google?.accounts?.oauth2) {
      await new Promise((resolve) =>
        google.accounts.oauth2.revoke(token, resolve),
      );
    }
    googleTokens.clear();
    modal(
      "Google desconectado",
      "<p>As conexões do Google foram encerradas. Os registros que você já guardou continuam no seu perfil.</p>",
    );
  }
  notify();
}
export function initConnections(user, handlers) {
  contextUser = user;
  callbacks = handlers;
  api(null).then((status) => { Object.assign(persistent,status); notify(); }).catch((error) => handlers.toast(error.message));
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-connect],[data-disconnect]");
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.disconnect)
        await disconnect(button.dataset.disconnect);
      else {
        const id = button.dataset.connect;
        await { photos, calendar, spotify, youtube }[id]();
      }
    } catch (err) {
      if (active()) feedback(err.message);
      else handlers.toast(err.message);
    } finally {
      button.disabled = false;
    }
  });
}




