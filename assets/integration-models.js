import { localDay } from "./utils.js";
export function eventToRecord(event, calendarId = "primary", busyOnly = false) {
  if (!event?.id || event.status === "cancelled") return null;
  const start = event.start?.dateTime || event.start?.date;
  if (!start || Number.isNaN(new Date(start).valueOf())) return null;
  const timed = Boolean(event.start?.dateTime),
    d = timed ? new Date(start) : null;
  return {
    type: "event",
    title: busyOnly
      ? "Horário ocupado"
      : String(event.summary || "Compromisso").slice(0, 170),
    note: "Importado da sua agenda. Alterações no Google não são sincronizadas automaticamente.",
    date: timed ? localDay(d) : start,
    time: timed
      ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      : "",
    source: "google-calendar",
    externalId: calendarId + ":" + event.id,
    shared: false,
  };
}
export function trackToRecord(track) {
  if (!track?.id || !track.name) return null;
  const url = track.external_urls?.spotify;
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "open.spotify.com")
    return null;
  return {
    type: "music",
    title: String(track.name).slice(0, 170),
    artist: (track.artists || [])
      .map((x) => x.name)
      .join(", ")
      .slice(0, 170),
    url: parsed.href,
    note: "",
    date: localDay(),
    source: "spotify",
    externalId: track.id,
    shared: false,
  };
}
export function validateOAuthAttempt(
  attempt,
  { state, userId, now = Date.now() },
) {
  return Boolean(
    attempt &&
      typeof state === "string" &&
      state.length >= 32 &&
      attempt.state === state &&
      attempt.userId === userId &&
      typeof attempt.verifier === "string" &&
      attempt.verifier.length >= 43 &&
      Number.isFinite(attempt.created) &&
      now >= attempt.created &&
      now - attempt.created < 600000,
  );
}
export function seconds(value, fallback) {
  const x = Number.parseFloat(value);
  return Number.isFinite(x) && x > 0 ? x : fallback;
}
