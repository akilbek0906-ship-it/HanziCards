'use strict';
window.__app = 10;   // номер версии; index.html сверяет его, чтобы заметить устаревший кэш
const KEYS = { cards: 'hanzi-cards-v1', stats: 'hanzi-stats-v1', set: 'hanzi-settings-v1', lessons: 'hanzi-lessons-v1' };
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
const LANGS = { ru: 'Русский', fr: 'Français', en: 'English' };
const navLang = (navigator.language || '').slice(0, 2).toLowerCase();   // новый язык: словарь в i18n.js + переводы в decks.js
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
  lang: LANGS[navLang] ? navLang : 'ru' }, read(KEYS.set, {}));
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
const VIEWS = ['study', 'write', 'list', 'decks', 'stats', 'learned', 'lessons', 'lesson'];
let currentView = 'study';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === (name === 'learned' ? 'study' : name === 'lesson' ? 'lessons' : name)));
  VIEWS.forEach(v => $('#view-' + v).hidden = v !== name);
  const at = document.querySelector('.tab.active'); if (at && at.scrollIntoView) at.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (name === 'study') buildQueue();
  if (name === 'write') nextWrite();
  if (name === 'list') renderList();
  if (name === 'learned') renderLearned();
  if (name === 'lessons') renderLessons();
  if (name === 'decks') renderDecks();
  if (name === 'stats') renderStats();
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { practiceLearned = false; practiceSel = null; showView(b.dataset.view); });

