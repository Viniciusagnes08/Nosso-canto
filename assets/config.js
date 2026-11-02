export const config =
  typeof __PUBLIC_CONFIG__ !== "undefined" ? __PUBLIC_CONFIG__ : {};
export const authConfigured = Boolean(
  config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY,
);
