/**
 * Generate an official Spotify embed only for validated content URLs.
 * No tokens, streaming downloads or audio files are ever handled by Nosso Canto.
 */
export function spotifyEmbedUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return "";
    const segments = url.pathname.split("/").filter(Boolean);
    const path = segments[0]?.startsWith("intl-") ? segments.slice(1) : segments;
    if (!["track", "album", "playlist", "episode", "show"].includes(path[0]))
      return "";
    if (!/^[a-zA-Z0-9]{22}$/.test(path[1] || "") || path.length !== 2) return "";
    return "https://open.spotify.com/embed/" + path[0] + "/" + path[1];
  } catch { return ""; }
}

let installed = false;
let dialog;
function ensureDialog() {
  if (dialog) return;
  dialog = document.createElement("dialog");
  dialog.className = "nc-music-dialog";
  dialog.setAttribute("aria-labelledby", "ncMusicTitle");
  dialog.innerHTML = [
    '<div class="nc-music-panel"><header class="nc-music-header">',
    '<div><span class="nc-gallery-eyebrow">NOSSA TRILHA SONORA</span><h2 id="ncMusicTitle">Uma música que nos lembra</h2></div>',
    '<button class="nc-gallery-close" data-music-close type="button" aria-label="Fechar player">Fechar ×</button>',
    '</header>',
    '<div class="nc-record-scene" aria-hidden="true"><div class="nc-record-disc"><div class="nc-record-label">♡<small>entre nós</small></div></div></div>',
    '<p class="nc-music-note">O Spotify reproduz o conteúdo no próprio player oficial. A duração disponível depende da sua conta e do serviço.</p>',
    '<div class="nc-spotify-frame"><p class="nc-music-loading" role="status">Abrindo o Spotify…</p></div>',
    '<p class="nc-music-privacy">O player é carregado somente após você tocar em “Ouvir aqui”.</p>',
    '</div>'
  ].join("");
  document.body.append(dialog);
  dialog.querySelector("[data-music-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    // Stop playback and release Spotify resources when leaving this experience.
    dialog.querySelector(".nc-spotify-frame").replaceChildren();
    document.body.classList.remove("nc-music-open");
  });
}
export function installMusicEmbed(root = document.querySelector("#app")) {
  if (!root || installed) return;
  installed = true;
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-music-play]");
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    const url = spotifyEmbedUrl(button.dataset.musicPlay);
    if (!url) return;
    ensureDialog();
    dialog.querySelector("#ncMusicTitle").textContent = button.dataset.musicTitle || "Nossa música";
    const iframe = document.createElement("iframe");
    iframe.title = "Reprodutor oficial do Spotify";
    iframe.src = url;
    iframe.loading = "eager";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.width = "100%";
    iframe.height = "180";
    iframe.style.border = "0";
    const frame = dialog.querySelector(".nc-spotify-frame");
    frame.replaceChildren(iframe);
    dialog.showModal();
    document.body.classList.add("nc-music-open");
  });
}
