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
function tokenFor(provider) {
  const t = googleTokens.get(provider);
  if (!t || Date.now() >= t.expires) {
    googleTokens.delete(provider);
    return null;
  }
  return t.token;
}
function spotifyToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(spotifyKey()));
    if (t?.userId === contextUser.id && t.expires > Date.now()) return t.token;
  } catch {}
  sessionStorage.removeItem(spotifyKey());
  return null;
}
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
      "Importe eventos escolhidos ou apenas horários ocupados.",
    ],
    [
      "spotify",
      "Spotify",
      "Escolha suas favoritas e as músicas ouvidas recentemente.",
    ],
  ]
    .map(([id, name, desc]) => {
      const configured =
          id === "spotify"
            ? Boolean(config.SPOTIFY_CLIENT_ID)
            : Boolean(config.GOOGLE_CLIENT_ID),
        connected =
          id === "spotify"
            ? Boolean(contextUser && spotifyToken())
            : Boolean(tokenFor(id));
      return `<div class="connection-card"><div><strong>${name}</strong><p>${desc}</p><span class="tag ${connected ? "green" : "neutral"}">${connected ? "Conectado nesta sessão" : configured ? "Não conectado" : "Disponível em breve"}</span></div><div class="connection-actions"><button type="button" class="btn btn-soft" data-connect="${id}" ${configured ? "" : "disabled"}>${connected ? "Escolher conteúdo" : "Conectar"}</button>${connected ? `<button class="text-link" data-disconnect="${id}">Desconectar</button>` : ""}</div></div>`;
    })
    .join(
      "",
    )}<p class="form-hint">Nada é importado sem sua escolha. O conteúdo começa privado na sua conta; quando você marcar como compartilhado, aparece para vocês dois.</p></section>`;
}
async function googleConnect(provider) {
  if (!config.GOOGLE_CLIENT_ID)
    throw new Error("A conexão com o Google ainda não foi ativada.");
  await requireUser();
  await googleReady();
  if (!tokenFor(provider))
    await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: config.GOOGLE_CLIENT_ID,
        scope: SCOPES[provider],
        include_granted_scopes: false,
        callback: (response) => {
          if (
            response.error ||
            !google.accounts.oauth2.hasGrantedAllScopes(
              response,
              ...SCOPES[provider].split(" "),
            )
          )
            return reject(
              new Error(
                "A permissão não foi concedida. Você pode tentar novamente quando quiser.",
              ),
            );
          googleTokens.set(provider, {
            token: response.access_token,
            expires: Date.now() + (Number(response.expires_in) - 60) * 1000,
          });
          resolve();
        },
        error_callback: () =>
          reject(
            new Error(
              "A janela de conexão foi fechada ou bloqueada. Tente novamente.",
            ),
          ),
      });
      client.requestAccessToken({ prompt: "consent" });
    });
  notify();
}
async function jsonFetch(url, token, options = {}) {
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
  body.innerHTML = `${extra}<p class="setting-note">Selecione apenas o que deseja guardar no seu perfil.</p><div class="connection-choices">${items.map((item, i) => `<label class="connection-choice"><input type="checkbox" value="${i}"><span><strong>${safe(item.label)}</strong><small>${safe(item.detail || "")}</small></span></label>`).join("")}</div>${items.length ? '<button id="importChosen" class="btn btn-primary">Guardar selecionados</button>' : '<div class="empty-state">Nenhum item encontrado neste período.</div>'}`;
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
  const d = modal("Sua agenda", "<p>Buscando suas agendas…</p>");
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
  d.querySelector("#connectionBody").innerHTML =
    `<div class="field"><label for="calendarSource">Qual agenda?</label><select id="calendarSource">${all
      .filter((x) => !x.deleted)
      .map(
        (x) =>
          `<option value="${safe(x.id)}">${safe(x.summary || "Agenda")}</option>`,
      )
      .join(
        "",
      )}</select></div><button id="loadEvents" class="btn btn-soft">Ver próximos 30 dias</button><div id="eventChoices"></div>`;
  d.querySelector("#loadEvents").onclick = async (e) => {
    e.target.disabled = true;
    try {
      const id = d.querySelector("#calendarSource").value,
        now = new Date(),
        end = new Date(now);
      end.setDate(end.getDate() + 30);
      const entries = [];
      let pageToken;
      do {
        const u = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`,
        );
        u.search = new URLSearchParams({
          timeMin: now.toISOString(),
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
      if (!active()) return;
      const items = entries
        .filter((x) => x.status !== "cancelled")
        .map((x) => ({
          raw: x,
          label: x.summary || "Compromisso",
          detail:
            x.start?.date ||
            new Date(x.start?.dateTime).toLocaleString("pt-BR"),
        }));
      chooseRows(
        items,
        (item) =>
          eventToRecord(
            item,
            id,
            Boolean(d.querySelector("#busyOnly")?.checked),
          ),
        '<label class="toggle-label"><input id="busyOnly" type="checkbox">Guardar somente “Horário ocupado”, sem título do evento</label>',
      );
    } catch (err) {
      feedback(err.message);
    } finally {
      e.target.disabled = false;
    }
  };
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
          `<p>${photos.length} foto(s) selecionada(s). As cópias serão guardadas na sua conta do Nosso Canto.</p><ul>${preview.map((x) => `<li>${safe(x.mediaFile?.filename || "Foto")}</li>`).join("")}</ul>${photos.length > preview.length ? `<p class="form-hint">E mais ${photos.length - preview.length} foto(s).</p>` : ""}<button class="btn btn-primary" id="savePhotos" ${photos.length ? "" : "disabled"}>Guardar fotos selecionadas</button>`;
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
                  googleToken: tokenFor("photos"),
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
                    title: String(
                      item.mediaFile?.filename || "Uma lembrança",
                    ).slice(0, 170),
                    date: item.createTime
                      ? localDay(new Date(item.createTime))
                      : localDay(),
                    source: "google-photos",
                    externalId: item.id,
                    shared: false,
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
  const user = await requireUser();
  if (!config.SPOTIFY_CLIENT_ID)
    throw new Error("A conexão com o Spotify ainda não foi ativada.");
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
async function disconnect(provider) {
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
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-connect],[data-disconnect]");
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.disconnect)
        await disconnect(button.dataset.disconnect);
      else {
        const id = button.dataset.connect;
        await { photos, calendar, spotify }[id]();
      }
    } catch (err) {
      if (active()) feedback(err.message);
      else handlers.toast(err.message);
    } finally {
      button.disabled = false;
    }
  });
}
