(function () {
'use strict';

var app = document.getElementById('app');
var D = window.QUIZ_DATA;
var POINTS = {1: 10, 2: 20, 3: 30};
var LEVEL = {1: 'Лёгкие', 2: 'Средние', 3: 'Сложные'};
var LETTERS = ['A', 'B', 'C', 'D'];
var PREFIX = 'vq1:';

/* ---------- хранилище (с запасным вариантом в памяти) ---------- */
var mem = {};
var storageOk = (function () {
  try { localStorage.setItem(PREFIX + 't', '1'); localStorage.removeItem(PREFIX + 't'); return true; }
  catch (e) { return false; }
})();
function sGet(k) {
  if (!storageOk) return mem[k] === undefined ? null : mem[k];
  try { return localStorage.getItem(PREFIX + k); } catch (e) { return mem[k] === undefined ? null : mem[k]; }
}
function sSet(k, v) {
  mem[k] = v;
  if (!storageOk) return;
  try { localStorage.setItem(PREFIX + k, v); } catch (e) {}
}
function sDel(k) {
  delete mem[k];
  if (!storageOk) return;
  try { localStorage.removeItem(PREFIX + k); } catch (e) {}
}
function load(k) { try { return JSON.parse(sGet(k)); } catch (e) { return null; } }

/* ---------- дата и выбор викторины ---------- */
function validData() {
  return D && Array.isArray(D.weeks) && D.weeks.length && D.weeks.every(function (w) {
    return w && w.start && Array.isArray(w.days) && w.days.length;
  });
}
function todayKey(date) {
  // ГГГГ-ММ-ДД в часовом поясе проекта (по умолчанию Москва)
  return new Intl.DateTimeFormat('en-CA', {timeZone: (D && D.timezone) || 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(date || new Date());
}
function dayNum(key) {
  var p = key.split('-').map(Number);
  return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5);
}
function keyFromNum(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }

function pickQuiz(key) {
  var n = dayNum(key), i, w, s;
  for (i = 0; i < D.weeks.length; i++) {
    w = D.weeks[i]; s = dayNum(w.start);
    if (n >= s && n < s + w.days.length) return {qs: w.days[n - s], number: n - dayNum(D.weeks[0].start) + 1, repeat: false};
  }
  // контент закончился — по кругу показываем уже имеющиеся дни, чтобы сайт не оставался пустым
  var flat = [];
  D.weeks.forEach(function (x) { x.days.forEach(function (d) { flat.push(d); }); });
  var first = dayNum(D.weeks[0].start);
  var idx = (((n - first) % flat.length) + flat.length) % flat.length;
  return {qs: flat[idx], number: n - first + 1, repeat: true};
}

function msToMidnight() {
  var parts = new Intl.DateTimeFormat('en-GB', {timeZone: D.timezone || 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}).formatToParts(new Date());
  var v = {};
  parts.forEach(function (p) { v[p.type] = Number(p.value); });
  return 86400 - (v.hour * 3600 + v.minute * 60 + v.second);
}
function fmtCountdown(sec) {
  var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return [h, m, s].map(function (x) { return String(x).padStart(2, '0'); }).join(':');
}

/* ---------- утилиты ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; });
}
function plural(n, a, b, c) {
  var m = Math.abs(n) % 100, d = m % 10;
  if (m > 10 && m < 20) return c;
  if (d > 1 && d < 5) return b;
  return d === 1 ? a : c;
}
function longDate(key) {
  var p = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(Date.UTC(p[0], p[1] - 1, p[2])));
}
function validQuestion(q) {
  return q && typeof q.q === 'string' && Array.isArray(q.o) && q.o.length === 4 && q.a >= 0 && q.a <= 3 && POINTS[q.d];
}

/* ---------- состояние ---------- */
var timer = null;
var st = null; // {mode, key, qs, answers, i, info}

function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }
function maxScore(qs) { return qs.reduce(function (s, q) { return s + POINTS[q.d]; }, 0); }
function calc(qs, answers) {
  var r = {correct: 0, score: 0, by: {1: [0, 0], 2: [0, 0], 3: [0, 0]}};
  qs.forEach(function (q, i) {
    r.by[q.d][1]++;
    if (answers[i] === q.a) { r.correct++; r.score += POINTS[q.d]; r.by[q.d][0]++; }
  });
  return r;
}
function rankTitle(c, n) {
  var f = c / n;
  if (f === 1) return 'Эксперт кино';
  if (f >= .8) return 'Кинокритик';
  if (f >= .6) return 'Киноман';
  if (f >= .4) return 'Любитель кино';
  return 'Случайный зритель';
}
function streak(todayK) {
  var n = dayNum(todayK), count = 0;
  if (!load('r:' + keyFromNum(n))) n--; // сегодня ещё не пройдено — серия считается до вчера
  while (load('r:' + keyFromNum(n))) { count++; n--; }
  return count;
}

/* ---------- экраны ---------- */
function setView(html) { clearTimer(); app.innerHTML = html; }

function showError(title, text) {
  setView('<div class="qz-eyebrow"><i></i> VERNOVSKIY QUIZ</div><h1 class="qz-h1">' + esc(title) + '</h1><p class="qz-lead">' + esc(text) + '</p><div class="qz-actions"><a class="qz-btn" href="../">На главную</a></div>');
}

function start() {
  if (!validData()) return showError('Викторина временно недоступна', 'Не удалось загрузить вопросы. Обновите страницу или загляните позже.');
  var key = todayKey();
  var pick = pickQuiz(key);
  var qs = pick.qs.filter(validQuestion);
  if (!qs.length) return showError('На сегодня викторины нет', 'Вопросы дня не найдены. Мы уже работаем над этим.');
  st = {mode: 'daily', key: key, qs: qs, answers: new Array(qs.length).fill(null), i: 0, info: pick};
  var official = load('r:' + key);
  if (official && Array.isArray(official.a) && official.a.length === qs.length) {
    st.answers = official.a;
    return renderResult();
  }
  var prog = load('p:' + key);
  if (prog && Array.isArray(prog) && prog.length === qs.length) st.answers = prog.map(function (x) { return (x === 0 || x === 1 || x === 2 || x === 3) ? x : null; });
  renderIntro();
}

function answeredCount() { return st.answers.filter(function (a) { return a !== null; }).length; }

function renderIntro() {
  var n = st.qs.length, done = answeredCount();
  var counts = {1: 0, 2: 0, 3: 0};
  st.qs.forEach(function (q) { counts[q.d]++; });
  var note = '';
  if (!storageOk) note += '<p class="qz-note"><b>Прогресс не сохраняется.</b> В этом браузере недоступно локальное хранилище — результат останется только до закрытия страницы.</p>';
  if (st.info.repeat) note += '<p class="qz-note"><b>Новых вопросов пока нет.</b> Показываем подборку из архива — скоро добавим свежие.</p>';
  var title = st.info.repeat ? 'Подборка из архива' : 'Викторина дня № ' + st.info.number;
  setView(
    '<div class="qz-eyebrow"><i></i> ' + esc(longDate(st.key)) + '</div>' +
    '<h1 class="qz-h1">' + esc(title) + '</h1>' +
    '<p class="qz-lead">Фильмы, сериалы, персонажи, актёры и цитаты. Ответ нельзя изменить после выбора. В зачёт идёт первое прохождение за день.</p>' + note +
    '<div class="qz-facts"><div><strong>' + n + '</strong><span>вопросов</span></div><div><strong>' + maxScore(st.qs) + '</strong><span>макс. баллов</span></div><div><strong>' + counts[1] + '/' + counts[2] + '/' + counts[3] + '</strong><span>по сложности</span></div></div>' +
    '<div class="qz-actions"><button class="qz-btn" id="go">' + (done ? 'Продолжить · ' + done + ' из ' + n : 'Начать викторину') + '</button></div>'
  );
  document.getElementById('go').addEventListener('click', function () {
    st.i = Math.min(done, n - 1);
    for (var j = 0; j < n; j++) if (st.answers[j] === null) { st.i = j; break; }
    if (done === n) return finish();
    renderQuestion();
  });
}

function renderQuestion() {
  var q = st.qs[st.i], n = st.qs.length, picked = st.answers[st.i], revealed = picked !== null;
  var bar = '';
  for (var j = 0; j < n; j++) bar += '<i class="' + (st.answers[j] !== null ? 'done' : (j === st.i ? 'now' : '')) + '"></i>';
  var opts = q.o.map(function (text, idx) {
    var cls = 'qz-opt', mark = '';
    if (revealed) {
      if (idx === q.a) { cls += ' correct'; mark = 'Верно'; }
      else if (idx === picked) { cls += ' wrong'; mark = 'Ваш ответ'; }
      else cls += ' dim';
    }
    return '<li><button class="' + cls + '" data-i="' + idx + '"' + (revealed ? ' disabled' : '') + '><span class="k">' + LETTERS[idx] + '</span><span class="t">' + esc(text) + '</span><span class="m">' + mark + '</span></button></li>';
  }).join('');
  var fb = '', next = '';
  if (revealed) {
    var ok = picked === q.a;
    fb = '<div class="qz-fb ' + (ok ? 'ok' : 'no') + '" role="status"><h3>' + (ok ? 'Верно! +' + POINTS[q.d] + ' ' + plural(POINTS[q.d], 'балл', 'балла', 'баллов') : 'Неверно. Правильный ответ: ' + esc(q.o[q.a])) + '</h3>' + (q.e ? '<p>' + esc(q.e) + '</p>' : '') + '</div>';
    next = '<div class="qz-next"><button class="qz-btn" id="next">' + (st.i === n - 1 ? 'Посмотреть результат' : 'Следующий вопрос') + '</button></div>';
  }
  setView(
    '<div class="qz-progress" role="progressbar" aria-valuemin="1" aria-valuemax="' + n + '" aria-valuenow="' + (st.i + 1) + '" aria-label="Вопрос ' + (st.i + 1) + ' из ' + n + '">' + bar + '</div>' +
    '<div class="qz-meta"><span><b>' + (st.i + 1) + '</b> / ' + n + ' · ' + esc(q.c) + '</span><span>' + (st.mode === 'practice' ? '<span class="qz-practice">Тренировка</span> ' : '') + ({1: 'Лёгкий', 2: 'Средний', 3: 'Сложный'}[q.d]) + ' · ' + POINTS[q.d] + ' б.</span></div>' +
    '<h2 class="qz-q" tabindex="-1" id="qtext">' + esc(q.q) + '</h2><ul class="qz-opts">' + opts + '</ul>' + fb + next
  );
  var qt = document.getElementById('qtext');
  app.querySelectorAll('.qz-opt').forEach(function (b) {
    b.addEventListener('click', function () { choose(Number(b.getAttribute('data-i'))); });
  });
  var nb = document.getElementById('next');
  if (nb) { nb.addEventListener('click', advance); nb.focus({preventScroll: true}); }
  else if (qt) qt.focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: 'auto'});
}

