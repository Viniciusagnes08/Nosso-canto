const safe = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ],
  );
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
const localDay = (d = new Date()) => {
  const x = new Date(d);
  return (
    x.getFullYear() +
    "-" +
    String(x.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(x.getDate()).padStart(2, "0")
  );
};
const displayDate = (d, opts = {}) =>
  new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString(
    "pt-BR",
    opts,
  );
const dateTime = (d) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export { safe, uid, localDay, displayDate, dateTime };