/* ---------- Режим изучения ---------- */
let queue = [], history = [], flipped = false, revealed = false, includeKnown = false, practiceLearned = false, practiceSel = null;
const inPractice = () => practiceLearned || !!practiceSel;   // тренировка выученных или выбранных слов
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
  const pool = practiceSel
    ? shuffle(practiceSel.filter(id => cards.some(c => c.id === id)))            // набор, выбранный на вкладке «Карточки»
    : shuffle(cards.filter(c => practiceLearned ? c[kf()] : inDeck(c) && (includeKnown || !c[kf()])).map(c => c.id));
  queue = settings.batch && !practiceSel ? pool.slice(0, settings.batch) : pool;   // порция: не больше N карточек за раз
  history = []; flipped = revealed = false;
  renderStudy();
}
$('#deckFilter').onchange = e => { settings.deck = e.target.value; saveSettings(); buildQueue(); };
$('#batchSel').onchange = e => { settings.batch = +e.target.value; saveSettings(); buildQueue(); };
function renderStudy() {
  const area = $('#studyArea');
  $('#progress').textContent = queue.length ? tt('Осталось: {n}', { n: queue.length }) : '';
  $('#undo').disabled = !history.length;
  $('#practiceBar').hidden = !inPractice();
  $('#practiceLabel').textContent = tt(practiceSel ? 'Учу выбранные слова' : 'Тренировка выученных');
  $('#includeKnown').disabled = $('#deckFilter').disabled = inPractice();
  $('#learnedBadge').textContent = cards.filter(c => c[kf()]).length;
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === (rev() ? 'rev' : 'fwd')));
  if (!cards.length) {
    area.innerHTML = `<div class="empty"><strong>${tt('Пока нет карточек')}</strong>${tt('Добавьте первый иероглиф.')}<br><button class="btn primary" id="goAdd">${tt('Добавить карточку')}</button></div>`;
    $('#goAdd').onclick = () => showView('list'); return;
  }
  if (!queue.length && practiceSel) {
    area.innerHTML = `<div class="empty"><strong>${tt('Выбранные слова пройдены')}</strong>${tt('Слов в наборе: {n}.', { n: practiceSel.length })}<br>
        <button class="btn primary" id="sAgain">${tt('Ещё раз')}</button> <button class="btn" id="sBack">${tt('К карточкам')}</button></div>`;
    $('#sAgain').onclick = buildQueue;
    $('#sBack').onclick = () => { practiceSel = null; showView('list'); };
    return;
  }
  if (!queue.length && practiceLearned) {
    const n = cards.filter(c => c[kf()]).length;
    area.innerHTML = n
      ? `<div class="empty"><strong>${tt('Тренировка завершена')}</strong>${tt('Выученных слов: {n}.', { n })}<br>
          <button class="btn primary" id="pAgain">${tt('Ещё раз')}</button> <button class="btn" id="pToLearned">${tt('К выученным')}</button></div>`
      : `<div class="empty"><strong>${tt('Выученных слов не осталось')}</strong>${tt('Все слова вернулись в изучение.')}<br>
          <button class="btn primary" id="pExit">${tt('К изучению')}</button></div>`;
    if (n) { $('#pAgain').onclick = buildQueue; $('#pToLearned').onclick = () => { practiceLearned = false; showView('learned'); }; }
    else $('#pExit').onclick = () => { practiceLearned = false; buildQueue(); };
    return;
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
  if ($('#view-study').hidden || !queue.length || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.closest('#langSw') || $('#strokeDlg').open) return;
  if (e.code === 'Space') { e.preventDefault(); flip(); }
  else if (revealed && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
  else if (revealed && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
});
$('#autoSpeak').checked = settings.autoSpeak;
$('#autoSpeak').onchange = e => { settings.autoSpeak = e.target.checked; saveSettings(); };
$('#includeKnown').onchange = e => { includeKnown = e.target.checked; buildQueue(); };

/* ---------- Выученные слова ---------- */
function renderLearned() {
  const f = kf(), q = $('#learnedSearch').value.trim().toLowerCase();
  const all = cards.filter(c => c[f]);
  document.querySelectorAll('#learnedSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === (rev() ? 'rev' : 'fwd')));
  $('#learnedCount').textContent = all.length;
  $('#practiceBtn').disabled = !all.length;
  const items = all.filter(c => !q || [c.hanzi, c.pinyin, tx(c), c.ru].some(v => (v || '').toLowerCase().includes(q)));
  $('#learnedList').innerHTML = items.length ? items.map(c => `
    <li class="item ${rev() ? 'r' : 'k'}">
      <div class="h">${esc(c.hanzi)}</div>
      <div><div class="p">${py(c.pinyin)}</div><div class="t">${esc(tx(c))}</div>${c.example ? `<div class="ex">${esc(c.example)}</div>` : ''}</div>
      <div class="actions">
        <button class="btn small" data-say="${c.id}">${tt('Звук')}</button>
        <button class="btn small" data-unlearn="${c.id}">${tt('В изучение')}</button>
      </div>
    </li>`).join('')
    : `<li class="empty">${all.length ? tt('Ничего не найдено') : tt('Пока нет выученных слов. Нажимайте «Знаю» во время изучения.')}</li>`;
}
$('#learnedSearch').oninput = renderLearned;
$('#learnedSeg').onclick = e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  settings.mode = b.dataset.mode; saveSettings(); renderLearned();
};
$('#learnedList').onclick = e => {
  const { say, unlearn } = e.target.dataset;
  if (say) speak(cards.find(c => c.id === say).hanzi);
  if (unlearn) { cards.find(c => c.id === unlearn)[kf()] = false; saveCards(); renderLearned(); toast('Возвращено в изучение'); }
};
$('#openLearned').onclick = () => { practiceLearned = false; practiceSel = null; showView('learned'); };
$('#learnedBack').onclick = () => { practiceLearned = false; practiceSel = null; showView('study'); };
$('#practiceBtn').onclick = () => { practiceLearned = true; practiceSel = null; showView('study'); };   // тренировка только выученных
$('#exitPractice').onclick = () => { practiceLearned = false; practiceSel = null; buildQueue(); };

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
      strokeColor: '#ece9e1', outlineColor: '#3a4156', radicalColor: '#e6c07b',
      highlightColor: '#86c5a8', drawingColor: '#8fb4e0', strokeAnimationSpeed: 1.2, delayBetweenStrokes: 250,
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
    <li class="item${c.known ? ' k' : ''}${c.knownRev ? ' r' : ''}${selectMode ? ' pickable' : ''}${selected.has(c.id) ? ' picked' : ''}" data-id="${c.id}">
      ${selectMode ? `<span class="pick"><input type="checkbox" tabindex="-1" ${selected.has(c.id) ? 'checked' : ''}></span>` : ''}
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
  updateSelectUI();
}
$('#search').oninput = renderList;
$('#list').onclick = e => {
  if (selectMode) {                                   // в режиме выбора нажатие на карточку отмечает её
    const li = e.target.closest('.item'); if (!li) return;
    const id = li.dataset.id;
    selected.has(id) ? selected.delete(id) : selected.add(id);
    li.classList.toggle('picked', selected.has(id)); li.querySelector('input').checked = selected.has(id);
    updateSelectUI(); return;
  }
  const { say, edit, del } = e.target.dataset;
  if (say) speak(cards.find(c => c.id === say).hanzi);
  if (edit) startEdit(edit);
  if (del && confirm(tt('Удалить карточку?'))) {
    cards = cards.filter(c => c.id !== del); saveCards();
    if (editingId === del) resetForm();
    renderList(); toast('Удалено');
  }
};
/* ---------- Выбор карточек для отдельного изучения ---------- */
let selectMode = false;
const selected = new Set();
const visibleIds = () => [...document.querySelectorAll('#list .item')].map(li => li.dataset.id);
function updateSelectUI() {
  $('#selectBtn').textContent = tt(selectMode ? 'Готово' : 'Выбрать');
  $('#selectBtn').classList.toggle('on', selectMode);
  $('#selectBar').hidden = !selectMode;
  $('#selCount').textContent = tt('Выбрано: {n}', { n: selected.size });
  $('#selStudy').disabled = !selected.size;
}
$('#selectBtn').onclick = () => { selectMode = !selectMode; if (!selectMode) selected.clear(); renderList(); };
$('#selAll').onclick = () => { visibleIds().forEach(id => selected.add(id)); renderList(); };   // все найденные поиском
$('#selNone').onclick = () => { selected.clear(); renderList(); };
$('#selStudy').onclick = () => {
  const ids = [...selected].filter(id => cards.some(c => c.id === id));
  if (!ids.length) return toast('Сначала выберите слова');
  practiceSel = ids; practiceLearned = false; showView('study');
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
  const blob = new Blob([JSON.stringify({ version: 2, cards, stats, lessons: lessonProgress }, null, 2)], { type: 'application/json' });
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
    if (data.lessons && !Object.keys(lessonProgress).length) { lessonProgress = data.lessons; saveLessons(); }
    saveCards(); renderList(); toast('Импортировано: {n}', { n: added });
  } catch { toast('Не удалось прочитать файл'); }
  e.target.value = '';
};

