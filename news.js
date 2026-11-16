(function () {
'use strict';

var app = document.getElementById('app');
var D = window.NEWS_DATA;
var STATUS_ORDER = ['В разработке', 'Запланировано', 'Идея'];
var STATUS_CLASS = {'В разработке': 'dev', 'Запланировано': 'plan', 'Идея': 'idea'};
var LABELS = ['Новое', 'Обновление', 'Исправление', 'MAJOR UPDATE'];

function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')); }
function fmtDate(s) {
  var p = s.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
}

/* ---------- подготовка данных: некорректные записи пропускаются, а не ломают страницу ---------- */
function clean() {
  var d = D && typeof D === 'object' ? D : {};
  var future = (Array.isArray(d.future) ? d.future : []).filter(function (x) {
    return x && typeof x.title === 'string' && x.title.trim() && STATUS_ORDER.indexOf(x.status) !== -1;
  }).map(function (x) { return {id: x.id, title: x.title, description: x.description || '', status: x.status, date: validDate(x.date) ? x.date : null}; });
  var past = (Array.isArray(d.past) ? d.past : []).filter(function (x) {
    return x && typeof x.title === 'string' && x.title.trim();
  }).map(function (x) { return {id: x.id, title: x.title, description: x.description || '', label: LABELS.indexOf(x.label) !== -1 ? x.label : '', date: validDate(x.date) ? x.date : null}; });

  // будущие: по статусу (в разработке, запланировано, идея), внутри статуса сначала записи с известной датой
  future.sort(function (a, b) {
    var s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (s) return s;
    if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    return a.date ? -1 : b.date ? 1 : 0;
  });
  // прошлые: новейшие первыми, записи без даты в конце
  past.sort(function (a, b) {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    return a.date ? -1 : b.date ? 1 : 0;
  });
  return {future: future, past: past};
}

var data = clean();
var tab = location.hash === '#past' ? 'past' : 'future';
var filter = 'all';

/* ---------- отрисовка ---------- */
function card(item, kind) {
  var li = el('li'); var c = el('article', 'nw-card');
  var top = el('div', 'top'); top.appendChild(el('h3', null, item.title));
  var meta = el('div', 'nw-meta');
  if (kind === 'future') {
    meta.appendChild(el('span', 'nw-pill ' + STATUS_CLASS[item.status], item.status));
    meta.appendChild(el('span', 'nw-date', item.date ? fmtDate(item.date) : 'Дата не назначена'));
  } else {
    if (item.label) meta.appendChild(el('span', 'nw-pill' + (item.label === 'MAJOR UPDATE' ? ' major' : ''), item.label));
    meta.appendChild(el('span', 'nw-date', item.date ? fmtDate(item.date) : 'Дата уточняется'));
  }
  top.appendChild(meta); c.appendChild(top);
  if (item.description) c.appendChild(el('p', null, item.description));
  li.appendChild(c); return li;
}
function empty(title, text) { var d = el('div', 'nw-empty'); d.appendChild(el('b', null, title)); d.appendChild(document.createTextNode(text || '')); return d; }

function render() {
  var frag = document.createDocumentFragment();
  var head = el('div');
  head.appendChild(el('div', 'sp-eyebrow')).innerHTML = '<i></i> VERNOVSKIY';
  head.appendChild(el('h1', 'sp-h1', 'Что нового'));
  head.appendChild(el('p', 'sp-lead', 'Как развивается проект: что уже вышло и что может появиться дальше.'));
  frag.appendChild(head);

  var tabs = el('div', 'nw-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Категории обновлений');
  [['future', 'Будущие обновления', data.future.length], ['past', 'Прошлые обновления', data.past.length]].forEach(function (t) {
    var b = el('button', 'nw-tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + t[0];
    b.setAttribute('aria-selected', String(tab === t[0])); b.setAttribute('aria-controls', 'panel');
    b.appendChild(el('small', null, String(t[2])));
    b.addEventListener('click', function () {
      tab = t[0]; filter = 'all';
      try { history.replaceState(null, '', tab === 'past' ? '#past' : location.pathname + location.search); } catch (e) {}
      render();
    });
    tabs.appendChild(b);
  });
  frag.appendChild(tabs);

  var panel = el('div'); panel.id = 'panel'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'tab-' + tab);
  if (tab === 'future') {
    panel.appendChild(el('p', 'sp-note nw-warn', 'Это планы и идеи, а не обещания: не всё из списка обязательно будет сделано, а даты появляются только тогда, когда они известны.'));
    if (data.future.length) {
      var f = el('div', 'nw-filters'); f.appendChild(el('span', 'lbl', 'Статус'));
      [['all', 'Все']].concat(STATUS_ORDER.map(function (s) { return [s, s]; })).forEach(function (o) {
        var ch = el('button', 'nw-chip', o[1]); ch.type = 'button'; ch.setAttribute('aria-pressed', String(filter === o[0]));
        ch.addEventListener('click', function () { filter = o[0]; render(); });
        f.appendChild(ch);
      });
      panel.appendChild(f);
      var shown = data.future.filter(function (x) { return filter === 'all' || x.status === filter; });
      if (shown.length) { var ul = el('ul', 'nw-list'); shown.forEach(function (x) { ul.appendChild(card(x, 'future')); }); panel.appendChild(ul); }
      else panel.appendChild(empty('С таким статусом пока ничего нет', 'Выберите другой статус или «Все».'));
    } else {
      panel.appendChild(empty('Пока нет запланированных обновлений', 'Когда появятся новые идеи, они будут здесь.'));
    }
  } else {
    if (data.past.length) { var tl = el('ul', 'nw-list nw-tl'); data.past.forEach(function (x) { tl.appendChild(card(x, 'past')); }); panel.appendChild(tl); }
    else panel.appendChild(empty('Здесь будут появляться уже выпущенные обновления'));
  }
  frag.appendChild(panel);
  app.replaceChildren(frag);
}

window.addEventListener('hashchange', function () { var t = location.hash === '#past' ? 'past' : 'future'; if (t !== tab) { tab = t; filter = 'all'; render(); } });
render();
})();
