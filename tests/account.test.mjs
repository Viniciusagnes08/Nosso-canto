import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
async function fixture(configured) {
  const compiled = await build({
    entryPoints: ["assets/boot.js"],
    bundle: true,
    format: "iife",
    write: false,
    define: {
      __PUBLIC_CONFIG__: JSON.stringify(
        configured
          ? {
              SUPABASE_URL: "https://example.supabase.co",
              SUPABASE_PUBLISHABLE_KEY: "public-test",
            }
          : {},
      ),
    },
    plugins: [
      {
        name: "auth-fixture",
        setup(b) {
          b.onResolve({ filter: /\/auth\.js$/ }, () => ({
            path: "auth",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents: `export const auth={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({}),signInWithPassword:async()=>({error:{code:'invalid_credentials'}})}};export const requireUser=async()=>{throw Error('no session')};export const clearConnections=()=>{};export const logout=()=>{};`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const dom = new JSDOM(await readFile("index.html", "utf8"), {
    url: "https://app.example/",
    runScripts: "outside-only",
  });
  dom.window.eval(compiled.outputFiles[0].text);
  await new Promise((r) => setTimeout(r, 10));
  return dom;
}
test("login fails closed when configuration is missing", async () => {
  const dom = await fixture(false),
    d = dom.window.document;
  assert.equal(d.querySelector("#privateApp").hidden, true);
  assert.equal(d.querySelector("#accountRoot").hidden, false);
  assert.equal(d.querySelector(".account-submit").disabled, true);
  assert.ok(
    d
      .querySelector("#accountRoot")
      .textContent.includes("ainda não está disponível"),
  );
  assert.ok(d.querySelector("#localOnlyEntry"), "on-device entry is available");
  assert.equal(d.querySelector("#localOnlyEntry").disabled, false);
  assert.equal(d.querySelector("#accountRoot").classList.contains("account-unconfigured"), true);
  assert.ok(d.querySelector("#accountRoot").textContent.includes("sem conta"));

  dom.window.close();
});
test("login offers labelled fields, password visibility and recovery", async () => {
  const dom = await fixture(true),
    d = dom.window.document;
  assert.equal(d.querySelector("#localOnlyEntry"), null, "local entry is hidden when real auth is configured");
  assert.equal(d.querySelector("#accountRoot").classList.contains("account-unconfigured"), false);
  assert.equal(d.querySelector("#accountEmail").type, "email");
  assert.equal(
    d.querySelector("#accountPassword").autocomplete,
    "current-password",
  );
  d.querySelector("#showPassword").click();
  assert.equal(d.querySelector("#accountPassword").type, "text");
  assert.equal(
    d.querySelector("#showPassword").getAttribute("aria-pressed"),
    "true",
  );
  d.querySelector("[data-account-mode=reset]").click();
  assert.equal(d.querySelector("#accountPassword"), null);
  assert.ok(
    d.querySelector(".account-submit").textContent.includes("recuperação"),
  );
  d.querySelector("[data-account-mode=login]").click();
  d.querySelector("[data-account-mode=signup]").click();
  assert.equal(d.querySelector("#accountPassword").minLength, 12);
  assert.equal(
    d.querySelector("#accountPassword").autocomplete,
    "new-password",
  );
  dom.window.close();
});
test("invalid password does not reveal the private application", async () => {
  const dom = await fixture(true),
    d = dom.window.document;
  d.querySelector("#accountEmail").value = "person@example.invalid";
  d.querySelector("#accountPassword").value = "wrong";
  d.querySelector("#accountForm").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(d.querySelector("#privateApp").hidden, true);
  assert.ok(
    d
      .querySelector("#accountFeedback")
      .textContent.includes("Confira o e-mail"),
  );
  dom.window.close();
});