/* ---------- Статистика ---------- */
const active = i => { const d = stats.days[dayKey(i)]; return d && (d.reviews || d.writes || d.lessons); };
function streak() { let n = 0, i = active(0) ? 0 : 1; while (active(i)) { n++; i++; } return n; }
function renderStats() {
  const t = todayStat(), n = cards.length;
  const known = cards.filter(c => c.known).length, knownRev = cards.filter(c => c.knownRev).length;
  const acc = t.reviews ? Math.round((t.reviews - (t.again || 0)) / t.reviews * 100) + '%' : '—';
  const days = Array.from({ length: 14 }, (_, k) => 13 - k).map(i => {
    const d = stats.days[dayKey(i)] || {};
    return { v: (d.reviews || 0) + (d.writes || 0) + (d.lessons || 0), label: dayKey(i).slice(8) };
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
      <div class="tile"><b>${Object.values(lessonProgress).reduce((a, p) => a + (p.runs || 0), 0)}</b><span>${tt('уроков пройдено')}</span></div>
    </div>
    <div class="panel-title">${tt('Прогресс колоды (всего {n})', { n })}</div>
    <div class="legend"><span>${tt('Иероглиф → смысл:')} ${known}</span></div>${bar(known, 'linear-gradient(90deg,var(--jade),var(--sky))')}
    <div class="legend"><span>${tt('Пиньинь → иероглиф:')} ${knownRev}</span></div>${bar(knownRev, 'linear-gradient(90deg,var(--violet),var(--rose))')}
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

/* ---------- Уроки и мини-игры ---------- */
const LESSONS = window.LESSONS || [];
let lessonProgress = read(KEYS.lessons, {});
const saveLessons = () => write(KEYS.lessons, lessonProgress);
const hsk = new Map();                                   // слова колоды HSK: иероглиф → { hanzi, pinyin, tr, deck }
for (const d of DECKS) for (const [h, p, tr] of d.cards) if (!hsk.has(h)) hsk.set(h, { hanzi: h, pinyin: p, tr, deck: d.id });
const wtx = w => w.tr[settings.lang] || w.tr.ru;
const pys = str => String(str).split(/(\s+|[.?!,，。？])/).map(p => /^[\s.?!,，。？]*$/.test(p) ? esc(p) : py(p)).join('');
let ls = null;                                           // текущее прохождение урока
function audioOK() {
  if (!('speechSynthesis' in window)) return false;
  const v = speechSynthesis.getVoices();
  return !v.length || v.some(x => /^zh/i.test(x.lang));
}

function renderLessons() {
  const box = $('#lessonsBody');
  if (!Array.isArray(window.LESSONS)) {
    box.innerHTML = `<div class="empty"><strong>${tt('Файл lessons.js не загрузился')}</strong>${tt('Он должен лежать рядом с index.html. Загрузите его в репозиторий и обновите страницу.')}</div>`;
    return;
  }
  box.innerHTML = LESSONS.length ? LESSONS.map((l, i) => {
    const pr = lessonProgress[l.id], stars = pr ? pr.stars : 0;
    return `<div class="form deck lesson-card">
      <div class="deck-top"><div class="deck-badge">${i + 1}</div>
        <div><h2>${esc(L(l.title))}</h2><p class="muted">${esc(L(l.desc))}</p></div></div>
      <div class="lesson-meta"><span class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
        <span class="muted">${tt('Слов: {n}', { n: l.words.length })} · ${tt('Предложений: {n}', { n: l.sentences.length })}</span></div>
      <div class="row"><button class="btn primary" data-lesson="${l.id}">${pr ? tt('Пройти снова') : tt('Начать')}</button></div>
    </div>`;
  }).join('') : `<div class="empty">${tt('Пока нет уроков')}</div>`;
}
$('#lessonsBody').onclick = e => { const b = e.target.closest('[data-lesson]'); if (b) startLesson(b.dataset.lesson); };

function startLesson(id) {
  const l = LESSONS.find(x => x.id === id); if (!l) return;
  const words = l.words.map(h => hsk.get(h)).filter(Boolean);
  const audio = audioOK();
  const gm = () => ({ ok: 0, total: 0, mistakes: 0 });
  ls = { id, l, words, wordSet: new Set(words.map(w => w.hanzi)), audio, t0: Date.now(), missed: new Set(), hints: 0, saved: false,
    stages: ['intro', 'match', ...(audio ? ['listen'] : []), 'gap', 'build', 'result'], stage: 0,
    g: { match: gm(), listen: gm(), gap: gm(), build: gm() } };
  showView('lesson'); renderLesson();
}
function renderLesson() {
  const st = ls.stages[ls.stage];
  $('#lessonTitle').textContent = L(ls.l.title);
  $('#lessonStage').textContent = tt('Этап {a} из {b}', { a: ls.stage + 1, b: ls.stages.length });
  $('#lessonBar').style.width = (ls.stage / (ls.stages.length - 1) * 100) + '%';
  ({ intro: stageIntro, match: stageMatch, listen: stageListen, gap: stageGap, build: stageBuild, result: stageResult })[st]();
  window.scrollTo({ top: 0 });
}
const lessonNext = () => { ls.stage++; renderLesson(); };
$('#lessonExit').onclick = () => {
  if (ls && ls.stages[ls.stage] !== 'result' && !confirm(tt('Выйти из урока? Прогресс не сохранится.'))) return;
  ls = null; showView('lessons');
};

/* 0. Ключевые слова */
function stageIntro() {
  const a = $('#lessonArea');
  a.innerHTML = `<h3 class="game-title">${tt('Ключевые слова')}</h3>
    ${ls.audio ? '' : `<p class="muted">${tt('Озвучка недоступна на этом устройстве — игры со звуком пропущены.')}</p>`}
    <ul class="list">${ls.words.map(w => `<li class="item"><div class="h">${esc(w.hanzi)}</div>
      <div><div class="p">${py(w.pinyin)}</div><div class="t">${esc(wtx(w))}</div></div>
      <div class="actions"><button class="btn small" data-say="${esc(w.hanzi)}">${tt('Звук')}</button></div></li>`).join('')}</ul>
    <div class="row center"><button class="btn primary wide" id="lStart">${tt('Начать игры')}</button></div>`;
  a.onclick = e => {
    const sp = e.target.closest('[data-say]'); if (sp) speak(sp.dataset.say);
    if (e.target.closest('#lStart')) lessonNext();
  };
}

/* 1. Найди пару: иероглиф ↔ перевод / пиньинь / звук */
function stageMatch() {
  ls.m = { round: 0, modes: ls.audio ? ['tr', 'py', 'audio'] : ['tr', 'py', 'tr'] };
  matchRound();
}
function matchRound() {
  const m = ls.m, mode = m.modes[m.round];
  const pairs = shuffle(ls.words.slice()).slice(0, Math.min(5, ls.words.length));
  Object.assign(m, { mode, pairs, matched: 0, fails: new Set(), sel: { L: null, R: null }, lock: false });
  const left = shuffle(pairs.slice()), right = shuffle(pairs.slice());
  const cell = (w, i) => mode === 'tr' ? esc(wtx(w)) : mode === 'py' ? py(w.pinyin) : `▶ ${i + 1}`;
  const hint = mode === 'tr' ? tt('Соедините иероглифы с переводом') : mode === 'py' ? tt('Соедините иероглифы с пиньинем') : tt('Нажмите на звук и найдите нужный иероглиф');
  $('#lessonArea').innerHTML = `
    <h3 class="game-title">${tt('Найди пару')} <span class="muted">· ${tt('Раунд {a} из {b}', { a: m.round + 1, b: m.modes.length })}</span></h3>
    <p class="muted">${hint}</p>
    <div class="match">
      <div class="col">${left.map(w => `<button class="tile-btn hz" data-side="L" data-k="${esc(w.hanzi)}">${esc(w.hanzi)}</button>`).join('')}</div>
      <div class="col">${right.map((w, i) => `<button class="tile-btn ${mode}" data-side="R" data-k="${esc(w.hanzi)}">${cell(w, i)}</button>`).join('')}</div>
    </div>`;
  $('#lessonArea').onclick = matchClick;
}
function matchClick(e) {
  const m = ls.m, b = e.target.closest('.tile-btn');
  if (!b || m.lock || b.classList.contains('done')) return;
  const side = b.dataset.side, k = b.dataset.k;
  if ((side === 'R' && m.mode === 'audio') || (side === 'L' && m.mode !== 'audio')) speak(k);
  if (m.sel[side]) m.sel[side].classList.remove('sel');
  m.sel[side] = b; b.classList.add('sel');
  const a = m.sel.L, c = m.sel.R; if (!a || !c) return;
  m.sel = { L: null, R: null };
  const g = ls.g.match;
  if (a.dataset.k === c.dataset.k) {
    [a, c].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); });
    g.total++; if (!m.fails.has(a.dataset.k)) g.ok++;
    if (++m.matched === m.pairs.length) {
      m.lock = true;
      setTimeout(() => { m.round++; m.round < m.modes.length ? matchRound() : lessonNext(); }, 650);
    }
  } else {
    g.mistakes++; m.fails.add(a.dataset.k); ls.missed.add(a.dataset.k);
    m.lock = true;
    [a, c].forEach(x => x.classList.add('wrong'));
    setTimeout(() => { [a, c].forEach(x => x.classList.remove('wrong', 'sel')); m.lock = false; }, 450);
  }
}

