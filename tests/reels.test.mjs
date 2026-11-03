import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { identifyMedia, cleanProfile, isReelItem, uniqueFeed, canEditPost } from "../assets/reels-model.js";

test("accepts only image and short-video formats with strict limits", () => {
  assert.deepEqual(identifyMedia({ type: "image/gif", size: 500 }), { kind: "gif", ext: "gif" });
  assert.deepEqual(identifyMedia({ type: "video/mp4", size: 2000000 }), { kind: "video", ext: "mp4" });
  assert.deepEqual(identifyMedia({ type: "image/png", size: 1200 }), { kind: "photo", ext: "jpg" });
  assert.throws(() => identifyMedia({ type: "video/quicktime", size: 100 }), /JPG/);
  assert.throws(() => identifyMedia({ type: "video/mp4", size: 26 * 1024 * 1024 }), /limite/);
});
test("separate profiles sanitize input and reject untrusted avatar URLs", () => {
  const p = cleanProfile({ self: "  Pessoa  ", partner: "Parceira", bio: "Olá", interests: "Ballet", favoriteMusic: "Canção",
    avatarData: "javascript:alert(1)", anniversary: "2026-01-04" });
  assert.equal(p.self, "Pessoa");
  assert.equal(p.avatarData, "");
  assert.equal(p.interests, "Ballet");
  assert.equal(p.anniversary, "2026-01-04");
});
test("only shared items or authored private items appear in the intended feed", () => {
  const common = { type: "reel", mediaKind: "photo", mediaData: "data:image/jpeg;base64,aabb" };
  const a = { ...common, id:"a", authorId:"me", shared:true, created:"2026-11-03" };
  const b = { ...common, id:"b", authorId:"me", shared:false, created:"2026-11-02" };
  const c = { ...common, id:"c", authorId:"other", shared:false, created:"2026-11-01" };
  const d = { ...common, id:"d", authorId:"other", shared:true, created:"2026-10-31" };
  assert.deepEqual(uniqueFeed([a,b],[a,d,c],"me","shared").map(x=>x.id),["a","d"]);
  assert.deepEqual(uniqueFeed([a,b],[a,d,c],"me","mine").map(x=>x.id),["a","b"]);
  assert.equal(canEditPost(d,"me"),false);
  assert.equal(canEditPost(b,"me"),true);
});
test("recognizes already imported Google photos as feed items",()=>{
  assert.equal(isReelItem({type:"memory",photoId:"photo-123"}),true);
  assert.equal(isReelItem({type:"mood",photoId:"photo-123"}),false);
});
test("security rules preserve author-only writes, members-only shared media", async () => {
  const s = await readFile("storage.rules", "utf8");
  assert.match(s, /request\.auth\.uid == authorId/);
  assert.match(s, /resource\.metadata\.shared == 'true'/);
  assert.match(s, /allow list: if false/);
  assert.doesNotMatch(s, /allow read, write: if true/);
});
test("new Reels route is actually included by the static app build",async()=>{
  const app=await readFile("assets/app.js","utf8");
  const html=await readFile("index.html","utf8");
  const build=await readFile("scripts/build.mjs","utf8");
  assert.match(app,/mountReels\(user\)/);
  assert.match(html,/id="reelsRoot"/);
  assert.match(html,/data-reels-open/);
  assert.match(build,/"reels\.css"/);
});

