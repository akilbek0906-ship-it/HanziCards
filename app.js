'use strict';
window.__app = 6;   // номер версии; index.html сверяет его, чтобы заметить устаревший кэш
const KEYS = { cards: 'hanzi-cards-v1', stats: 'hanzi-stats-v1', set: 'hanzi-settings-v1' };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const dayKey = (off = 0) => { const d = new Date(); d.setDate(d.getDate() - off); return d.toLocaleDateString('sv-SE'); };

/* ---------- Пиньинь по тонам (цвет) ---------- */
const PV = 'aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const SYL = new RegExp(`(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[${PV}]+(?:ng|n)?(?:r(?![${PV}]))?`, 'giu');   // r в конце — эрхуа, но «rén» остаётся отдельным слогом
const toneOf = s => /[āēīōūǖ]/i.test(s) ? 1 : /[áéíóúǘ]/i.test(s) ? 2 : /[ǎěǐǒǔǚ]/i.test(s) ? 3 : /[àèìòùǜ]/i.test(s) ? 4 : 5;
function py(p) {
  const out = [];
  for (const seg of String(p).split("'")) {
    const m = seg.match(SYL);
    if (!m || m.join('') !== seg) return esc(p);          // не смогли разобрать — показываем как есть
    out.push(m.map(x => `<span class="t${toneOf(x)}">${esc(x)}</span>`).join(''));
  }
  return out.join("'");
}

/* ---------- Языки ---------- */
const LANGS = { ru: 'Русский', fr: 'Français' };   // новый язык: словарь в i18n.js + переводы в decks.js
const I18N = window.I18N || {};
const DECKS = window.DECKS || [];
const deckIdx = new Map();                          // переводы слов колоды: «колода|иероглиф|пиньинь» → {ru, fr, ...}
for (const d of DECKS) for (const [h, p, tr] of d.cards) deckIdx.set(`${d.id}|${h}|${p}`, tr);
const deckTr = (id, h, p) => deckIdx.get(`${id}|${h}|${p}`) || null;

/* ---------- Данные и миграция ---------- */
// known — «узнаю» (иероглиф → смысл), knownRev — «вспоминаю» (пиньинь → иероглиф)
function norm(c) {
  const dt = c.deck ? deckTr(c.deck, c.hanzi, c.pinyin) : null;   // переводы колоды всегда берём из актуального decks.js
  return { id: c.id || uid(), hanzi: String(c.hanzi), pinyin: String(c.pinyin), ru: String(c.ru ?? (dt && dt.ru) ?? ''),
    tr: dt || c.tr || undefined, trUser: c.trUser || undefined,
    example: c.example ? String(c.example) : '', deck: c.deck || '', created: c.created || Date.now(),
    known: !!(c.known ?? c.reps > 0), knownRev: !!c.knownRev };
}
let cards = read(KEYS.cards, []).map(norm);
let stats = read(KEYS.stats, { days: {} }); if (!stats.days) stats.days = {};
const settings = Object.assign({ autoSpeak: true, mode: 'fwd', deck: 'all', batch: 20,
  lang: /^fr/i.test(navigator.language || '') ? 'fr' : 'ru' }, read(KEYS.set, {}));
if (!LANGS[settings.lang]) settings.lang = 'ru';
const saveCards = () => write(KEYS.cards, cards);
const saveSettings = () => write(KEYS.set, settings);
saveCards();

// tt — перевод строки интерфейса (русский текст = ключ); L — выбор языка из {ru, fr, ...}; tx — перевод слова на карточке
const tt = (s, v) => {
  let r = (settings.lang !== 'ru' && I18N[settings.lang] && I18N[settings.lang][s]) || s;
  if (v) for (const k in v) r = r.split('{' + k + '}').join(v[k]);
  return r;
};
const L = o => typeof o === 'string' ? o : (o && (o[settings.lang] || o.ru || Object.values(o)[0])) || '';
function tx(c) {
  const l = settings.lang;
  return (c.trUser && c.trUser[l]) || (c.tr && c.tr[l]) || c.ru || (c.tr && (c.tr.ru || Object.values(c.tr)[0])) || '';
}

