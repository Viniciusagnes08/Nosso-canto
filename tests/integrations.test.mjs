import test from "node:test";
import assert from "node:assert/strict";
import {
  eventToRecord,
  trackToRecord,
  validateOAuthAttempt,
  seconds,
} from "../assets/integration-models.js";
import handler, { validPhotoHost, readLimited } from "../api/photo.js";

test("calendar imports selected data privately and preserves all-day date", () => {
  const r = eventToRecord(
    { id: "a", summary: "Consulta", start: { date: "2026-11-03" } },
    "c",
  );
  assert.equal(r.date, "2026-11-03");
  assert.equal(r.shared, false);
  assert.equal(r.externalId, "c:a");
  assert.equal(r.time, "");
  assert.equal(
    eventToRecord({
      id: "a",
      status: "cancelled",
      start: { date: "2026-11-03" },
    }),
    null,
  );
});
test("busy-only does not retain event title or description", () => {
  const r = eventToRecord(
    {
      id: "a",
      summary: "Private detail",
      description: "Sensitive note",
      start: { date: "2026-11-03" },
    },
    "c",
    true,
  );
  assert.equal(r.title, "Horário ocupado");
  assert.ok(!JSON.stringify(r).includes("Private detail"));
  assert.ok(!JSON.stringify(r).includes("Sensitive note"));
});
test("spotify imports only Spotify HTTPS links, privately", () => {
  const track = {
    id: "a",
    name: "Uma canção",
    artists: [{ name: "Artista" }],
    external_urls: { spotify: "https://open.spotify.com/track/a" },
  };
  assert.equal(trackToRecord(track).shared, false);
  assert.equal(
    trackToRecord({
      ...track,
      external_urls: { spotify: "javascript:alert(1)" },
    }),
    null,
  );
  assert.equal(
    trackToRecord({
      ...track,
      external_urls: { spotify: "https://evil.example/a" },
    }),
    null,
  );
});
test("OAuth state binds user, age and verifier", () => {
  const state = "s".repeat(64),
    attempt = { state, userId: "a", created: 1000, verifier: "v".repeat(64) };
  assert.equal(
    validateOAuthAttempt(attempt, { state, userId: "a", now: 2000 }),
    true,
  );
  for (const input of [
    { state: "wrong", userId: "a", now: 2000 },
    { state, userId: "b", now: 2000 },
    { state, userId: "a", now: 700000 },
    { state, userId: "a", now: 0 },
  ])
    assert.equal(validateOAuthAttempt(attempt, input), false);
});
test("photo proxy rejects arbitrary and deceptive hosts", () => {
  assert.equal(validPhotoHost("https://lh3.googleusercontent.com/a"), true);
  for (const x of [
    "http://lh3.googleusercontent.com/a",
    "https://lh3.googleusercontent.com.evil.example/a",
    "https://127.0.0.1/a",
    "https://evil.example",
    "https://user:pass@lh3.googleusercontent.com/a",
  ])
    assert.equal(validPhotoHost(x), false);
});
test("photo body enforces byte limit without trusting Content-Length", async () => {
  await assert.rejects(
    () => readLimited(new Response(new Uint8Array(20)), 10),
    /too large/,
  );
  assert.equal(
    (await readLimited(new Response(new Uint8Array(4)), 10)).length,
    4,
  );
});
function response() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(s) {
      this.statusCode = s;
      return this;
    },
    json(x) {
      this.body = x;
      return this;
    },
    send(x) {
      this.body = x;
      return this;
    },
  };
}
test("photo API rejects unauthenticated and misconfigured requests", async () => {
  const oldKey = process.env.FIREBASE_API_KEY;
  try {
    delete process.env.FIREBASE_API_KEY;
    let res = response();
    await handler({ method: "POST", headers: {} }, res);
    assert.equal(res.statusCode, 503);
    process.env.FIREBASE_API_KEY = "test";
    res = response();
    await handler({ method: "POST", headers: {} }, res);
    assert.equal(res.statusCode, 401);
    res = response();
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 405);
  } finally {
    if (oldKey === undefined) delete process.env.FIREBASE_API_KEY;
    else process.env.FIREBASE_API_KEY = oldKey;
  }
});
test("poll timing follows provider duration strings", () => {
  assert.equal(seconds("5s", 1), 5);
  assert.equal(seconds("bad", 7), 7);
});
