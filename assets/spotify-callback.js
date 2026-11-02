import { completeSpotify } from "./connections.js";
const result = document.querySelector("#callbackMessage");
completeSpotify()
  .then(() => {
    result.textContent = "Spotify conectado. Voltando ao seu cantinho…";
    location.replace("/#ajustes");
  })
  .catch((e) => {
    result.textContent = e.message;
    document.querySelector("#callbackBack").hidden = false;
  });
