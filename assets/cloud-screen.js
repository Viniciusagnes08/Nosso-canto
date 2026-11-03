import { connectRecords } from './cloud-records.js';
import { logout } from './auth.js';
import { safe, uid, localDay } from './utils.js';

const members = ['viniciusagnes1092@gmail.com', 'mirnacaterine@gmail.com'];
export function startApp(user) {
  const root = document.querySelector('#privateApp');
  if (!members.includes(user.email)) {
    root.innerHTML = '<main class="cloud-page"><h1>Este espaço é do casal.</h1><p>Entre com uma das duas contas autorizadas.</p><button id="cloudExit" class="btn">Sair</button></main>';
    root.querySelector('#cloudExit').onclick = logout;
    return;
  }
  root.innerHTML = `<main class="cloud-page"><header><span class="eyebrow">ENTRE NÓS · ESPAÇO COMPARTILHADO</span><h1>Nosso cantinho, sempre perto.</h1><p>Conectado como ${safe(user.email)}</p><a href="/">Registros anteriores neste aparelho</a> · <button id="cloudExit" class="text-link">Sair</button></header><p id="cloudStatus" role="status">Conectando ao nosso espaço…</p><section class="cloud-compose"><h2>Um detalhe do nosso dia</h2><form id="cloudForm"><label>Tipo<select name="type"><option value="diary">Nosso dia</option><option value="mood">Humor</option><option value="event">Calendário</option><option value="challenge">Desafio</option><option value="memory">Memória</option><option value="meal">Refeição</option><option value="music">Música</option></select></label><label>Título<input name="title" required maxlength="170"></label><label>Data<input name="date" type="date" value="${localDay()}" required></label><label>O que você quer guardar?<textarea name="note" maxlength="5000" rows="4"></textarea></label><label>Foto (opcional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="cloud-check"><input name="shared" type="checkbox" checked> Compartilhar com meu amor</label><button id="cloudSave" type="submit" class="btn btn-primary">Salvar na nuvem</button><p id="cloudFeedback" role="status"></p></form></section><section><h2>Nossos registros</h2><p>O que for compartilhado aparece para os dois. Registros privados aparecem só para quem criou.</p><div id="cloudFeed"></div></section></main>`;
  const feedback = root.querySelector('#cloudFeedback'), status = root.querySelector('#cloudStatus');
  let entries = [], pending = false;
  const connection = connectRecords('nosso-canto', user.id, rows => {
    entries = rows;
    status.textContent = navigator.onLine ? 'Conectado · atualizações automáticas' : 'Sem conexão · aguardando reconectar';
    render();
  }, () => { status.textContent = 'Não foi possível sincronizar. Confira sua conexão e entre novamente se necessário.'; });
  const online = () => { status.textContent = navigator.onLine ? 'Reconectando ao nosso espaço…' : 'Sem conexão · nenhuma nova gravação será confirmada'; };
  window.addEventListener('online', online); window.addEventListener('offline', online);
  root.querySelector('#cloudExit').onclick = async () => { connection.close(); await logout(); };
  function render() {
    root.querySelector('#cloudFeed').innerHTML = entries.sort((a,b) => String(b.created).localeCompare(String(a.created))).map(r => `<article class="cloud-record"><small>${safe(r.date || '')} · ${r.authorId === user.id ? 'Você' : 'Seu amor'} · ${r.shared ? 'Compartilhado' : 'Privado'}</small><h3>${safe(r.title || '')}</h3><p>${safe(r.note || '')}</p>${typeof r.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.photo) ? `<img alt="Foto do registro" src="${r.photo}" loading="lazy">` : ''}</article>`).join('') || '<p>Ainda não há registros. Guardem o primeiro detalhe de vocês.</p>';
  }
  root.querySelector('#cloudForm').onsubmit = async event => {
    event.preventDefault();
    if (pending) return;
    if (!navigator.onLine) { feedback.textContent = 'Conecte-se à internet para salvar na nuvem.'; return; }
    const form = event.currentTarget, values = new FormData(form), button = root.querySelector('#cloudSave');
    pending = true; button.disabled = true;
    feedback.textContent = 'Salvando… aguarde a confirmação antes de fechar.';
    const slow = setTimeout(() => { feedback.textContent = 'A confirmação está demorando. Mantenha esta página aberta; o registro ainda não foi confirmado.'; }, 15000);
    try {
      const photo = values.get('photo');
      const record = { id: uid(), type: values.get('type'), title: String(values.get('title')).trim(), date: values.get('date'), note: String(values.get('note') || ''), shared: values.has('shared'), created: new Date().toISOString() };
      if (photo?.size) record.photo = await encodePhoto(photo);
      await connection.save(record);
      form.reset(); form.elements.date.value = localDay();
      feedback.textContent = 'Salvo na nuvem. Disponível para quem tem acesso a este registro.';
    } catch (error) { feedback.textContent = error?.message?.startsWith('A foto') ? error.message : 'Não foi possível confirmar o salvamento. Seu texto continua no formulário.'; }
    finally { clearTimeout(slow); pending = false; button.disabled = false; }
  };
  window.addEventListener('beforeunload', e => { if (pending) { e.preventDefault(); e.returnValue = ''; } });
}

async function encodePhoto(file) {
  if (file.size > 16 * 1024 * 1024) throw new Error('A foto deve ter até 16 MB.');
  const bitmap = await createImageBitmap(file), canvas = document.createElement('canvas');
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  for (const quality of [0.8, 0.65, 0.45]) {
    const value = canvas.toDataURL('image/jpeg', quality);
    if (value.length < 700000) return value;
  }
  throw new Error('A foto ficou muito grande. Escolha uma imagem menor.');
}
