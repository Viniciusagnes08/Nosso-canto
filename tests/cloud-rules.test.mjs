import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cloud rules restrict the couple space and preserve private ownership", async () => {
  const rules = await readFile("firestore.rules", "utf8");
  assert.match(rules, /viniciusagnes1092@gmail\.com/);
  assert.match(rules, /mirnacaterine@gmail\.com/);
  assert.match(rules, /resource\.data\.shared == true \|\| resource\.data\.authorId == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.authorId == request\.auth\.uid/);
  assert.match(rules, /allow write: if false/);
  assert.doesNotMatch(rules, /allow read, write: if true/);
});
