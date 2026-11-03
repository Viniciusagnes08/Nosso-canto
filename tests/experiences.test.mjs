import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { galleryIndex } from "../assets/memory-gallery.js";
import { spotifyEmbedUrl } from "../assets/music-embed.js";

test("gallery movement clamps at the actual photo collection boundaries", () => {
  assert.equal(galleryIndex(0, 5, -1), 0);
  assert.equal(galleryIndex(3, 5, 1), 4);
  assert.equal(galleryIndex(4, 5, 1), 4);
});
test("Spotify allows only official embeds for valid catalog content", () => {
  const id = "5c4Zc2zRvDP8CVEhT2rM9l";
  assert.equal(spotifyEmbedUrl("https://open.spotify.com/track/" + id + "?si=abc"),
    "https://open.spotify.com/embed/track/" + id);
  assert.equal(spotifyEmbedUrl("https://open.spotify.com/intl-pt/album/" + id),
    "https://open.spotify.com/embed/album/" + id);
  for (const invalid of ["javascript:alert(1)", "https://spotify.example.com/track/" + id,
      "https://open.spotify.com/user/secrets", "https://open.spotify.com/track/../fake",
      "http://open.spotify.com/track/" + id])
    assert.equal(spotifyEmbedUrl(invalid), "");
});
test("Spotify embed only starts after user interaction; closing removes iframe", async () => {
  const module = await readFile("assets/music-embed.js","utf8");
  assert.match(module,/root\.addEventListener\("click"/);
  assert.match(module,/frame\.replaceChildren\(iframe\)/);
  assert.match(module,/querySelector\("\.nc-spotify-frame"\)\.replaceChildren\(\)/);
  assert.doesNotMatch(module,/https:\/\/api\.spotify\.com\/v1\/me/);
});
test("gallery has accessible controls, does not distort original pictures", async () => {
  const module = await readFile("assets/memory-gallery.js","utf8");
  assert.match(module,/aria-labelledby/);
  assert.match(module,/data-gallery-action="rotate"/);
  assert.match(module,/data-gallery-action="zoom"/);
  assert.match(module,/dialog\.addEventListener\("close"/);
  assert.match(module,/URL\.revokeObjectURL/);
});
test("existing app mounts both modules and production copies design CSS", async () => {
  const app = await readFile("assets/app.js","utf8");
  const html = await readFile("index.html","utf8");
  const build = await readFile("scripts/build.mjs","utf8");
  const csp = await readFile("vercel.json","utf8");
  assert.match(app,/installMemoryGallery\(\$\("#app"\)\)/);
  assert.match(app,/installMusicEmbed\(\$\("#app"\)\)/);
  assert.match(html,/experiences\.css/);
  assert.match(build,/"experiences\.css"/);
  assert.match(csp,/frame-src[^"]*https:\/\/open\.spotify\.com/);
});
