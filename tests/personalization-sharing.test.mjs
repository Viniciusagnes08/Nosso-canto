import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { topicsForProfile, normalizeUniverseTopics } from "../assets/universe-topics.js";
import { cleanProfile } from "../assets/reels-model.js";
import { isUploadFilename, visibleMediaCaption } from "../assets/reels-caption.js";
import { validateProfileImage } from "../assets/profile-image.js";
import universeHandler from "../api/universe.js";

test("each account has independently selected topics, not BTS/Ballet for everyone", () => {
  const her = cleanProfile({ self: "Conta A", universeTopics: ["bts", "ballet"] });
  const his = cleanProfile({ self: "Conta B", universeTopics: ["tecnologia", "games", "historia"] });
  assert.deepEqual(topicsForProfile(her), ["bts", "ballet"]);
  assert.deepEqual(topicsForProfile(his), ["tecnologia", "games", "historia"]);
  assert.deepEqual(topicsForProfile({}), []);
  assert.deepEqual(topicsForProfile({ universeTopics: [] }), []);
  assert.deepEqual(topicsForProfile({ interests: "BTS, ballet" }), ["bts", "ballet"]);
  assert.deepEqual(normalizeUniverseTopics(["tecnologia", "invalid", "tecnologia"]), ["tecnologia"]);
});
test("profile photos reject unsupported formats and oversized files before decoding", () => {
  assert.equal(validateProfileImage({ type: "image/jpeg", size: 1024 }), true);
  assert.throws(() => validateProfileImage({ type: "image/gif", size: 1024 }), /JPG, PNG ou WebP/);
  assert.throws(() => validateProfileImage({ type: "image/png", size: 7 * 1024 * 1024 }), /até 6 MB/);
});
test("reels compose hides video and GIF choices while Storage is unavailable", async () => {
  const source = await readFile("assets/reels.js", "utf8");
  assert.match(source, /const storageEnabled = Boolean\(config\.FIREBASE_STORAGE_BUCKET\)/);
  assert.match(source, /Vídeos e GIFs temporariamente indisponíveis/);
  assert.match(source, /image\/jpeg,image\/png,image\/webp/);
});
test("reels caption never exposes automatic filename or synthetic title", () => {
  assert.equal(isUploadFilename("19dad113-8ce6-4322-8849-f6a98b2a7931.jpg"), true);
  assert.equal(visibleMediaCaption({title:"19dad113-8ce6-4322-8849-f6a98b2a7931.jpg"}), "");
  assert.equal(visibleMediaCaption({title:"IMG_0027.HEIC"}), "");
  assert.equal(visibleMediaCaption({title:""}), "");
  assert.equal(visibleMediaCaption({title:"Um momento nosso ♡"}), "");
  assert.equal(visibleMediaCaption({title:"Nosso primeiro passeio"}), "Nosso primeiro passeio");
});
test("personal topics missing media sources return empty, not another person's music", async () => {
  const response = { code: 0, status(code){this.code = code;return this;}, setHeader(){}, json(value){this.body=value;return this;} };
  await universeHandler({method:"GET",query:{topic:"tecnologia",kind:"videos"}},response);
  assert.equal(response.code,200);
  assert.deepEqual(response.body.items,[]);
  assert.equal(response.body.topic,"tecnologia");
});
test("no duplicate profile, filename labels or privacy chooser in reels", async () => {
  const source = await readFile("assets/reels.js","utf8");
  assert.doesNotMatch(source, /data-reels-profile\b/);
  assert.doesNotMatch(source, /function profileHtml/);
  assert.doesNotMatch(source, /reels-counter|reels-type|reels-bottom/);
  assert.doesNotMatch(source, /name="visibility"/);
  assert.match(source, /const shared = true/);
  assert.match(source, /visibleMediaCaption\(item\)/);
});
test("events and songs require an explicit sharing choice", async () => {
  const app = await readFile("assets/app.js","utf8");
  const providers = await readFile("assets/connections.js","utf8");
  const cloud = await readFile("assets/cloud-records.js","utf8");
  assert.match(app,/record\.shared = \["event", "music"\]\.includes\(record\.type\)/);
  assert.match(app,/name="shared"/);
  assert.match(app,/form\.has\("shared"\)/);
  assert.match(app,/data-toggle-share/);
  assert.match(app,/shared: \["event", "music"\]\.includes\(input\.type\) \? false : true/);
  assert.match(cloud,/entry\.data\(\)\.sharingSelected !== true/);
  assert.match(providers,/title: "", \/\/ The Google Photos filename is not a caption/);
  assert.match(providers,/shared: false/);
});
test("only one editable profile and own personal topic selection remain",async()=>{
  const app=await readFile("assets/app.js","utf8");
  const universe=await readFile("assets/universe.js","utf8");
  assert.match(app,/id="profileForm"/);
  assert.match(app,/renderPersonalProfileFields/);
  assert.match(app,/name="universeTopics"/);
  assert.match(universe,/topicsForProfile\(snapshot\.data\(\) \|\| \{\}\)/);
  assert.doesNotMatch(universe,/const TOPICS = \["bts", "ballet"\]/);
  assert.match(universe,/state\.topics\.includes\(item\.topic\)/);
});


