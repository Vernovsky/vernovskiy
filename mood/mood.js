(function () {
'use strict';

var app = document.getElementById('app');
var toastEl = document.getElementById('toast');
var D = window.MOOD_DATA;
var PREFIX = 'vm1:';
var CARE = {
  sad: 'Эти слова не заменяют помощь специалиста. Если грусть держится долго, поговори с близким человеком или с психологом.',
  support: 'Эти слова не заменяют помощь специалиста. Если очень тяжело, не оставайся с этим наедине: поговори с близким человеком, врачом или психологом.'
};

/* ---------- хранилище на устройстве (с запасным вариантом в памяти) ---------- */
var mem = {};
var storageOk = (function () {
  try { localStorage.setItem(PREFIX + 't', '1'); localStorage.removeItem(PREFIX + 't'); return true; } catch (e) { return false; }
})();
function sGet(k) {
  if (!storageOk) return mem[k] === undefined ? null : mem[k];
  try { return localStorage.getItem(PREFIX + k); } catch (e) { return mem[k] === undefined ? null : mem[k]; }
}
function sSet(k, v) { mem[k] = v; if (!storageOk) return; try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
function sDel(k) { delete mem[k]; if (!storageOk) return; try { localStorage.removeItem(PREFIX + k); } catch (e) {} }
function loadJSON(k, fallback) { try { var v = JSON.parse(sGet(k)); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; } }

/* ---------- даты: локальные для посетителя ---------- */
function dateKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dayNum(key) { var p = key.split('-').map(Number); return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5); }
function dayIndex() { return dayNum(dateKey()) - dayNum(D.startDate); }  // 0 — день запуска
function longDate(d) { return new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long'}).format(d || new Date()); }
function salutation(d) {
  var h = (d || new Date()).getHours();
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}
function validData() {
  return D && /^\d{4}-\d{2}-\d{2}$/.test(D.startDate || '') && Array.isArray(D.greetings) && D.greetings.length &&
    Array.isArray(D.categories) && D.categories.length &&
    D.categories.every(function (c) { return c && c.id && c.title && Array.isArray(c.messages) && c.messages.length; });
}

/* Приветствие дня: по одному на каждый календарный день с даты запуска.
   Когда приветствия закончились, показываем подборку из архива и говорим об этом прямо. */
function greetingOfToday() {
  var n = dayIndex(), L = D.greetings.length;
  if (n < 0) return {text: D.greetings[0], archive: false};
  if (n >= L) return {text: D.greetings[n % L], archive: true};
  return {text: D.greetings[n], archive: false};
}

/* ---------- состояние ---------- */
var view = null;          // id выбранной категории или null
var cur = {idx: 0};
var renderedDay = dateKey();

function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function toast(text) {
  toastEl.textContent = text; toastEl.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
}
function catById(id) { return D.categories.filter(function (c) { return c.id === id; })[0]; }
function remember() { return sGet('remember') === '1'; }

/* ---------- экран выбора ---------- */
function buildGreeting() {
  var g = greetingOfToday(), now = new Date();
  var box = el('section', 'mood-greet'); box.id = 'greet'; box.setAttribute('aria-label', 'Приветствие дня');
  var when = el('p', 'when');
  var b = el('b', null, salutation(now)); when.appendChild(b);
  when.appendChild(document.createTextNode(' · ' + longDate(now)));
  if (g.archive) when.appendChild(el('span', 'tag', 'Из архива'));
  box.appendChild(when);
  box.appendChild(el('p', 'text', g.text));
  if (g.archive) box.appendChild(el('p', 'arch', 'Приветствия на ближайшие месяцы закончились, поэтому сегодня показано одно из прежних. Новая партия появится позже.'));
  return box;
}

function renderPicker() {
  view = null;
  var last = remember() ? sGet('last') : null;
  var wrap = document.createDocumentFragment();
  var head = el('div');
  head.appendChild(el('div', 'sp-eyebrow')).innerHTML = '<i></i> VERNOVSKIY MOOD';
  head.appendChild(el('h1', 'sp-h1', 'Твоё настроение'));
  head.appendChild(el('p', 'sp-lead', 'Каждый день новое приветствие и тёплые слова на любой случай. Выбери, как ты сегодня, и получишь сообщение именно для этого состояния.'));
  wrap.appendChild(head);
  wrap.appendChild(buildGreeting());
  wrap.appendChild(el('h2', 'sp-h2', 'Как ты сегодня?'));
  var ul = el('ul', 'mood-grid');
  D.categories.forEach(function (c) {
    var li = el('li'); var b = el('button', 'mood-card'); b.type = 'button'; b.setAttribute('data-cat', c.id);
    b.setAttribute('aria-label', c.title + '. ' + (c.hint || ''));
    b.appendChild(el('span', 'ico', c.icon || '•')).setAttribute('aria-hidden', 'true');
    b.appendChild(el('span', 'ttl', c.title));
    if (c.hint) b.appendChild(el('span', 'hint', c.hint));
    if (last === c.id) b.appendChild(el('span', 'last', 'В прошлый раз'));
    b.addEventListener('click', function () { openCategory(c.id); });
    li.appendChild(b); ul.appendChild(li);
  });
  wrap.appendChild(ul);
  wrap.appendChild(prefControl());
  wrap.appendChild(el('p', 'mood-privacy', 'Твой выбор никуда не отправляется и никому не виден. Всё хранится только в этом браузере' + (storageOk ? '.' : ', а сейчас браузер не разрешает хранение, поэтому ничего не запомнится.')));
  app.replaceChildren(wrap);
}

function prefControl() {
  var lab = el('label', 'mood-pref'); var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = remember();
  cb.addEventListener('change', function () {
    if (cb.checked) { sSet('remember', '1'); if (view) sSet('last', view); toast('Запомню выбор на этом устройстве'); }
    else { sDel('remember'); sDel('last'); toast('Выбор больше не запоминается'); }
    if (!view) renderPicker();
  });
  lab.appendChild(cb); lab.appendChild(el('span', null, 'Запомнить мой выбор на этом устройстве'));
  return lab;
}

/* ---------- экран сообщения ---------- */
function shownMap() { var m = loadJSON('shown', {}); return m && typeof m === 'object' ? m : {}; }
function markShown(catId, idx) {
  var m = shownMap(), arr = Array.isArray(m[catId]) ? m[catId] : [];
  if (arr.indexOf(idx) === -1) arr.push(idx);
  m[catId] = arr; sSet('shown', JSON.stringify(m));
}
function openCategory(catId) {
  var c = catById(catId); if (!c) return;
  var n = dayIndex(), M = c.messages.length;
  cur = {idx: n < 0 ? 0 : n % M};            // первое сообщение зависит от даты, поэтому в один день оно одно и то же
  view = catId;
  markShown(catId, cur.idx);
  if (remember()) sSet('last', catId);
  renderMessage(false);
  var m = document.getElementById('msg'); if (m) m.focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: 'auto'});
}
function nextIndex(c) {
  var M = c.messages.length; if (M < 2) return cur.idx;
  var m = shownMap(), seen = Array.isArray(m[c.id]) ? m[c.id] : [];
  var pool = [], i;
  for (i = 0; i < M; i++) if (seen.indexOf(i) === -1 && i !== cur.idx) pool.push(i);
  if (!pool.length) {                         // всё уже показано: начинаем круг заново, не повторяя текущее
    var fresh = {}; fresh[c.id] = [cur.idx]; var all = shownMap(); all[c.id] = fresh[c.id]; sSet('shown', JSON.stringify(all));
    for (i = 0; i < M; i++) if (i !== cur.idx) pool.push(i);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
function renderMessage(animate) {
  var c = catById(view); if (!c) return renderPicker();
  var box = el('section', 'mood-view'); box.setAttribute('aria-label', 'Сообщение: ' + c.title);
  var cat = el('div', 'cat');
  cat.appendChild(el('span', 'ico', c.icon || '•')).setAttribute('aria-hidden', 'true');
  var lbl = el('span'); lbl.appendChild(document.createTextNode('Сейчас · ')); lbl.appendChild(el('b', null, c.title)); cat.appendChild(lbl);
  box.appendChild(cat);
  var msg = el('p', 'msg' + (animate ? ' swap' : ''), c.messages[cur.idx]); msg.id = 'msg'; msg.tabIndex = -1; msg.setAttribute('aria-live', 'polite');
  box.appendChild(msg);
  var act = el('div', 'sp-actions');
  var more = el('button', 'sp-btn', 'Мне нужно ещё'); more.type = 'button';
  more.addEventListener('click', function () { cur.idx = nextIndex(c); markShown(c.id, cur.idx); renderMessage(true); document.getElementById('msg').focus({preventScroll: true}); });
  var share = el('button', 'sp-btn ghost', 'Поделиться'); share.type = 'button';
  share.addEventListener('click', function () { shareText(c.messages[cur.idx]); });
  act.appendChild(more); act.appendChild(share); box.appendChild(act);
  var pref = prefControl(); pref.classList.add('pref'); box.appendChild(pref);
  if (CARE[c.id]) box.appendChild(el('p', 'care', CARE[c.id]));
  var back = el('button', 'back', '← Выбрать другое настроение'); back.type = 'button';
  back.addEventListener('click', function () { renderPicker(); window.scrollTo({top: 0, behavior: 'auto'}); });
  box.appendChild(back);
  app.replaceChildren(box);
}

/* ---------- «Поделиться» ---------- */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise(function (resolve, reject) {
    try {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy'); document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    } catch (e) { reject(e); }
  });
}
function shareText(message) {
  var url = location.href.split('#')[0];
  var text = '«' + message + '»\n— VERNOVSKIY MOOD';
  var viaCopy = function () {
    copyText(text + '\n' + url).then(function () { toast('Сообщение скопировано'); }, function () { toast('Не удалось скопировать. Выдели текст вручную'); });
  };
  if (navigator.share) {
    navigator.share({text: text, url: url}).catch(function (e) { if (!e || e.name !== 'AbortError') viaCopy(); });
  } else viaCopy();
}

/* ---------- смена даты, пока страница открыта ---------- */
function checkDay() {
  var k = dateKey();
  if (k === renderedDay) return;
  renderedDay = k;
  var g = document.getElementById('greet');
  if (g) g.replaceWith(buildGreeting());      // приветствие обновляется на приветствие нового дня
}
setInterval(checkDay, 30000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDay(); });

/* ---------- старт ---------- */
if (!validData()) {
  app.replaceChildren(el('p', 'sp-note', 'Раздел временно недоступен: не удалось загрузить тексты. Обнови страницу или загляни позже.'));
} else {
  renderPicker();
}
})();
