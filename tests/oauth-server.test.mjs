import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("OAuth backend requires a Firebase session and never exposes provider state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nosso-canto-oauth-"));
  const port = 19000 + Math.floor(Math.random() * 1000);
  const server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      OAUTH_DATA_DIR: directory,
      TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    },
    stdio: "ignore",
  });
  try {
    let response;
    for (let i=0;i<30;i++) {
      try { response = await fetch(`http://127.0.0.1:${port}/api/connections/status`); break; }
      catch { await new Promise(r=>setTimeout(r,100)); }
    }
    assert.ok(response, "server starts");
    assert.equal(response.status,401);
    assert.match((await response.json()).error,/Entre novamente/);
  } finally {
    if(server.exitCode===null) {
      server.kill();
      await once(server,"exit").catch(()=>{});
    }
    await rm(directory,{recursive:true,force:true});
  }
});

