import { auth, requireUser, clearConnections } from "./auth.js";
import { authConfigured, config } from "./config.js";
import { safe } from "./utils.js";
let mode = "login",
  started = false,
  recovery = false;
const root = document.querySelector("#accountRoot");
const panel = document.querySelector("#privateApp");
const titles = {
  magic: [
    "Um link para o seu cantinho.",
    "Receba um link de acesso no seu e-mail, sem digitar uma senha.",
  ],
  login: [
    "Seu lugar é aqui.",
    "Entre para cuidar dos pequenos detalhes da sua história.",
  ],
  signup: [
    "Uma história, dois corações.",
    "Crie sua conta. As conexões com suas outras contas são opcionais.",
  ],
  reset: [
    "Vamos te ajudar.",
    "Enviaremos um link para você escolher uma nova senha.",
  ],
  recovery: ["Um novo começo.", "Escolha uma nova senha para sua conta."],
};
export function renderAccount(message = "") {
  if (config.AUTH_PROVIDER === "firebase") return renderGoogleAccount(message);
  panel.hidden = true;
  root.hidden = false;
  root.classList.toggle("account-unconfigured", !authConfigured);
  const [title, subtitle] = titles[mode];
  root.innerHTML = `<div class="account-story"><a class="account-brand" href="/">♡ entre nós.</a><span class="eyebrow">UM AMOR, DOIS LUGARES</span><h1>Perto,<br>mesmo <em>de longe.</em></h1><p>Um lugar para o seu dia, as nossas músicas e tudo aquilo que faz a saudade virar presença.</p><div class="orbit-art" aria-hidden="true"><span>♡</span><span>✧</span><span>♫</span></div><small>Pequenos gestos. Todos os dias.</small></div><section class="account-form-panel" aria-labelledby="accountTitle"><div class="account-form-inner"><span class="eyebrow">NOSSO CANTINHO</span><h2 id="accountTitle">${title}</h2><p>${subtitle}</p>${!authConfigured ? '<div class="notice">Estamos preparando a entrada no nosso cantinho. O login ainda não está disponível.</div>' : ""}<form id="accountForm">${mode !== "recovery" ? '<div class="field"><label for="accountEmail">Seu e-mail</label><input id="accountEmail" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="voce@exemplo.com"></div>' : ""}${!["reset", "magic"].includes(mode) ? `<div class="field"><label for="accountPassword">${mode === "recovery" ? "Nova senha" : "Sua senha"}</label><div class="password-wrap"><input id="accountPassword" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required minlength="${mode === "login" ? 1 : 12}" maxlength="128"><button type="button" id="showPassword" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div>${mode !== "login" ? '<p class="form-hint">Use pelo menos 12 caracteres.</p>' : ""}</div>` : ""}<p id="accountFeedback" role="status" aria-live="polite">${safe(message)}</p><button class="btn btn-primary account-submit" type="submit" ${!authConfigured ? "disabled" : ""}>${{ login: "Entrar no nosso cantinho", signup: "Criar minha conta", reset: "Enviar link de recuperação", recovery: "Salvar nova senha", magic: "Enviar meu link de acesso" }[mode]}</button></form>${mode === "login" ? `<button id="googleLogin" class="btn btn-line account-submit" style="margin-top:12px" ${authConfigured && config.GOOGLE_LOGIN_ENABLED === "true" ? "" : "disabled"}>Entrar com Google</button>` : ""}<div class="account-links">${mode === "login" ? '<button data-account-mode="magic">Entrar com link por e-mail</button><br><button data-account-mode="reset">Esqueci minha senha</button><p>Ainda não tem conta? <button data-account-mode="signup">Criar conta</button></p>' : '<button data-account-mode="login">Voltar para entrar</button>'}</div>${!authConfigured ? `<div class="account-local-access"><button id="localOnlyEntry" type="button" class="btn btn-soft account-submit">Entrar no meu espaço neste dispositivo</button><p class="account-local-note">Entrada local, sem conta: seus registros ficam apenas neste navegador, separados dos dados de qualquer usuário autenticado. Não há sincronização com outra pessoa ou acesso a Google/Spotify.</p></div>` : ""}<p class="account-footnote">Cada um tem seu próprio acesso. Conectar Google ou Spotify é sempre uma escolha sua.</p></div></section>`;
  root.querySelectorAll("[data-account-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.accountMode;
      renderAccount();
    }),
  );
  root.querySelector("#showPassword")?.addEventListener("click", (e) => {
    const input = root.querySelector("#accountPassword"),
      show = input.type === "password";
    input.type = show ? "text" : "password";
    e.target.textContent = show ? "Ocultar" : "Mostrar";
    e.target.setAttribute("aria-pressed", String(show));
    e.target.setAttribute(
      "aria-label",
      show ? "Ocultar senha" : "Mostrar senha",
    );
  });
  root
    .querySelector("#googleLogin")
    ?.addEventListener("click", async (event) => {
      if (!auth || config.GOOGLE_LOGIN_ENABLED !== "true") return;
      event.target.disabled = true;
      try {
        const { error } = await auth.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.origin + "/" },
        });
        if (error) throw error;
      } catch {
        root.querySelector("#accountFeedback").textContent =
          "Não foi possível iniciar a entrada com Google.";
        event.target.disabled = false;
      }
    });
  root.querySelector("#localOnlyEntry")?.addEventListener("click", enterLocalOnly);
  root.querySelector("form").addEventListener("submit", submit);
}
async function enterLocalOnly() {
  // This is an isolated, on-device workspace. It must never grant Supabase or provider access.
  if (authConfigured || started) return;
  const button = root.querySelector("#localOnlyEntry");
  if (button) button.disabled = true;
  sessionStorage.removeItem("nc-active-user");
  root.hidden = true;
  panel.hidden = false;
  try {
    const app = await import("./app.js");
    app.startApp({ id: "local-only-v1" }, { localOnly: true });
    started = true;
  } catch {
    panel.hidden = true;
    root.hidden = false;
    renderAccount("Não foi possível abrir o modo local. Atualize a página e tente novamente.");
  }
}
function friendly(error) {
  const code = error?.code;
  if (code === "invalid_credentials")
    return "Confira o e-mail e a senha e tente novamente.";
  if (code === "email_not_confirmed")
    return "Confirme seu e-mail antes de entrar.";
  if (code === "over_email_send_rate_limit" || error?.status === 429)
    return "Aguarde um pouco antes de tentar novamente.";
  return "Não foi possível concluir. Confira seus dados e tente novamente.";
}
async function submit(event) {
  event.preventDefault();
  if (!auth) return;
  const form = event.target,
    b = form.querySelector("[type=submit]"),
    values = new FormData(form),
    feedback = root.querySelector("#accountFeedback");
  b.disabled = true;
  feedback.textContent = "Só um instante…";
  try {
    const email = String(values.get("email") || "").trim(),
      password = String(values.get("password") || "");
    let result;
    if (mode === "login") {
      result = await auth.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      await enter();
      return;
    }
    if (mode === "signup") {
      result = await auth.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: location.origin + "/" },
      });
      if (result.error) throw result.error;
      if (result.data.session) {
        await enter();
        return;
      }
      feedback.textContent =
        "Confira sua caixa de entrada para confirmar o e-mail. Depois, volte para entrar.";
    }
    if (mode === "magic") {
      result = await auth.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: location.origin + "/",
        },
      });
      if (result.error) throw result.error;
      feedback.textContent =
        "Se a conta estiver cadastrada, você receberá um link para entrar neste navegador.";
    }
    if (mode === "reset") {
      result = await auth.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + "/?recovery=1",
      });
      if (result.error) throw result.error;
      feedback.textContent =
        "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.";
    }
    if (mode === "recovery") {
      result = await auth.auth.updateUser({ password });
      if (result.error) throw result.error;
      recovery = false;
      history.replaceState(null, "", "/");
      await enter();
      return;
    }
    form.querySelector("[name=password]")?.setAttribute("value", "");
    if (form.elements.password) form.elements.password.value = "";
  } catch (error) {
    feedback.textContent = friendly(error);
  } finally {
    b.disabled = false;
  }
}
async function enter() {
  if (recovery || started) return;
  const user = await requireUser();
  sessionStorage.setItem("nc-active-user", user.id);
  root.hidden = true;
  panel.hidden = false;
  try {
    const app = await import("./app.js");
    await app.startApp(user);
    started = true;
  } catch {
    panel.hidden = true;
    root.hidden = false;
    renderAccount(
      "Não foi possível abrir seu cantinho. Atualize a página para tentar novamente.",
    );
  }
}
async function boot() {
  renderAccount();
  if (!auth) return;
  recovery = new URLSearchParams(location.search).get("recovery") === "1";
  auth.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recovery = true;
      mode = "recovery";
      renderAccount();
    }
    if (event === "SIGNED_OUT") {
      clearConnections();
      panel.hidden = true;
      root.hidden = false;
      sessionStorage.removeItem("nc-active-user");
      if (started) location.replace("/");
      else {
        mode = "login";
        renderAccount();
      }
    }
  });
  try {
    const { data, error } = await auth.auth.getSession();
    if (error) throw error;
    if (data.session) {
      if (recovery) {
        mode = "recovery";
        renderAccount();
      } else await enter();
    }
  } catch {
    renderAccount("Sua sessão terminou. Entre novamente.");
  }
}
boot();

