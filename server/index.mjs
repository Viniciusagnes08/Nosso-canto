import http from "node:http";
import { readFile, writeFile, rename, mkdir, stat } from "node:fs/promises";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { join, normalize } from "node:path";
import { createRemoteJWKSet, jwtVerify } from "jose";

const origin = process.env.APP_ORIGIN || "https://nossocanto.space";
const dataDir = process.env.OAUTH_DATA_DIR || "/data";
const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64");
if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 random bytes in base64");
const firebaseKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const clients = {
  photos: { kind: "google", scope: "https://www.googleapis.com/auth/photospicker.mediaitems.readonly" },
  calendar: { kind: "google", scope: "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly" },
  youtube: { kind: "google", scope: "https://www.googleapis.com/auth/youtube.readonly" },
  spotify: { kind: "spotify", scope: "user-library-read user-read-recently-played" },
};
const pending = new Map();
const dataPath = join(dataDir, "connections.enc.json");
let database = {};
try { database = JSON.parse(await readFile(dataPath, "utf8")); } catch (error) {
  if (error.code !== "ENOENT") throw error;
}
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
function decrypt(value) {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
}
let writeQueue = Promise.resolve();
function save() {
  const snapshot = JSON.stringify(database);
  writeQueue = writeQueue.then(async () => {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const temp = dataPath + ".tmp";
    await writeFile(temp, snapshot, { mode: 0o600 });
    await rename(temp, dataPath);
  });
  return writeQueue;
}
function send(res, status, value, headers={}) {
  res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", ...headers });
  res.end(JSON.stringify(value));
}
async function userFrom(req) {
  const token = (req.headers.authorization || "").match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Entre novamente.");
  const verified = await jwtVerify(token, firebaseKeys, {issuer:"https://securetoken.google.com/nosso-canto-19a39",audience:"nosso-canto-19a39",algorithms:["RS256"]});
  if (!verified.payload.sub) throw new Error("Sessão inválida.");
  return verified.payload.sub;
}
function config(provider) {
  const p = clients[provider];
  if (!p) throw new Error("Integração inválida.");
  const google = p.kind === "google";
  const id = process.env[google ? "GOOGLE_CLIENT_ID" : "SPOTIFY_CLIENT_ID"];
  const secret = process.env[google ? "GOOGLE_CLIENT_SECRET" : "SPOTIFY_CLIENT_SECRET"];
  if (!id || !secret) throw new Error("Integração ainda não configurada no servidor.");
  return { ...p, id, secret };
}
function redirect(provider) { return origin + (provider === "spotify" ? "/spotify-callback.html" : "/api/oauth/callback/google"); }
async function exchange(provider, params) {
  const p = config(provider);
  const google = p.kind === "google";
  const body = new URLSearchParams({ client_id:p.id, client_secret:p.secret, ...params });
  const response = await fetch(google ? "https://oauth2.googleapis.com/token" : "https://accounts.spotify.com/api/token", {
    method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body, signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("O provedor recusou a conexão. Confira o cadastro OAuth.");
  return response.json();
}
async function access(uid, provider) {
  const saved = database[uid]?.[provider];
  if (!saved) throw new Error("Conecte esta conta primeiro.");
  const token = decrypt(saved);
  if (token.expires > Date.now() + 60000) return token.access_token;
  const updated = await exchange(provider, { grant_type:"refresh_token", refresh_token:token.refresh_token });
  const next = { ...token, ...updated, refresh_token:updated.refresh_token || token.refresh_token, expires:Date.now() + updated.expires_in * 1000 };
  database[uid][provider] = encrypt(next);
  await save();
  return next.access_token;
}
function bodyJson(req) {
  return new Promise((resolve,reject) => {
    let s = "";
    req.on("data", x => { s += x; if (s.length > 20000) req.destroy(); });
    req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error("Dados inválidos.")); } });
    req.on("error", reject);
  });
}
async function api(req,res,url) {
  if (url.pathname === "/api/oauth/callback/google" || url.pathname === "/spotify-callback.html") {
    const state = url.searchParams.get("state");
    const cookie=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("nc_oauth_state="))?.slice(15);
    if(!state || cookie!==state) throw new Error("Conexão expirada neste navegador.");
    const attempt = pending.get(state);
    pending.delete(state);
    if (!attempt || attempt.created < Date.now()-600000 || url.searchParams.has("error")) throw new Error("Conexão cancelada ou expirada.");
    const token = await exchange(attempt.provider, { grant_type:"authorization_code", code:url.searchParams.get("code") || "", redirect_uri:redirect(attempt.provider) });
    if (!token.refresh_token) throw new Error("O provedor não concedeu acesso duradouro. Revogue o app e conecte novamente.");
    database[attempt.uid] ||= {};
    database[attempt.uid][attempt.provider] = encrypt({ ...token, expires:Date.now() + token.expires_in*1000 });
    await save();
    res.writeHead(302, { Location:origin + "/#ajustes", "Cache-Control":"no-store", "Set-Cookie":"nc_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" }); res.end(); return;
  }
  const uid = await userFrom(req);
  if (url.pathname === "/api/connections/status" && req.method === "GET") {
    return send(res,200,Object.fromEntries(Object.keys(clients).map(p => [p,{ connected:Boolean(database[uid]?.[p]), configured:Boolean(process.env[(clients[p].kind==="google"?"GOOGLE":"SPOTIFY")+"_CLIENT_SECRET"]) }])));
  }
  const provider = url.pathname.split("/")[3];
  if (!clients[provider]) return send(res,404,{error:"Integração inválida."});
  if (url.pathname.endsWith("/start") && req.method === "POST") {
    const p = config(provider);
    const state = randomBytes(32).toString("hex");
    pending.set(state,{uid,provider,created:Date.now()});
    const google = p.kind === "google";
    const target = new URL(google ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://accounts.spotify.com/authorize");
    target.search = new URLSearchParams({
      client_id:p.id, response_type:"code", redirect_uri:redirect(provider), scope:p.scope, state,
      ...(google ? {access_type:"offline",prompt:"consent",include_granted_scopes:"false"} : {show_dialog:"true"})
    }).toString();
    return send(res,200,{url:target.href},{"Set-Cookie":`nc_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`});
  }
  if (url.pathname.endsWith("/disconnect") && req.method === "POST") {
    const saved = database[uid]?.[provider];
    if (saved && clients[provider].kind==="google") {
      const token=decrypt(saved);
      await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token:token.refresh_token})}).catch(()=>{});
    }
    if (database[uid]) delete database[uid][provider];
    await save(); return send(res,200,{connected:false});
  }
  if (url.pathname.endsWith("/fetch") && req.method === "POST") {
    const input = await bodyJson(req);
    const target = new URL(input.url);
    const host = clients[provider].kind==="spotify" ? "api.spotify.com" : provider==="photos" ? "photospicker.googleapis.com" : provider==="calendar" ? "www.googleapis.com" : "www.googleapis.com";
    const prefix = provider==="calendar" ? "/calendar/v3/" : provider==="youtube" ? "/youtube/v3/" : provider==="photos" ? "/v1/" : "/v1/";
    if (target.protocol!=="https:" || target.hostname!==host || !target.pathname.startsWith(prefix)) return send(res,400,{error:"Destino inválido."});
    const bearer = await access(uid,provider);
    const upstream = await fetch(target,{method:input.method || "GET",headers:{Authorization:"Bearer "+bearer,...(input.body?{"Content-Type":"application/json"}:{})},body:input.body?JSON.stringify(input.body):undefined,signal:AbortSignal.timeout(20000)});
    const body = await upstream.arrayBuffer();
    if (upstream.status===204) return send(res,200,{});
    const parsed = JSON.parse(Buffer.from(body).toString());
    return send(res,upstream.status,parsed);
  }
  send(res,404,{error:"Rota inexistente."});
}
const root = join(process.cwd(),"dist");
http.createServer(async (req,res) => {
  try {
    const url=new URL(req.url,origin);
    if(url.pathname==="/api/photo" && req.method==="POST") {
      const uid=await userFrom(req);
      const input=await bodyJson(req);
      if(!/^[A-Za-z0-9_-]{1,200}$/.test(input.sessionId||"") || !/^[A-Za-z0-9_-]{1,300}$/.test(input.mediaId||"")) return send(res,400,{error:"Foto inválida."});
      const token=await access(uid,"photos");
      const session=await fetch(`https://photospicker.googleapis.com/v1/sessions/${input.sessionId}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!session.ok || !(await session.json()).mediaItemsSet) return send(res,403,{error:"Seleção não autorizada."});
      let match, pageToken;
      do {
        const listUrl=new URL("https://photospicker.googleapis.com/v1/mediaItems");
        listUrl.searchParams.set("sessionId",input.sessionId);
        listUrl.searchParams.set("pageSize","100");
        if(pageToken) listUrl.searchParams.set("pageToken",pageToken);
        const item=await fetch(listUrl,{headers:{Authorization:`Bearer ${token}`}});
        if(!item.ok) return send(res,502,{error:"Foto indisponível."});
        const page=await item.json();
        match=page.mediaItems?.find(x=>x.id===input.mediaId && x.type==="PHOTO");
        pageToken=page.nextPageToken;
      } while(!match && pageToken);
      if(!match?.mediaFile?.baseUrl) return send(res,404,{error:"Foto não encontrada na seleção."});
      const photoUrl=new URL(match.mediaFile.baseUrl);
      if(photoUrl.protocol!=="https:" || !(photoUrl.hostname==="googleusercontent.com" || photoUrl.hostname.endsWith(".googleusercontent.com"))) return send(res,403,{error:"Origem da foto inválida."});
      photoUrl.href += "=d";
      const photo=await fetch(photoUrl,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
      if(!photo.ok || !photo.headers.get("content-type")?.startsWith("image/")) return send(res,502,{error:"Foto indisponível."});
      const image=Buffer.from(await photo.arrayBuffer());
      if(image.length>16*1024*1024) return send(res,413,{error:"Foto muito grande."});
      res.writeHead(200,{"Content-Type":photo.headers.get("content-type"),"Cache-Control":"no-store"});res.end(image);return;
    }
    if(url.pathname.startsWith("/api/connections/") || url.pathname==="/api/oauth/callback/google" || url.pathname==="/spotify-callback.html") return await api(req,res,url);
    if(req.method!=="GET" && req.method!=="HEAD") return send(res,405,{error:"Método não permitido."});
    const file=normalize(join(root,decodeURIComponent(url.pathname==="/"?"/index.html":url.pathname)));
    if(!file.startsWith(root) || file.includes("\0")) return send(res,403,{error:"Acesso negado."});
    const item=await stat(file);
    if(!item.isFile()) return send(res,404,{error:"Arquivo não encontrado."});
    const ext=file.split(".").at(-1);
    const types={html:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",css:"text/css",svg:"image/svg+xml",json:"application/json",webmanifest:"application/manifest+json"};
    res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Cache-Control":ext==="html"?"no-cache":"public, max-age=3600"});
    res.end(await readFile(file));
  } catch(error) { send(res, /Entre novamente|JWT|token|Sessão inválida/.test(error.message)?401:500,{error:error.message}); }
}).listen(Number(process.env.PORT || 8766),"0.0.0.0");

