// Server-side discovery from fixed public sources. No private user data is sent.
const TOPICS = {
  bts: { news: "BTS 방탄소년단 música when:30d", channel: "UCLkAepWjdylmXSltofFvsYQ", music: "BTS" },
  ballet: { news: "ballet dança clássica espetáculo when:30d", channel: "UCHS5XKgf2FCBF8pZllE_bjw", music: "Tchaikovsky Swan Lake" }
};
const KINDS = new Set(["news", "videos", "music"]);
const decodeXml = (raw = "") => String(raw)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, token) => {
    const map = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    const k = token.toLowerCase();
    if (map[k]) return map[k];
    const n = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
  }).trim().slice(0, 380);
const field = (xml, name) => {
  const match = xml.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i"));
  return match ? decodeXml(match[1]) : "";
};
const https = (value) => { try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
export function parseNewsFeed(xml, topic) {
  const result = [];
  for (const entry of (String(xml).match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []).slice(0, 25)) {
    const title = field(entry, "title");
    const url = https(field(entry, "link"));
    if (!title || !url) continue;
    const date = new Date(field(entry, "pubDate"));
    result.push({ id: "news:" + url, kind: "news", topic, title,
      source: field(entry, "source") || "Google Notícias",
      publishedAt: Number.isNaN(date.valueOf()) ? "" : date.toISOString(), url });
  }
  return [...new Map(result.map(x => [x.id, x])).values()].slice(0, 12);
}
export function parseVideoFeed(xml, topic) {
  const result = [];
  for (const entry of (String(xml).match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || []).slice(0, 20)) {
    const videoId = field(entry, "yt:videoId");
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
    const date = new Date(field(entry, "published"));
    result.push({ id: "video:" + videoId, kind: "videos", topic,
      title: field(entry, "title") || "Vídeo no YouTube",
      source: topic === "bts" ? "BANGTANTV" : "Royal Ballet and Opera",
      publishedAt: Number.isNaN(date.valueOf()) ? "" : date.toISOString(),
      url: "https://www.youtube.com/watch?v=" + videoId,
      thumbnail: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg", videoId });
  }
  return result.slice(0, 12);
}
export function cleanTrack(track, topic) {
  if (!track || typeof track !== "object") return null;
  const url = https(track.trackViewUrl);
  if (!url || !/(^|\.)music\.apple\.com$|(^|\.)itunes\.apple\.com$/.test(new URL(url).hostname)) return null;
  const title = String(track.trackName || "").trim().slice(0, 180);
  const artist = String(track.artistName || "").trim().slice(0, 100);
  if (!title || !artist || (topic === "bts" && !/\bBTS\b/i.test(artist))) return null;
  const artwork = https(track.artworkUrl100);
  return { id: "track:" + (Number.isInteger(track.trackId) ? track.trackId : url),
    kind: "music", topic, title, source: artist, subtitle: String(track.collectionName || "").slice(0, 120),
    publishedAt: String(track.releaseDate || "").slice(0, 24), url,
    thumbnail: artwork && /^is\d+(?:-ssl)?\.mzstatic\.com$/.test(new URL(artwork).hostname) ? artwork : "" };
}
async function fetchLimited(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8500),
    headers: { Accept: "application/rss+xml, application/atom+xml, application/json, text/xml" } });
  if (!response.ok) throw new Error("Upstream error");
  if (Number(response.headers.get("content-length") || 0) > 1200000) throw new Error("Too large");
  const body = await response.text();
  if (body.length > 1200000) throw new Error("Too large");
  return body;
}
async function getItems(topic, kind) {
  const t = TOPICS[topic];
  if (kind === "news") {
    const url = new URL("https://news.google.com/rss/search");
    for (const [key, value] of Object.entries({ q: t.news, hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" }))
      url.searchParams.set(key, value);
    return parseNewsFeed(await fetchLimited(url.href), topic);
  }
  if (kind === "videos") {
    const url = new URL("https://www.youtube.com/feeds/videos.xml");
    url.searchParams.set("channel_id", t.channel);
    return parseVideoFeed(await fetchLimited(url.href), topic);
  }
  const url = new URL("https://itunes.apple.com/search");
  for (const [key, value] of Object.entries({ term: t.music, media: "music", entity: "song", country: "BR", limit: "35" }))
    url.searchParams.set(key, value);
  const json = JSON.parse(await fetchLimited(url.href));
  return (Array.isArray(json.results) ? json.results : []).map(x => cleanTrack(x, topic)).filter(Boolean).slice(0, 12);
}
export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Método não permitido." }); }
  const topic = typeof req.query?.topic === "string" ? req.query.topic : "";
  const kind = typeof req.query?.kind === "string" ? req.query.kind : "";
  if (!Object.hasOwn(TOPICS, topic) || !KINDS.has(kind))
    return res.status(400).json({ error: "Tema ou categoria inválidos." });
  try {
    const items = await getItems(topic, kind);
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({ topic, kind, items, updatedAt: new Date().toISOString() });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Fonte indisponível no momento.", items: [] });
  }
}