function log(f, n = 1) {
  const d = (stats.days[dayKey()] ??= { reviews: 0, again: 0, newCount: 0, writes: 0, mistakes: 0 });
  d[f] = (d[f] || 0) + n; write(KEYS.stats, stats);
}
const todayStat = () => stats.days[dayKey()] || {};

function toast(msg, v) {
  const t = $('#toast'); t.textContent = tt(msg, v); t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}
const updateCount = () => $('#count').textContent = cards.length;

/* ---------- Озвучка ---------- */
let voice = null;
function pickVoice() {
  const v = speechSynthesis.getVoices();
  voice = v.find(x => /zh[-_]CN/i.test(x.lang)) || v.find(x => /^zh/i.test(x.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Браузер не поддерживает озвучку');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = 0.8;
  if (voice) u.voice = voice;
  else if (speechSynthesis.getVoices().length) toast('В системе нет китайского голоса');
  speechSynthesis.speak(u);
}

/* ---------- Вкладки ---------- */
const VIEWS = ['study', 'write', 'list', 'decks', 'stats'];
let currentView = 'study';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  VIEWS.forEach(v => $('#view-' + v).hidden = v !== name);
  if (name === 'study') buildQueue();
  if (name === 'write') nextWrite();
  if (name === 'list') renderList();
  if (name === 'decks') renderDecks();
  if (name === 'stats') renderStats();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => showView(b.dataset.view));

/* ---------- Режим изучения ---------- */
let queue = [], history = [], flipped = false, revealed = false, includeKnown = false;
const rev = () => settings.mode === 'rev';
const kf = () => rev() ? 'knownRev' : 'known';
const cur = () => cards.find(c => c.id === queue[0]);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const inDeck = c => settings.deck === 'all' || (settings.deck === 'own' ? !c.deck : c.deck === settings.deck);
function fillDeckFilter() {
  const opts = [['all', tt('Все карточки')], ['own', tt('Мои карточки')],
    ...DECKS.filter(d => cards.some(c => c.deck === d.id)).map(d => [d.id, L(d.title)])];
  if (!opts.some(o => o[0] === settings.deck)) settings.deck = 'all';
  $('#deckFilter').innerHTML = opts.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('');
  $('#deckFilter').value = settings.deck;
  $('#batchSel').value = String(settings.batch);
}
function buildQueue() {
  fillDeckFilter();
  const pool = shuffle(cards.filter(c => inDeck(c) && (includeKnown || !c[kf()])).map(c => c.id));
  queue = settings.batch ? pool.slice(0, settings.batch) : pool;   // порция: не больше N карточек за раз
  history = []; flipped = revealed = false;
  renderStudy();
}
$('#deckFilter').onchange = e => { settings.deck = e.target.value; saveSettings(); buildQueue(); };
$('#batchSel').onchange = e => { settings.batch = +e.target.value; saveSettings(); buildQueue(); };
function renderStudy() {
  const area = $('#studyArea');
  $('#progress').textContent = queue.length ? tt('Осталось: {n}', { n: queue.length }) : '';
  $('#undo').disabled = !history.length;
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === (rev() ? 'rev' : 'fwd')));
  if (!cards.length) {
    area.innerHTML = `<div class="empty"><strong>${tt('Пока нет карточек')}</strong>${tt('Добавьте первый иероглиф.')}<br><button class="btn primary" id="goAdd">${tt('Добавить карточку')}</button></div>`;
    $('#goAdd').onclick = () => showView('list'); return;
  }
  if (!queue.length) {
    const total = cards.filter(inDeck).length, left = cards.filter(c => inDeck(c) && !c[kf()]).length;
    if (!total) {
      area.innerHTML = `<div class="empty"><strong>${tt('Здесь пока пусто')}</strong>${tt('В выбранной колоде нет карточек.')}<br><button class="btn primary" id="goDecks">${tt('К колодам')}</button></div>`;
      $('#goDecks').onclick = () => showView('decks'); return;
    }
    if (left) {
      area.innerHTML = `<div class="empty"><strong>${tt('Порция закончена')}</strong>${tt('Ещё не выучено: {n}.', { n: left })}<br><button class="btn primary" id="nextBatch">${tt('Следующая порция')}</button></div>`;
      $('#nextBatch').onclick = buildQueue; return;
    }
    area.innerHTML = `<div class="empty"><strong>${tt('Всё выучено')}</strong>${tt('Неизвестных карточек не осталось.')}<br><button class="btn primary" id="again">${tt('Повторить все')}</button></div>`;
    $('#again').onclick = () => { includeKnown = true; $('#includeKnown').checked = true; buildQueue(); }; return;
  }
  const c = cur();
  const front = rev()
    ? `<div class="pinyin big-pinyin">${py(c.pinyin)}</div><div class="ru">${esc(tx(c))}</div><span class="hint">${tt('Вспомните иероглиф, затем переверните')}</span>`
    : `<div class="big-hanzi">${esc(c.hanzi)}</div><span class="hint">${tt('Нажмите, чтобы перевернуть')}</span>`;
  const back = `<div class="big-hanzi">${esc(c.hanzi)}</div><div class="pinyin">${py(c.pinyin)}</div><div class="ru">${esc(tx(c))}</div>`
    + (c.example ? `<div class="ex">${esc(c.example)}</div>` : '');
  area.innerHTML = `
    <div class="scene">
      <button class="card" id="card" aria-label="${tt('Перевернуть карточку')}">
        <div class="face front">${front}</div>
        <div class="face back">${back}</div>
      </button>
    </div>
    <div class="tools" id="tools" ${rev() ? 'hidden' : ''}>
      <button class="btn small" id="say">${tt('Озвучить')}</button>
      <button class="btn small" id="strokes">${tt('Порядок черт')}</button>
    </div>
    <div id="showRow"><button class="btn primary wide" id="show">${tt('Показать ответ')}</button></div>
    <div class="grades two" id="gradeRow" hidden>
      <button class="btn g0" data-k="0"><b>${tt('Не знаю')}</b></button>
      <button class="btn g2" data-k="1"><b>${tt('Знаю')}</b></button>
    </div>
    <p class="muted" style="text-align:center;font-size:13px;margin-bottom:4px">${tt('Пробел — перевернуть · ← не знаю · → знаю')}</p>
    <p class="legend-tones">${tt('Тоны:')} <b class="t1">1</b><b class="t2">2</b><b class="t3">3</b><b class="t4">4</b><b class="t5">${tt('лёгкий')}</b></p>`;
  $('#card').onclick = flip;
  $('#show').onclick = flip;
  $('#say').onclick = () => speak(c.hanzi);
  $('#strokes').onclick = () => openStrokes(c.hanzi);
  $('#gradeRow').onclick = e => { const b = e.target.closest('[data-k]'); if (b) answer(b.dataset.k === '1'); };
}
function flip() {
  if (!$('#card')) return;
  flipped = !flipped;
  $('#card').classList.toggle('flipped', flipped);
  if (flipped && !revealed) {
    revealed = true; $('#showRow').hidden = true; $('#gradeRow').hidden = false; $('#tools').hidden = false;
    if (settings.autoSpeak) speak(cur().hanzi);
  }
}
function answer(known) {
  const id = queue.shift(), c = cards.find(x => x.id === id), f = kf();
  history.push({ id, prev: c[f], requeued: !known });
  c[f] = known; saveCards();
  log('reviews'); if (!known) { log('again'); queue.push(id); }   // «не знаю» вернётся в конец очереди
  flipped = revealed = false;
  renderStudy(); updateCount();
}
// Назад: отменяет последний ответ и снова показывает ту карточку
function undo() {
  const h = history.pop(); if (!h) return;
  const c = cards.find(x => x.id === h.id); if (!c) return renderStudy();
  c[kf()] = h.prev; saveCards();
  if (h.requeued) { const i = queue.lastIndexOf(h.id); if (i > -1) queue.splice(i, 1); log('again', -1); }
  log('reviews', -1);
  queue.unshift(h.id);
  flipped = revealed = false;
  renderStudy(); updateCount();
}
$('#undo').onclick = undo;
$('#modeSeg').onclick = e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  settings.mode = b.dataset.mode; saveSettings(); buildQueue();
};
document.addEventListener('keydown', e => {
  if ($('#view-study').hidden || !queue.length || /INPUT|TEXTAREA/.test(e.target.tagName) || $('#strokeDlg').open) return;
  if (e.code === 'Space') { e.preventDefault(); flip(); }
  else if (revealed && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
  else if (revealed && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
});
$('#autoSpeak').checked = settings.autoSpeak;
$('#autoSpeak').onchange = e => { settings.autoSpeak = e.target.checked; saveSettings(); };
$('#includeKnown').onchange = e => { includeKnown = e.target.checked; buildQueue(); };

/* ---------- Hanzi Writer: порядок черт и письмо ---------- */
const chars = s => [...s].filter(ch => /\p{Script=Han}/u.test(ch));
function hwReady() {
  if (typeof HanziWriter !== 'undefined') return true;
  toast('Библиотека черт не загрузилась — нужен интернет'); return false;
}
function mount(el, text) {
  el.innerHTML = '';
  const cs = chars(text), size = cs.length > 1 ? 150 : 220;
  return cs.map(ch => {
    const d = document.createElement('div'); d.className = 'hw'; el.appendChild(d);
    return HanziWriter.create(d, ch, { width: size, height: size, padding: 8,
      strokeColor: '#e8eeea', outlineColor: '#34424a', radicalColor: '#ffc857',
      highlightColor: '#5ccf9f', drawingColor: '#6cb4e8', strokeAnimationSpeed: 1.2, delayBetweenStrokes: 250,
      onLoadCharDataError: () => toast('Нет данных черт для «{ch}»', { ch }) });
  });
}

// Окно с анимацией порядка черт
let dlgWriters = [];
function openStrokes(text) {
  if (!hwReady()) return;
  if (!chars(text).length) return toast('В карточке нет иероглифов');
  $('#strokeTitle').textContent = text;
  dlgWriters = mount($('#strokeBox'), text);
  dlgWriters.forEach(w => w.loopCharacterAnimation());
  $('#strokeDlg').showModal();
}
$('#strokeClose').onclick = () => $('#strokeDlg').close();
$('#strokeDlg').onclose = () => {
  dlgWriters.forEach(w => { try { w.pauseAnimation(); } catch {} });
  $('#strokeBox').innerHTML = '';
};
$('#strokeDlg').onclick = e => { if (e.target.id === 'strokeDlg') e.target.close(); };

// Вкладка «Писать»
let wq = { id: null, ws: [], cur: 0, err: 0, hints: 0 };
function nextWrite() {
  const area = $('#writeArea');
  const pool = cards.filter(c => inDeck(c) && chars(c.hanzi).length);
  if (!pool.length) {
    area.innerHTML = `<div class="empty"><strong>${tt('Нет карточек для письма')}</strong>${tt('Добавьте карточки с иероглифами.')}</div>`; return;
  }
  if (!hwReady()) { area.innerHTML = `<div class="empty"><strong>${tt('Нужен интернет')}</strong>${tt('Библиотека черт не загрузилась.')}</div>`; return; }
  const choices = pool.length > 1 ? pool.filter(c => c.id !== wq.id) : pool;
  const c = choices[Math.floor(Math.random() * choices.length)];
  wq = { id: c.id, ws: [], cur: 0, err: 0, hints: 0 };
  area.innerHTML = `
    <div class="prompt"><div class="pinyin">${py(c.pinyin)}</div><div class="ru">${esc(tx(c))}</div></div>
    <div class="hwrow" id="hwBox"></div>
    <p class="status" id="wStatus">${tt('Рисуйте черты по порядку · ошибок:')} <span id="wErr">0</span></p>
    <div class="row center">
      <button class="btn small" id="wSay">${tt('Озвучить')}</button>
      <button class="btn small" id="wHint">${tt('Подсказка')}</button>
      <button class="btn small" id="wSkip">${tt('Пропустить')}</button>
      <button class="btn primary" id="wNext" hidden>${tt('Дальше')}</button>
    </div>`;
  wq.ws = mount($('#hwBox'), c.hanzi);
  startQuiz(0);
  $('#wSay').onclick = () => speak(c.hanzi);
  $('#wHint').onclick = () => {
    const w = wq.ws[wq.cur]; wq.hints++;
    w.cancelQuiz(); w.animateCharacter({ onComplete: () => startQuiz(wq.cur) });
  };
  $('#wSkip').onclick = nextWrite;
  $('#wNext').onclick = nextWrite;
}
function startQuiz(i) {
  const w = wq.ws[i]; wq.cur = i;
  w.quiz({
    onMistake: () => { wq.err++; $('#wErr').textContent = wq.err; },
    onComplete: () => { i + 1 < wq.ws.length ? startQuiz(i + 1) : finishWrite(); }
  });
}
function finishWrite() {
  const st = $('#wStatus');
  st.className = 'status ok';
  st.textContent = tt('Верно! Ошибок: {e}, подсказок: {h}', { e: wq.err, h: wq.hints });
  $('#wHint').hidden = $('#wSkip').hidden = true; $('#wNext').hidden = false;
  log('writes'); log('mistakes', wq.err);
  if (settings.autoSpeak) speak(cards.find(c => c.id === wq.id).hanzi);
}

/* ---------- Список ---------- */
let editingId = null;
const deckShort = id => (DECKS.find(d => d.id === id) || {}).short || '';
const statusOf = c => `<span class="chip${c.known ? ' on' : ''}">${tt('Узнаю')}</span><span class="chip rev${c.knownRev ? ' on' : ''}">${tt('Вспоминаю')}</span>`
  + (c.deck ? `<span class="chip deck">${esc(deckShort(c.deck))}</span>` : '');
function renderList() {
  updateCount();
  const q = $('#search').value.trim().toLowerCase();
  const items = cards.filter(c => !q || [c.hanzi, c.pinyin, tx(c), c.ru, c.example].some(v => (v || '').toLowerCase().includes(q)));
  $('#list').innerHTML = items.length ? items.map(c => `
    <li class="item${c.known ? ' k' : ''}${c.knownRev ? ' r' : ''}">
      <div class="h">${esc(c.hanzi)}</div>
      <div><div class="p">${py(c.pinyin)}</div><div class="t">${esc(tx(c))}</div>
        ${c.example ? `<div class="ex">${esc(c.example)}</div>` : ''}<div class="s">${statusOf(c)}</div></div>
      <div class="actions">
        <button class="btn small" data-say="${c.id}">${tt('Звук')}</button>
        <button class="btn small" data-edit="${c.id}">${tt('Изменить')}</button>
        <button class="btn small danger" data-del="${c.id}">${tt('Удалить')}</button>
      </div>
    </li>`).join('')
    : `<li class="empty">${cards.length ? tt('Ничего не найдено') : tt('Список пуст — добавьте первую карточку выше')}</li>`;
}
$('#search').oninput = renderList;
$('#list').onclick = e => {
  const { say, edit, del } = e.target.dataset;
  if (say) speak(cards.find(c => c.id === say).hanzi);
  if (edit) startEdit(edit);
  if (del && confirm(tt('Удалить карточку?'))) {
    cards = cards.filter(c => c.id !== del); saveCards();
    if (editingId === del) resetForm();
    renderList(); toast('Удалено');
  }
};
function startEdit(id) {
  const c = cards.find(x => x.id === id); if (!c) return;
  editingId = id;
  $('#fHanzi').value = c.hanzi; $('#fPinyin').value = c.pinyin; $('#fRu').value = tx(c); $('#fExample').value = c.example || '';
  $('#formTitle').textContent = tt('Редактирование');
  $('#fSubmit').textContent = tt('Сохранить');
  $('#fCancel').hidden = false;
  $('#cardForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#fHanzi').focus();
}
function resetForm() {
  editingId = null; $('#cardForm').reset();
  $('#formTitle').textContent = tt('Новая карточка');
  $('#fSubmit').textContent = tt('Добавить');
  $('#fCancel').hidden = true;
}
$('#fCancel').onclick = resetForm;
$('#cardForm').onsubmit = e => {
  e.preventDefault();
  const data = { hanzi: $('#fHanzi').value.trim(), pinyin: $('#fPinyin').value.trim(), ru: $('#fRu').value.trim(), example: $('#fExample').value.trim() };
  if (!data.hanzi || !data.pinyin || !data.ru) return;
  if (editingId) {
    const c = cards.find(x => x.id === editingId), { ru, ...rest } = data;
    Object.assign(c, rest);
    if (c.deck) c.trUser = { ...(c.trUser || {}), [settings.lang]: ru };   // правка перевода слова колоды — только для текущего языка
    else c.ru = ru;
    toast('Сохранено');
  } else { cards.unshift(norm(data)); toast('Добавлено'); }
  saveCards(); resetForm(); renderList(); $('#fHanzi').focus();
};

/* ---------- Экспорт / импорт ---------- */
$('#exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 2, cards, stats }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hanzi-cards-${dayKey()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
};
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.cards;   // понимает и старый формат (массив)
    if (!Array.isArray(list)) throw 0;
    const have = new Set(cards.map(c => c.hanzi + '|' + c.pinyin));
    let added = 0;
    for (const d of list) {
      if (!d || !d.hanzi || !d.pinyin || (!d.ru && !d.tr) || have.has(d.hanzi + '|' + d.pinyin)) continue;
      cards.push(norm({ ...d, id: undefined })); added++;
    }
    if (data.stats && data.stats.days && !Object.keys(stats.days).length) { stats = data.stats; write(KEYS.stats, stats); }
    saveCards(); renderList(); toast('Импортировано: {n}', { n: added });
  } catch { toast('Не удалось прочитать файл'); }
  e.target.value = '';
};

