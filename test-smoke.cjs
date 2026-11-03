const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const nodes = new Map();
function getNode(selector) {
  if (!nodes.has(selector))
    nodes.set(selector, {
      innerHTML: "",
      textContent: "",
      open: false,
      disabled: false,
      addEventListener() {},
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      removeAttribute() {},
      focus() {},
      reportValidity() {
        return true;
      },
    });
  return nodes.get(selector);
}
const local = {};
const context = {
  connectionCards() {
    return "<section>Connections</section>";
  },
  initConnections() {},
  installMemoryGallery() {},
  installMusicEmbed() {},
  spotifyEmbedUrl() { return ""; },
  logout() {},
  sessionStorage: {
    getItem() {
      return null;
    },
  },
  console,
  Date,
  URL,
  Math,
  JSON,
  Map,
  Set,
  FormData,
  File: class {},
  setTimeout,
  clearTimeout,
  AbortSignal,
  Blob,
  document: {
    querySelector: getNode,
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    createElement() {
      return getNode("temp");
    },
    body: { append() {} },
  },
  localStorage: {
    getItem(k) {
      return local[k] || null;
    },
    setItem(k, v) {
      local[k] = v;
    },
  },
  navigator: {},
  location: { hash: "" },
  crypto: require("crypto").webcrypto,
  confirm() {
    return true;
  },
  scrollTo() {},
  addEventListener() {},
};
context.window = context;
vm.createContext(context);
for (const file of [
  "catalog.js",
  "utils.js",
  "media.js",
  "mood-view.js",
  "app.js",
]) {
  const source = fs
    .readFileSync(__dirname + "/assets/" + file, "utf8")
    .replace(/^import[\s\S]*?from\s+[\"'][^\"']+[\"'];/gm, "")
    .replace(/^export\s*\{[^}]*\};/gm, "")
    .replace(/export async function/g, "async function")
    .replace(/export function/g, "function");
  vm.runInContext(source, context, { filename: file });
}
vm.runInContext(
  "startApp({id:'local-only-v1',email:null},{localOnly:true})",
  context,
);
assert(
  getNode("#app").innerHTML.includes("Perto, mesmo"),
  "home hero rendered",
);
for (const route of [
  "humor",
  "diario",
  "calendario",
  "desafios",
  "memorias",
  "musicas",
  "ajustes",
  "inicio",
]) {
  vm.runInContext(`navigate('${route}')`, context);
  assert(getNode("#app").innerHTML.length > 250, route + " rendered");
}
vm.runInContext(
  "data.entries.push({id:'test-1',type:'mood',owner:'self',created:new Date().toISOString(),date:localDay(),mood:'feliz',shared:false});persist();navigate('inicio')",
  context,
);
assert(
  getNode("#app").innerHTML.includes("Humores registrados"),
  "mood visible in home",
);
assert(
  JSON.parse(local["entre-nos-local-isolated-v1"]).entries.length === 1,
  "record persisted",
);
vm.runInContext("addPreset(0)", context);
assert(
  JSON.parse(local["entre-nos-local-isolated-v1"]).entries.length === 2,
  "challenge persisted",
);
console.log(
  "OK: eight routes, state write, mood rendering and challenge creation",
);

// Sticker and local persistence regression tests.
assert.equal(
  vm.runInContext("MOODS.length", context),
  8,
  "eight moods in catalog",
);
assert.equal(
  vm.runInContext("new Set(MOODS.map(m=>m.id)).size", context),
  8,
  "unique mood IDs",
);
vm.runInContext("navigate('humor')", context);
const moodPage = getNode("#app").innerHTML;
assert(moodPage.includes('id="moodInlineForm"'), "dedicated mood form exists");
assert(
  moodPage.includes("cat-apaixonado.svg") &&
    moodPage.includes("cat-tranquilo.svg"),
  "real cat artwork in mood page",
);
assert.equal(
  (moodPage.match(/data-pick-mood=/g) || []).length,
  8,
  "eight sticker buttons",
);
assert(
  moodPage.includes('id="inlineSaveMood" disabled'),
  "save locked until selection",
);
vm.runInContext("selectMood('carente')", context);
assert.equal(vm.runInContext("moodChoice", context), "carente");
assert.equal(
  getNode("#inlineSaveMood").disabled,
  false,
  "selection enables save",
);
vm.runInContext("openModal('mood')", context);
assert(
  getNode("#formFields").innerHTML.includes("cat-saudade.svg"),
  "modal uses sticker artwork",
);
vm.runInContext("selectMood('saudade')", context);
assert.equal(vm.runInContext("moodChoice", context), "saudade");
assert.equal(
  vm.runInContext("moodInfo('triste').name", context),
  "Tristinha",
  "historical mood preserved",
);
assert.equal(
  vm.runInContext("moodInfo('normal').name", context),
  "Normal",
  "historical neutral mood preserved",
);
vm.runInContext(
  "addRecord({id:'cat-mood-test', type:'mood', owner:'self', date:localDay(),created:new Date().toISOString(),mood:'saudade',note:'um registro',shared:false})",
  context,
);
assert(
  JSON.parse(local["entre-nos-local-isolated-v1"]).entries.some(
    (e) => e.id === "cat-mood-test" && e.mood === "saudade",
  ),
  "sticker mood uses canonical local records",
);
// Exercise the actual inline submit handler (not merely the storage helper).
const nativeFormData = context.FormData;
context.FormData = class MockFormData {
  constructor(form) {
    this.values = new Map(form.values || []);
  }
  get(name) {
    return this.values.get(name) ?? null;
  }
  has(name) {
    return this.values.has(name);
  }
};
vm.runInContext(
  "document.querySelector('#entryDialog').close(); navigate('humor');selectMood('ansioso')",
  context,
);
vm.runInContext(
  "saveInlineMood({preventDefault(){}, target:{reportValidity(){return true},values:[['date',localDay()],['note','Estou com o coração acelerado']]}})",
  context,
);
const savedMoods = JSON.parse(
  local["entre-nos-local-isolated-v1"],
).entries.filter((e) => e.type === "mood");
assert(
  savedMoods.some(
    (e) =>
      e.mood === "ansioso" &&
      e.note === "Estou com o coração acelerado" &&
      e.shared === true,
  ),
  "inline mood form automatically shares new records",
);
context.FormData = nativeFormData;
const illustrations = [
  "apaixonado",
  "saudade",
  "feliz",
  "carente",
  "cansado",
  "bravo",
  "ansioso",
  "tranquilo",
];
for (const id of illustrations) {
  const svg = fs.readFileSync(
    __dirname + "/assets/stickers/cat-" + id + ".svg",
    "utf8",
  );
  assert(
    svg.startsWith("<svg ") && svg.includes("</svg>"),
    "artwork " + id + " is a valid SVG document structure",
  );
}
console.log(
  "OK: eight SVG kitten moods, page/modal, selection and legacy compatibility",
);

assert.equal(vm.runInContext("validUrl('javascript:alert(1)')", context), "#");
vm.runInContext(
  "data.entries.push({id:'old',type:'mood',owner:'partner',date:'2020-01-01',mood:'triste'})",
  context,
);
assert.equal(
  vm.runInContext("latestMood('partner')", context),
  undefined,
  "old mood is not presented as today",
);
local["entre-nos-local-v1"] = JSON.stringify({
  profile: { self: "Legacy" },
  entries: [{ id: "legacy" }],
});
assert.equal(
  vm.runInContext("mediaDatabase", context),
  "entre-nos-images:local-isolated-v1",
  "local preview photos stay in an isolated database",
);
assert.equal(
  JSON.parse(local["entre-nos-local-v1"]).entries[0].id,
  "legacy",
  "legacy storage untouched",
);
context.localStorage.setItem = () => {
  throw new Error("QuotaExceededError");
};
assert.throws(
  () => vm.runInContext("data.entries.push({id:'unsaved'});persist()", context),
  /salvar/,
);
assert.equal(
  vm.runInContext("data.entries.some(e=>e.id==='unsaved')", context),
  false,
  "failed write rolls back",
);
console.log("OK: unsafe URL, stale mood and failed storage regression checks");
