import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, GOOGLE_OAUTH_ENABLED } from "./auth-config.js";
const $ = (selector) => document.querySelector(selector);
const configReady = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
let client = null;
let preview = false;
let inFlight = false;
function feedback(message, tone = "info") {
  const el = $("#loginFeedback");
  el.textContent = message;
  el.dataset.tone = tone;
}
function showLogin() {
  document.body.dataset.authMode = "login";
  $("#loginSuccess").hidden = true;
  $("#loginForm").hidden = false;
  $(".login-divider").hidden = false;
  $("#loginGoogle").hidden = false;
  $("#loginConfigNote").hidden = configReady;
  $("#loginEmailButton").disabled = !configReady;
  $("#loginGoogle").disabled = !configReady || !GOOGLE_OAUTH_ENABLED;
  $("#loginEmailButton").title = configReady ? "" : "Aguardando configuração do Supabase pessoal";
  $("#loginGoogle").title = !configReady ? "Aguardando configuração do Supabase pessoal" : !GOOGLE_OAUTH_ENABLED ? "Login Google ainda não habilitado" : "";
}
function showApp(isPreview = false) {
  preview = isPreview;
  document.body.dataset.authMode = "app";
  if (!$("#logoutButton")) {
    const b = document.createElement("button");
    b.id = "logoutButton";
    b.type = "button";
    b.className = "login-logout";
    b.textContent = "Sair";
    b.addEventListener("click", logout);
    $(".topbar").append(b);
  }
}
async function logout() {
  if (inFlight) return;
  if (!preview && client) {
    inFlight = true;
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch {
      window.alert("Não foi possível encerrar a sessão. Tente novamente.");
      inFlight = false;
      return;
    }
    inFlight = false;
  }
  preview = false;
  showLogin();
  feedback("");
}
async function initialize() {
  if (!configReady) { showLogin(); return; }
  try {
    // Fixed CDN version, used only after a public project URL and publishable key are configured.
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4");
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session?.user) showApp(false);
    else showLogin();
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) showApp(false);
      else if (!preview) showLogin();
    });
  } catch {
    showLogin();
    feedback("Não foi possível conectar ao serviço de acesso. Confira a configuração e tente novamente.", "error");
  }
}
$("#loginPreview").addEventListener("click", () => showApp(true));
$("#loginAgain").addEventListener("click", () => { showLogin(); feedback(""); $("#loginEmail").focus(); });
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configReady || !client || inFlight) return;
  const email = $("#loginEmail").value.trim();
  if (!$("#loginForm").reportValidity()) return;
  inFlight = true;
  $("#loginEmailButton").disabled = true;
  feedback("Enviando seu link de acesso...");
  try {
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    $("#loginForm").hidden = true;
    $(".login-divider").hidden = true;
    $("#loginGoogle").hidden = true;
    $("#loginSuccess").hidden = false;
    $("#loginSuccessText").textContent = "Se o endereço estiver autorizado, você receberá um link em " + email + ". Abra-o neste navegador para entrar.";
    feedback("");
  } catch {
    feedback("Não foi possível enviar o link. Verifique o e-mail e tente novamente.", "error");
  } finally {
    inFlight = false;
    $("#loginEmailButton").disabled = !configReady;
  }
});
$("#loginGoogle").addEventListener("click", async () => {
  if (!configReady || !client || !GOOGLE_OAUTH_ENABLED || inFlight) return;
  inFlight = true;
  $("#loginGoogle").disabled = true;
  feedback("Abrindo a entrada com Google...");
  try {
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
    if (error) throw error;
  } catch {
    inFlight = false;
    $("#loginGoogle").disabled = false;
    feedback("Não foi possível iniciar o login com Google. Tente novamente.", "error");
  }
});
initialize();