/* общий вопрос с выбором ответа (аудирование и пропущенное слово) */
function askChoice({ head, prompt, options, answer, game, word, after, onOk }) {
  const a = $('#lessonArea');
  a.innerHTML = `${head}<div class="prompt-box">${prompt}</div>
    <div class="opts-grid">${options.map(o => `<button class="opt" data-k="${esc(o.k)}">${o.html}</button>`).join('')}</div>`;
  let failed = false;
  a.onclick = e => {
    const r = e.target.closest('[data-replay]'); if (r) return speak(r.dataset.replay);
    const b = e.target.closest('.opt'); if (!b || b.disabled) return;
    const g = ls.g[game];
    if (b.dataset.k === answer) {
      b.classList.add('ok'); a.querySelectorAll('.opt').forEach(x => x.disabled = true);
      g.total++; if (!failed) g.ok++;
      if (onOk) onOk();
      setTimeout(after, 800);
    } else { b.classList.add('bad'); b.disabled = true; failed = true; g.mistakes++; ls.missed.add(word); }
  };
}
const hzOpt = t => ({ k: t, html: `<span class="hz">${esc(t)}</span>` });

/* 2. Услышь и выбери */
function stageListen() {
  ls.q = { list: shuffle(ls.words.slice()).slice(0, Math.min(5, ls.words.length)), i: 0 };
  listenQ();
}
function listenQ() {
  const q = ls.q, w = q.list[q.i];
  const options = shuffle([w, ...shuffle(ls.words.filter(x => x !== w)).slice(0, 3)]).map(x => hzOpt(x.hanzi));
  askChoice({
    head: `<h3 class="game-title">${tt('Услышь и выбери')} <span class="muted">· ${tt('Вопрос {a} из {b}', { a: q.i + 1, b: q.list.length })}</span></h3>`,
    prompt: `<p class="muted">${tt('Какое слово вы слышите?')}</p><button class="btn" data-replay="${esc(w.hanzi)}">▶ ${tt('Послушать ещё раз')}</button>`,
    options, answer: w.hanzi, game: 'listen', word: w.hanzi,
    after: () => { q.i++; q.i < q.list.length ? listenQ() : lessonNext(); }
  });
  setTimeout(() => speak(w.hanzi), 300);
}

