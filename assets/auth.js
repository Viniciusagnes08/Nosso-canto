import { createClient } from "@supabase/supabase-js";
import { config, authConfigured } from "./config.js";
export const auth = authConfigured
  ? createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: sessionStorage,
        storageKey: "nosso-canto-auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !location.pathname.endsWith(
          "spotify-callback.html",
        ),
        flowType: "pkce",
      },
    })
  : null;
export async function requireUser() {
  if (!auth) throw new Error("O login ainda não foi ativado.");
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) throw new Error("Entre novamente para continuar.");
  return data.user;
}
export function clearConnections() {
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k.startsWith("nc-oauth:") || k.startsWith("nc-spotify:"))
      sessionStorage.removeItem(k);
  }
}
export async function logout() {
  clearConnections();
  const { error } = await auth.auth.signOut({ scope: "local" });
  if (error)
    throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  location.replace("/");
}
