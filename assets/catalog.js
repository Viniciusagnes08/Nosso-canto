const MOODS = [
  {
    id: "apaixonado",
    name: "Apaixonado",
    phrase: "Hoje eu tô todo seu.",
    sticker: "./assets/stickers/cat-apaixonado.svg",
  },
  {
    id: "saudade",
    name: "Com saudade",
    phrase: "Queria você aqui comigo.",
    sticker: "./assets/stickers/cat-saudade.svg",
  },
  {
    id: "feliz",
    name: "Feliz",
    phrase: "Meu coração tá levinho hoje.",
    sticker: "./assets/stickers/cat-feliz.svg",
  },
  {
    id: "carente",
    name: "Carente",
    phrase: "Tô precisando de carinho.",
    sticker: "./assets/stickers/cat-carente.svg",
  },
  {
    id: "cansado",
    name: "Cansado",
    phrase: "Hoje eu só queria colo.",
    sticker: "./assets/stickers/cat-cansado.svg",
  },
  {
    id: "bravo",
    name: "Bravo",
    phrase: "Tô meio bravinho hoje.",
    sticker: "./assets/stickers/cat-bravo.svg",
  },
  {
    id: "ansioso",
    name: "Ansioso",
    phrase: "Meu coração tá acelerado.",
    sticker: "./assets/stickers/cat-ansioso.svg",
  },
  {
    id: "tranquilo",
    name: "Tranquilo",
    phrase: "Hoje eu tô em paz.",
    sticker: "./assets/stickers/cat-tranquilo.svg",
  },
];
// Historical records keep their original description; old feelings are never silently reclassified.
const LEGACY_MOODS = [
  {
    id: "radiante",
    name: "Radiante",
    sticker: "./assets/stickers/cat-feliz.svg",
  },
  {
    id: "normal",
    name: "Normal",
    sticker: "./assets/stickers/cat-tranquilo.svg",
  },
  {
    id: "triste",
    name: "Tristinha",
    sticker: "./assets/stickers/cat-saudade.svg",
  },
  {
    id: "dificil",
    name: "Dia difícil",
    sticker: "./assets/stickers/cat-cansado.svg",
  },
];
const TIPS = [
  "Escolham uma foto que represente o dia de hoje e contem um ao outro por qu\u00ea.",
  "Fa\u00e7am uma chamada de dez minutos sem distra\u00e7\u00f5es. S\u00f3 voc\u00eas dois.",
  "Mandem uma m\u00fasica que tenha a cara do outro. Contem a hist\u00f3ria por tr\u00e1s.",
  "Perguntem: qual foi o momento mais bonito do seu dia?",
  "Escolham uma receita simples para fazer juntos, mesmo em cidades diferentes.",
  "Cada um pode contar uma pequena coisa pela qual se sentiu grato hoje.",
  "Planejem um encontro virtual para esta semana e escolham juntos o hor\u00e1rio.",
  "Compartilhem uma lembran\u00e7a antiga. Que detalhe dela ainda faz sorrir?",
  "Reservem cinco minutos para conversar sobre o que precisam nesta semana.",
  "Uma mensagem espont\u00e2nea pode transformar um dia comum em especial.",
  "Contem um ao outro algo novo que aprenderam hoje.",
  "Escolham um objetivo simples para viver juntos nos pr\u00f3ximos sete dias.",
];
const PRESETS = [
  {
    title: "O mesmo c\u00e9u",
    desc: "Cada um fotografa o c\u00e9u da sua cidade. Duas paisagens, uma mesma noite.",
    emoji: "\u{1F319}",
  },
  {
    title: "Nosso almo\u00e7o",
    desc: "Mostrem por foto o que comeram hoje e contem como foi a pausa.",
    emoji: "\u{1F35D}",
  },
  {
    title: "Um sorriso para voc\u00ea",
    desc: "Registrem um momento que fez voc\u00eas sorrirem e compartilhem.",
    emoji: "\u{1F60A}",
  },
  {
    title: "Uma pequena descoberta",
    desc: "Fotografem algo interessante que viram no caminho hoje.",
    emoji: "\u{1F33F}",
  },
  {
    title: "Caf\u00e9 juntos",
    desc: "Cada um prepara a bebida favorita e registra o encontro virtual.",
    emoji: "\u2615",
  },
  {
    title: "Nossa cor do dia",
    desc: "Escolham uma cor e encontrem algo dela ao seu redor.",
    emoji: "\u{1F3A8}",
  },
];
const TYPES = {
  mood: { icon: "\u{1F49F}", label: "Humor" },
  meal: { icon: "\u{1F35D}", label: "Refei\u00e7\u00e3o" },
  event: { icon: "\u{1F4C5}", label: "Compromisso" },
  message: { icon: "\u{1F48C}", label: "Mensagem" },
  music: { icon: "\u{1F3B6}", label: "M\u00fasica" },
  memory: { icon: "\u{1F4F7}", label: "Mem\u00f3ria" },
  challenge: { icon: "\u{1F31F}", label: "Desafio" },
  proof: { icon: "\u{1F4F8}", label: "Miss\u00e3o cumprida" },
};

export { MOODS, LEGACY_MOODS, TIPS, PRESETS, TYPES };