/* 3. Пропущенное слово */
function stageGap() {
  ls.q = { list: shuffle(ls.l.sentences.slice()), i: 0 };
  gapQ();
}
function gapQ() {
  const q = ls.q, s = q.list[q.i], ans = s.zh[s.gap];
  const options = shuffle([ans, ...s.bad]).map(hzOpt);
  const sent = s.zh.map((t, i) => i === s.gap ? '<span class="blank" id="gapBlank">＿＿</span>' : esc(t)).join('') + esc(s.p || '');
  askChoice({
    head: `<h3 class="game-title">${tt('Пропущенное слово')} <span class="muted">· ${tt('Вопрос {a} из {b}', { a: q.i + 1, b: q.list.length })}</span></h3>`,
    prompt: `<p class="muted">${tt('Выберите слово, которого не хватает')}</p><div class="sentence-zh">${sent}</div><div class="ru">${esc(L(s.tr))}</div>`,
    options, answer: ans, game: 'gap', word: ans,
    onOk: () => { const bl = $('#gapBlank'); bl.textContent = ans; bl.classList.add('filled'); if (ls.audio) speak(s.zh.join('') ); },
    after: () => { q.i++; q.i < q.list.length ? gapQ() : lessonNext(); }
  });
}

/* 4. Собери предложение */
function stageBuild() { ls.b = { list: shuffle(ls.l.sentences.slice()), i: 0 }; buildQ(); }
function buildQ() {
  const b = ls.b, s = b.list[b.i];
  const tokens = s.zh.map((t, id) => ({ id, t }));
  let bank = shuffle(tokens.slice());
  if (tokens.length > 1) for (let n = 0; n < 8 && bank.every((x, k) => x.t === s.zh[k]); n++) bank = shuffle(tokens.slice());
  Object.assign(b, { s, bank, ans: [], failed: false, hinted: false, solved: false, msg: '' });
  renderBuild();
}
function renderBuild() {
  const b = ls.b, s = b.s;
  $('#lessonArea').innerHTML = `
    <h3 class="game-title">${tt('Собери предложение')} <span class="muted">· ${tt('Предложение {a} из {b}', { a: b.i + 1, b: b.list.length })}</span></h3>
    <p class="muted">${tt('Составьте предложение из слов')}</p>
    <div class="prompt-box"><div class="ru">${esc(L(s.tr))}</div></div>
    <div class="ans-line${b.solved ? ' ok' : ''}">${b.ans.map(t => `<button class="chip-w placed" data-id="${t.id}">${esc(t.t)}</button>`).join('')}${b.solved ? `<span class="sentence-zh">${esc(s.p || '')}</span>` : ''}</div>
    <div class="bank">${b.bank.map(t => `<button class="chip-w" data-id="${t.id}">${esc(t.t)}</button>`).join('')}</div>
    <div class="build-fb ${b.solved ? 'ok' : b.msg === 'bad' ? 'bad' : ''}">${b.solved ? `<div class="pinyin">${pys(s.py)}</div>${tt('Верно!')}` : b.msg === 'bad' ? tt('Не совсем — попробуйте ещё раз') : ''}</div>
    <div class="row center">${b.solved ? `<button class="btn primary" id="bNext">${tt('Дальше')}</button>` : `<button class="btn small" id="bHint">${tt('Подсказка')}</button>`}</div>`;
  $('#lessonArea').onclick = buildClick;
}
function buildClick(e) {
  const b = ls.b;
  if (e.target.closest('#bNext')) { b.i++; return b.i < b.list.length ? buildQ() : lessonNext(); }
  if (b.solved) return;
  if (e.target.closest('#bHint')) return buildHint();
  const chip = e.target.closest('.chip-w'); if (!chip) return;
  const id = +chip.dataset.id;
  const from = chip.classList.contains('placed') ? b.ans : b.bank, to = from === b.ans ? b.bank : b.ans;
  const k = from.findIndex(t => t.id === id); if (k < 0) return;
  to.push(from.splice(k, 1)[0]);
  b.msg = '';
  buildCheck();
}
function buildCheck() {
  const b = ls.b, s = b.s;
  if (b.bank.length) return renderBuild();
  if (b.ans.every((t, k) => t.t === s.zh[k])) {
    b.solved = true;
    const g = ls.g.build; g.total++; if (!b.failed && !b.hinted) g.ok++;
    if (ls.audio) speak(s.zh.join(''));
  } else {
    b.failed = true; b.msg = 'bad'; ls.g.build.mistakes++;
    s.zh.forEach(t => { if (ls.wordSet.has(t)) ls.missed.add(t); });
  }
  renderBuild();
}
function buildHint() {
  const b = ls.b, s = b.s;
  if (!b.ans.every((t, k) => t.t === s.zh[k])) b.bank.push(...b.ans.splice(0));      // убираем неверное начало
  const k = b.bank.findIndex(t => t.t === s.zh[b.ans.length]);
  b.ans.push(b.bank.splice(k, 1)[0]);
  b.hinted = true; ls.hints++; b.msg = '';
  buildCheck();
}

