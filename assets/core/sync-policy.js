/**
 * Importação de registros legados guardados no dispositivo.
 * A cópia remota é a fonte de verdade. Nunca sobrescrever registros existentes
 * durante um login, mesmo que a cache local contenha uma versão antiga.
 */
export function selectUnpublishedLegacy(records, knownIds, uid) {
  const ids = knownIds instanceof Set ? knownIds : new Set(knownIds);
  const selected = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record.id !== "string" || !record.id) continue;
    if (record.authorId && record.authorId !== uid) continue;
    if (ids.has(record.id)) continue;
    if (!selected.has(record.id)) selected.set(record.id, record);
  }
  return [...selected.values()];
}

/**
 * Fingerprint de mudanças relevantes da coleção (sem serializar dados de imagens).
 * O campo updatedAt é preenchido em todas as escritas do repositório.
 */
export function visibleSnapshotVersion(items) {
  return items
    .map(item => {
      const t = item.updatedAt;
      const time = t && typeof t.seconds === "number"
        ? t.seconds + "." + (t.nanoseconds || 0)
        : String(t || "");
      return [item.id, item.type, item.authorId, String(item.shared), time,
        item.title || "", item.photoId || "", (item.photoData || "").length].join("|");
    }).sort().join("\n");
}
