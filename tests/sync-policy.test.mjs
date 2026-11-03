import test from "node:test";
import assert from "node:assert/strict";
import { selectUnpublishedLegacy, visibleSnapshotVersion } from "../assets/core/sync-policy.js";

test("legacy migration only inserts missing own records; cloud wins", () => {
  const old = [
    { id:"photo-1", authorId:"me", title:"old local title" },
    { id:"photo-2", authorId:"me", title:"new local photo" },
    { id:"photo-2", authorId:"me", title:"duplicate" },
    { id:"other", authorId:"partner", title:"someone else's record" },
    { id:"", title:"invalid" }, null
  ];
  assert.deepEqual(selectUnpublishedLegacy(old, new Set(["photo-1"]), "me"),
    [{ id:"photo-2",authorId:"me",title:"new local photo" }]);
});
test("cloud snapshots are stable regardless of own/shared listener order", () => {
  const a = [{id:"z",type:"memory",authorId:"me",shared:true,updatedAt:{seconds:8,nanoseconds:0}},
    {id:"a",type:"event",authorId:"other",shared:true,updatedAt:{seconds:7,nanoseconds:0}}];
  assert.equal(visibleSnapshotVersion(a), visibleSnapshotVersion([...a].reverse()));
  assert.notEqual(visibleSnapshotVersion(a), visibleSnapshotVersion([{...a[0],title:"Changed"},a[1]]));
  assert.notEqual(visibleSnapshotVersion(a), visibleSnapshotVersion([a[0]]));
});
test("cloud sync must check existing IDs before any migration setDoc", async () => {
  const { readFile } = await import("node:fs/promises");
  const s = await readFile("assets/cloud-records.js", "utf8");
  assert.match(s, /selectUnpublishedLegacy/);
  assert.match(s, /getDocs\(/);
  assert.match(s, /visibleSnapshotVersion/);
});
