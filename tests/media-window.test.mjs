import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { visibleMediaWindow, inMediaWindow, reelViewVersion } from "../assets/core/media-window.js";

test("only active reel and adjacent items need a decoded blob", () => {
  assert.deepEqual(visibleMediaWindow(0, 36), [0,1]);
  assert.deepEqual(visibleMediaWindow(18, 36), [17,18,19]);
  assert.deepEqual(visibleMediaWindow(35, 36), [34,35]);
  assert.equal(inMediaWindow(17, 20, 36), false);
  assert.equal(inMediaWindow(19, 20, 36), true);
});
test("unchanged Firestore snapshots do not require rebuilding the scrolling feed", () => {
  const a = [{ id:"1", updatedAt:{ seconds:9 }, shared:true, title:"A" }];
  assert.equal(reelViewVersion(a), reelViewVersion(structuredClone(a)));
  assert.notEqual(reelViewVersion(a), reelViewVersion([{...a[0],title:"B"}]));
});
test("reels media load is not limited to original uploader's device", async () => {
  const code = await readFile("assets/reels.js", "utf8");
  assert.doesNotMatch(code, /item\.photoId\s*&&\s*item\.authorId\s*===\s*state\.user/);
  assert.match(code, /mediaGet\(item\.photoId\)/);
  assert.match(code, /releaseOutsideWindow/);
  assert.match(code, /inMediaWindow/);
  assert.match(code, /reelViewVersion/);
});