/* ---------- Статистика ---------- */
const active = i => { const d = stats.days[dayKey(i)]; return d && (d.reviews || d.writes); };
function streak() { let n = 0, i = active(0) ? 0 : 1; while (active(i)) { n++; i++; } return n; }
function renderStats() {
  const t = todayStat(), n = cards.length;
  const known = cards.filter(c => c.known).length, knownRev = cards.filter(c => c.knownRev).length;
  const acc = t.reviews ? Math.round((t.reviews - (t.again || 0)) / t.reviews * 100) + '%' : '—';
  const days = Array.from({ length: 14 }, (_, k) => 13 - k).map(i => {
    const d = stats.days[dayKey(i)] || {};
    return { v: (d.reviews || 0) + (d.writes || 0), label: dayKey(i).slice(8) };
  });
  const max = Math.max(1, ...days.map(d => d.v));
  const bar = (k, g) => `<div class="stack"><i style="width:${k / Math.max(1, n) * 100}%;background:${g}"></i></div>`;
  $('#statsBody').innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${t.reviews || 0}</b><span>${tt('ответов сегодня')}</span></div>
      <div class="tile"><b>${acc}</b><span>${tt('точность сегодня')}</span></div>
      <div class="tile"><b>${streak()}</b><span>${tt('дней подряд')}</span></div>
      <div class="tile"><b>${t.writes || 0}</b><span>${tt('написано сегодня')}</span></div>
      <div class="tile"><b>${known}</b><span>${tt('узнаю')}</span></div>
      <div class="tile"><b>${knownRev}</b><span>${tt('вспоминаю иероглиф')}</span></div>
    </div>
    <div class="panel-title">${tt('Прогресс колоды (всего {n})', { n })}</div>
    <div class="legend"><span>${tt('Иероглиф → смысл:')} ${known}</span></div>${bar(known, 'linear-gradient(90deg,#5ccf9f,#6cb4e8)')}
    <div class="legend"><span>${tt('Пиньинь → иероглиф:')} ${knownRev}</span></div>${bar(knownRev, 'linear-gradient(90deg,#b794f6,#ff7a8a)')}
    <div class="panel-title">${tt('Активность за 14 дней')}</div>
    <div class="bars">${days.map(d => `<div class="bar" title="${d.v}"><i class="${d.v ? '' : 'zero'}" style="height:${d.v / max * 80}%"></i>${d.label}</div>`).join('')}</div>`;
}

/* ---------- Колоды ---------- */
function renderDecks() {
  if (!Array.isArray(window.DECKS)) {
    $('#decksBody').innerHTML = '<div class="empty"><strong>' + tt('Файл decks.js не загрузился') + '</strong>' + tt('Он должен лежать рядом с index.html. Загрузите его в репозиторий и обновите страницу.') + '</div>';
    return;
  }
  $('#decksBody').innerHTML = DECKS.length ? DECKS.map(d => {
    const mine = cards.filter(c => c.deck === d.id), have = mine.length, known = mine.filter(c => c.known).length;
    return `<div class="form deck">
      <div class="deck-top"><div class="deck-badge">${esc(d.short || tt('Колода'))}</div>
        <div><h2>${esc(L(d.title))}</h2><p class="muted">${esc(L(d.desc))}</p></div></div>
      <div><div class="meter"><i style="width:${have ? known / d.cards.length * 100 : 0}%"></i></div>
        <div class="deck-meta">${tt('В колоде слов: {a} · добавлено: {b} · выучено: {c}', { a: d.cards.length, b: have, c: known })}</div></div>
      <div class="row">
        <button class="btn primary" data-add="${d.id}" ${have >= d.cards.length ? 'disabled' : ''}>${have >= d.cards.length ? tt('Все слова добавлены') : have ? tt('Добавить недостающие') : tt('Добавить в мои карточки')}</button>
        ${have ? `<button class="btn danger" data-rm="${d.id}">${tt('Убрать колоду')}</button>` : ''}
      </div></div>`;
  }).join('') : `<div class="empty">${tt('Готовых колод пока нет')}</div>`;
}
$('#decksBody').onclick = e => {
  const { add, rm } = e.target.dataset;
  if (add) addDeck(add);
  if (rm) removeDeck(rm);
};
function addDeck(id) {
  const d = DECKS.find(x => x.id === id); if (!d) return;
  const have = new Set(cards.map(c => c.hanzi + '|' + c.pinyin));
  let added = 0;
  for (const [hanzi, pinyin, tr, example] of d.cards) {
    if (have.has(hanzi + '|' + pinyin)) continue;      // уже есть — не дублируем
    cards.push(norm({ hanzi, pinyin, ru: tr.ru, tr, example: example || '', deck: id })); added++;
  }
  saveCards(); updateCount(); renderDecks();
  added ? toast('Добавлено карточек: {n}', { n: added }) : toast('Все слова уже есть в ваших карточках');
}
function removeDeck(id) {
  const n = cards.filter(c => c.deck === id).length;
  if (!confirm(tt('Удалить {n} карточек этой колоды вместе с их прогрессом? Ваши собственные карточки не тронутся.', { n }))) return;
  cards = cards.filter(c => c.deck !== id); saveCards(); updateCount(); renderDecks(); toast('Колода убрана');
}

/* ---------- Переключатель языка ---------- */
function applyStatic() {
  document.documentElement.lang = settings.lang;
  document.title = tt('Иероглифы — карточки');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.dataset.src ??= el.textContent.trim(); el.textContent = tt(el.dataset.src); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.dataset.srcph ??= el.getAttribute('placeholder'); el.setAttribute('placeholder', tt(el.dataset.srcph)); });
  document.querySelectorAll('#langSw button').forEach(b => b.classList.toggle('active', b.dataset.lang === settings.lang));
  $('#formTitle').textContent = tt(editingId ? 'Редактирование' : 'Новая карточка');
  $('#fSubmit').textContent = tt(editingId ? 'Сохранить' : 'Добавить');
  fillDeckFilter();
}
function setLang(l) {
  if (!LANGS[l]) return;
  settings.lang = l; saveSettings(); applyStatic();
  if (currentView === 'study') { flipped = revealed = false; renderStudy(); }
  else if (currentView === 'list') renderList();
  else if (currentView === 'decks') renderDecks();
  else if (currentView === 'stats') renderStats();
  else if (currentView === 'write') nextWrite();
}
$('#langSw').innerHTML = Object.entries(LANGS).map(([k, n]) => `<button data-lang="${k}" title="${n}" aria-label="${n}">${k.toUpperCase()}</button>`).join('');
$('#langSw').onclick = e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); };

/* ---------- Старт ---------- */
applyStatic();
updateCount();
showView('study');
