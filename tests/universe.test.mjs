import test from "node:test";
import assert from "node:assert/strict";
import { parseNewsFeed, parseVideoFeed, cleanTrack } from "../api/universe.js";

test("news parser keeps source, date and safe outbound links", () => {
  const xml = '<rss><channel><item><title><![CDATA[Uma novidade &amp; apresentação]]></title><link>https://example.org/story</link><pubDate>Mon, 02 Nov 2026 12:00:00 GMT</pubDate><source url="https://example.org">Fonte original</source></item><item><title>Não mostrar</title><link>javascript:alert(1)</link></item></channel></rss>';
  const items = parseNewsFeed(xml, "ballet");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Uma novidade & apresentação");
  assert.equal(items[0].url, "https://example.org/story");
  assert.equal(items[0].source, "Fonte original");
  assert.equal(items[0].topic, "ballet");
});
test("video parser requires a safe YouTube id", () => {
  const xml = '<feed><entry><yt:videoId>abcDEFgh123</yt:videoId><title>Nova coreografia</title><published>2026-11-02T11:00:00Z</published></entry><entry><yt:videoId>invalid/id</yt:videoId><title>Ruim</title></entry></feed>';
  const items = parseVideoFeed(xml, "ballet");
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://www.youtube.com/watch?v=abcDEFgh123");
});
test("music parser checks provider and actual BTS artist", () => {
  const base = { trackId: 412, trackName: "Canção", artistName: "BTS", trackViewUrl: "https://music.apple.com/br/album/test/123", artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/a.png" };
  assert.equal(cleanTrack(base, "bts")?.source, "BTS");
  assert.equal(cleanTrack({ ...base, artistName: "Outro artista" }, "bts"), null);
  assert.equal(cleanTrack({ ...base, trackViewUrl: "https://not-apple.example.com" }, "bts"), null);
});
test("server forbids unsupported topic and HTTP method", async () => {
  const { default: handler } = await import("../api/universe.js");
  const makeRes = () => ({ code: null, headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } });
  let res = makeRes();
  await handler({ method: "GET", query: { topic: "other", kind: "news" } }, res);
  assert.equal(res.code, 400);
  res = makeRes();
  await handler({ method: "POST", query: { topic: "bts", kind: "news" } }, res);
  assert.equal(res.code, 405);
});