/* Итоги урока */
function ensureCards(hanzis) {                            // слова урока → карточки пользователя (добавляем недостающие)
  let added = 0; const ids = [];
  for (const h of hanzis) {
    const w = hsk.get(h); if (!w) continue;
    let c = cards.find(x => x.hanzi === w.hanzi && x.pinyin === w.pinyin);
    if (!c) { c = norm({ hanzi: w.hanzi, pinyin: w.pinyin, ru: w.tr.ru, tr: w.tr, deck: w.deck }); cards.push(c); added++; }
    ids.push(c.id);
  }
  if (added) { saveCards(); updateCount(); toast('Добавлено карточек: {n}', { n: added }); }
  return ids;
}
function stageResult() {
  const g = ls.g;
  let ok = 0, total = 0, mistakes = 0;
  ['match', 'listen', 'gap', 'build'].forEach(k => { ok += g[k].ok; total += g[k].total; mistakes += g[k].mistakes; });
  const acc = total ? Math.round(ok / total * 100) : 100;
  const stars = acc >= 90 ? 3 : acc >= 70 ? 2 : 1;
  if (!ls.saved) {
    const prev = lessonProgress[ls.id];
    ls.secs = Math.round((Date.now() - ls.t0) / 1000);
    ls.record = !!prev && acc > prev.acc;
    lessonProgress[ls.id] = { stars: Math.max(stars, prev ? prev.stars : 0), acc: Math.max(acc, prev ? prev.acc : 0),
      runs: (prev ? prev.runs : 0) + 1, last: { acc, secs: ls.secs, at: Date.now() } };
    saveLessons(); log('lessons'); ls.saved = true;
  }
  const time = `${Math.floor(ls.secs / 60)}:${String(ls.secs % 60).padStart(2, '0')}`;
  const names = { match: tt('Найди пару'), listen: tt('Услышь и выбери'), gap: tt('Пропущенное слово'), build: tt('Собери предложение') };
  const missed = [...ls.missed].map(h => hsk.get(h)).filter(Boolean);
  const idx = LESSONS.findIndex(l => l.id === ls.id), next = LESSONS[idx + 1];
  $('#lessonArea').innerHTML = `
    <div class="big-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <h3 class="game-title" style="text-align:center">${tt('Урок пройден!')} ${ls.record ? `<span class="chip on">${tt('Новый рекорд!')}</span>` : ''}</h3>
    <div class="tiles">
      <div class="tile"><b>${acc}%</b><span>${tt('Точность')}</span></div>
      <div class="tile"><b>${time}</b><span>${tt('Время')}</span></div>
      <div class="tile"><b>${mistakes}</b><span>${tt('Ошибок')}</span></div>
      <div class="tile"><b>${ls.hints}</b><span>${tt('Подсказок')}</span></div>
    </div>
    <div class="panel-title">${tt('Результат по играм')}</div>
    ${['match', 'listen', 'gap', 'build'].filter(k => g[k].total).map(k => `<div class="res-row"><span>${names[k]}</span><b>${g[k].ok}/${g[k].total}</b></div>`).join('')}
    ${missed.length
      ? `<div class="panel-title">${tt('Слова с ошибками')}</div><div class="row">${missed.map(w => `<span class="chip miss">${esc(w.hanzi)} · ${esc(wtx(w))}</span>`).join('')}</div>`
      : `<p class="build-fb ok">${tt('Без ошибок — отлично!')}</p>`}
    <div class="row center">
      ${missed.length ? `<button class="btn primary" id="rMissed">${tt('Повторить ошибки')}</button>` : ''}
      ${next ? `<button class="btn ${missed.length ? '' : 'primary'}" id="rNext">${tt('Следующий урок')}</button>` : ''}
      <button class="btn" id="rAgain">${tt('Пройти ещё раз')}</button>
      <button class="btn" id="rBack">${tt('К урокам')}</button>
    </div>`;
  $('#lessonArea').onclick = e => {
    if (e.target.closest('#rMissed')) { const ids = ensureCards([...ls.missed]); if (ids.length) { practiceSel = ids; practiceLearned = false; ls = null; showView('study'); } }
    else if (e.target.closest('#rNext')) startLesson(next.id);
    else if (e.target.closest('#rAgain')) startLesson(ls.id);
    else if (e.target.closest('#rBack')) { ls = null; showView('lessons'); }
  };
}