function renderGoogleAccount(message = "") {
  panel.hidden = true;
  root.hidden = false;
  root.classList.remove('account-unconfigured');
  root.innerHTML = `<div class="account-story"><a class="account-brand" href="/">♡ entre nós.</a><span class="eyebrow">UM AMOR, DOIS LUGARES</span><h1>Perto,<br>mesmo <em>de longe.</em></h1><p>Um lugar para os pequenos detalhes da nossa história.</p></div><section class="account-form-panel"><div class="account-form-inner"><span class="eyebrow">NOSSO CANTINHO</span><h2>Seu lugar é aqui.</h2><p>Entre com sua conta Google. Você continuará conectado neste aparelho até escolher sair.</p><p id="accountFeedback" role="status" aria-live="polite">${safe(message)}</p><button id="googleLogin" class="btn btn-primary account-submit">Entrar com Google</button><p class="account-footnote">Usamos seu nome, e-mail e foto de perfil. Não temos acesso às mensagens do seu Gmail.</p></div></section>`;
  root.querySelector('#googleLogin').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    try {
      await auth.auth.signInWithOAuth({ provider: 'google' });
      await enter();
    } catch (error) {
      const messages = {
        'auth/popup-closed-by-user': 'A janela foi fechada. Clique novamente para entrar.',
        'auth/popup-blocked': 'Permita a janela de entrada do Google neste navegador e tente novamente.',
        'auth/unauthorized-domain': 'Este endereço ainda não foi autorizado para entrar com Google.',
        'auth/network-request-failed': 'Confira sua conexão e tente novamente.',
      };
      renderGoogleAccount(messages[error?.code] || 'Não foi possível entrar. Tente novamente.');
    }
  });
}
