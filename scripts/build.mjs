import { build } from "esbuild";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
const output = new URL("../dist/", import.meta.url);
await mkdir(output, { recursive: true });
// Only these public values may enter the browser bundle. No secrets are used.
const config = Object.fromEntries(
  [
    "AUTH_PROVIDER",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "GOOGLE_CLIENT_ID",
    "SPOTIFY_CLIENT_ID",
    "GOOGLE_LOGIN_ENABLED",
  ].map((key) => [key, process.env[key] || (key === "AUTH_PROVIDER" ? "firebase" : "")]),
);
await build({
  entryPoints: ["assets/boot.js", "assets/spotify-callback.js"],
  outdir: "dist/assets",
  bundle: true,
  splitting: true,
  format: "esm",
  target: ["es2022"],
  minify: true,
  define: { __PUBLIC_CONFIG__: JSON.stringify(config) },
});
for (const file of [
  "index.html",
  "privacy.html",
  "spotify-callback.html",
  "manifest.webmanifest",
])
  await cp(file, new URL(file, output));
for (const file of [
  "styles.css",
  "layout.css",
  "account.css",
  "mood.css",
  "icon.svg",
])
  await cp("assets/" + file, new URL("assets/" + file, output));
// Authenticated data and third-party tokens are never cached by the worker.
await cp("sw.js", new URL("sw.js", output));
console.log(
  "Built login and application. Public configuration: " +
    Object.entries(config)
      .map(([key, val]) => key + ": " + (val ? "configured" : "missing"))
      .join(", "),
);

await cp("assets/stickers", new URL("assets/stickers/", output), {
  recursive: true,
});