/* ---------- Переключатель языка ---------- */
function applyStatic() {
  document.documentElement.lang = settings.lang;
  document.title = tt('Иероглифы — карточки');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.dataset.src ??= el.textContent.trim(); el.textContent = tt(el.dataset.src); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.dataset.srcph ??= el.getAttribute('placeholder'); el.setAttribute('placeholder', tt(el.dataset.srcph)); });
  updateLangUI();
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
  else if (currentView === 'learned') renderLearned();
  else if (currentView === 'lessons') renderLessons();
  else if (currentView === 'lesson' && ls && ['intro', 'result'].includes(ls.stages[ls.stage])) renderLesson();
  else if (currentView === 'write') nextWrite();
}
// выпадающий список языков
function buildLangMenu() {
  $('#langMenu').innerHTML = Object.entries(LANGS).map(([k, n]) =>
    `<button class="lang-opt" role="option" data-lang="${k}"><span>${esc(n)}</span><span class="chk">✓</span></button>`).join('');
}
function updateLangUI() {
  $('#langCur').textContent = LANGS[settings.lang];
  $('#langBtn').setAttribute('aria-label', tt('Язык'));
  document.querySelectorAll('.lang-opt').forEach(b => {
    const on = b.dataset.lang === settings.lang;
    b.classList.toggle('active', on); b.setAttribute('aria-selected', on);
  });
}
function toggleLangMenu(open) {
  const m = $('#langMenu'); open = open ?? m.hidden;
  m.hidden = !open; $('#langBtn').setAttribute('aria-expanded', open);
  if (open) (m.querySelector('.active') || m.firstElementChild).focus();
}
$('#langBtn').onclick = () => toggleLangMenu();
$('#langMenu').onclick = e => {
  const b = e.target.closest('[data-lang]'); if (!b) return;
  setLang(b.dataset.lang); toggleLangMenu(false); $('#langBtn').focus();
};
document.addEventListener('click', e => { if (!e.target.closest('#langSw')) toggleLangMenu(false); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#langMenu').hidden) { toggleLangMenu(false); $('#langBtn').focus(); }
});

/* ---------- Старт ---------- */
buildLangMenu();
applyStatic();
updateCount();
showView('study');
