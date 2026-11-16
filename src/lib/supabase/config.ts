export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
  } catch { return null; }
  // This integration deliberately accepts only publishable keys, never service keys.
  if (!key.startsWith("sb_publishable_")) return null;
  return { url, key };
}

export function getAppOrigin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL no está configurada");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("APP_URL debe ser un origen");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("APP_URL requiere HTTPS salvo en desarrollo local");
  return url.origin;
}