function choose(idx) {
  if (st.answers[st.i] !== null) return; // повторный ответ на тот же вопрос невозможен
  st.answers[st.i] = idx;
  if (st.mode === 'daily') sSet('p:' + st.key, JSON.stringify(st.answers));
  renderQuestion();
}
function advance() {
  if (st.i < st.qs.length - 1) { st.i++; renderQuestion(); } else finish();
}

function finish() {
  if (st.mode === 'daily') {
    if (!load('r:' + st.key)) {
      var r = calc(st.qs, st.answers);
      sSet('r:' + st.key, JSON.stringify({a: st.answers, score: r.score, correct: r.correct, ts: Date.now()}));
    }
    sDel('p:' + st.key);
  }
  renderResult();
}

function renderResult() {
  var qs = st.qs, n = qs.length, r = calc(qs, st.answers), practice = st.mode === 'practice';
  var bars = [1, 2, 3].map(function (d) {
    var c = r.by[d];
    return '<div class="qz-bar"><span>' + LEVEL[d] + '</span><div><i data-w="' + (c[1] ? Math.round(c[0] / c[1] * 100) : 0) + '"></i></div><b>' + c[0] + '/' + c[1] + '</b></div>';
  }).join('');
  var review = qs.map(function (q, i) {
    var ok = st.answers[i] === q.a;
    return '<div class="qz-ritem"><p>' + (i + 1) + '. ' + esc(q.q) + '</p><small class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ Верно: ' : '✕ Ваш ответ: ' + esc(q.o[st.answers[i]] || '—') + ' · Верный: ') + esc(q.o[q.a]) + '</small></div>';
  }).join('');
  var sk = practice ? 0 : streak(st.key);
  var info = practice
    ? '<p class="qz-note"><b>Тренировка.</b> Эти баллы не засчитываются: зачётный результат дня сохранён ранее.</p>'
    : '<p class="qz-note">Результат дня сохранён. ' + (sk > 1 ? '<b>Серия: ' + sk + ' ' + plural(sk, 'день', 'дня', 'дней') + ' подряд.</b> ' : '') + 'Повторное прохождение не меняет баллы.</p>';
  setView(
    '<div class="qz-eyebrow"><i></i> ' + (practice ? 'Тренировка · ' : 'Итог · ') + esc(longDate(st.key)) + '</div>' +
    '<div class="qz-score"><strong>' + r.score + '</strong><span>из ' + maxScore(qs) + ' баллов<br>' + r.correct + ' из ' + n + ' верно</span></div>' +
    '<p class="qz-rank">' + rankTitle(r.correct, n) + '</p>' + info +
    '<div class="qz-bars">' + bars + '</div>' +
    '<div class="qz-actions"><button class="qz-btn" id="practice">Пройти ещё раз для тренировки</button><button class="qz-btn ghost" id="share">Скопировать результат</button></div>' +
    (practice ? '' : '<div class="qz-next-day"><span>Новая викторина через</span><b id="cd">' + fmtCountdown(msToMidnight()) + '</b></div>') +
    '<details class="qz-review"><summary>Разбор ответов</summary>' + review + '</details>'
  );
  requestAnimationFrame(function () {
    app.querySelectorAll('.qz-bar i').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
  });
  document.getElementById('practice').addEventListener('click', function () {
    st = {mode: 'practice', key: st.key, qs: st.qs, answers: new Array(st.qs.length).fill(null), i: 0, info: st.info};
    renderQuestion();
  });
  document.getElementById('share').addEventListener('click', function (e) {
    var grid = qs.map(function (q, i) { return st.answers[i] === q.a ? '🟩' : '⬛'; }).join('');
    var text = 'VERNOVSKIY QUIZ · ' + longDate(st.key) + '\n' + r.correct + '/' + n + ' · ' + r.score + ' баллов\n' + grid;
    var btn = e.currentTarget;
    var done = function (msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = 'Скопировать результат'; }, 2000); };
    try { navigator.clipboard.writeText(text).then(function () { done('Скопировано'); }, function () { done('Не удалось скопировать'); }); }
    catch (err) { done('Не удалось скопировать'); }
  });
  var cd = document.getElementById('cd');
  if (cd) {
    timer = setInterval(function () {
      var left = msToMidnight();
      cd.textContent = fmtCountdown(left);
      if (todayKey() !== st.key) { clearTimer(); start(); } // наступил новый день — загружаем новую викторину
    }, 1000);
  }
}

/* клавиши 1–4 — выбор ответа */
document.addEventListener('keydown', function (e) {
  if (!st || e.ctrlKey || e.metaKey || e.altKey) return;
  var idx = ['1', '2', '3', '4'].indexOf(e.key);
  if (idx > -1 && document.querySelector('.qz-opts') && st.answers[st.i] === null) choose(idx);
});

start();
})();
