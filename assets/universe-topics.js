// Catalog of opt-in interests. Nothing is automatically selected for another account.
// Changes here must be mirrored by the fixed allowlist in api/universe.js.
export const TOPIC_CATALOG = Object.freeze([
  { id: "bts", label: "BTS", icon: "♫", media: true },
  { id: "ballet", label: "Ballet", icon: "✿", media: true },
  { id: "tecnologia", label: "Tecnologia", icon: "✧" },
  { id: "games", label: "Games", icon: "✦" },
  { id: "historia", label: "História", icon: "◈" },
  { id: "ciencia", label: "Ciência", icon: "◌" },
  { id: "cinema", label: "Cinema", icon: "▣" },
  { id: "fotografia", label: "Fotografia", icon: "◉" },
  { id: "automoveis", label: "Automóveis", icon: "◇" },
  { id: "esportes", label: "Esportes", icon: "★" },
  { id: "viagens", label: "Viagens", icon: "✧" },
  { id: "gastronomia", label: "Gastronomia", icon: "❋" },
  { id: "livros", label: "Livros", icon: "▤" },
  { id: "negocios", label: "Negócios", icon: "◆" },
  { id: "musica", label: "Música", icon: "♪", media: true },
  { id: "anime", label: "Anime", icon: "✧" }
]);
export const TOPIC_BY_ID = Object.freeze(Object.fromEntries(TOPIC_CATALOG.map(topic => [topic.id, topic])));
export function normalizeUniverseTopics(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === "string" && Object.hasOwn(TOPIC_BY_ID, id)))].slice(0, 8);
}
export function topicsForProfile(profile) {
  if (Array.isArray(profile?.universeTopics)) return normalizeUniverseTopics(profile.universeTopics);
  // Backward compatibility: an existing profile may have written interests as free text.
  const old = String(profile?.interests || "").toLocaleLowerCase("pt-BR")
    .split(/[,;|]/).map(x => x.trim()).filter(Boolean);
  return normalizeUniverseTopics(TOPIC_CATALOG.filter(topic =>
    old.some(value => value === topic.label.toLocaleLowerCase("pt-BR"))
  ).map(topic => topic.id));
}
