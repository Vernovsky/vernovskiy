/* VERNOVSKIY — единая аудиосистема.
   Один общий экземпляр плеера на весь сайт. Подключается первым на каждой странице (до остальных скриптов).

   Что делает:
   — создаёт ровно один <audio> (в странице его нет, поэтому дублей быть не может);
   — при переходах между разделами через nav.js плеер не пересоздаётся и не останавливается (музыка играет без паузы);
   — если страница всё же загрузилась заново (обновление, прямая ссылка), запоминает позицию и включённость
     в localStorage и продолжает с того же места;
   — если браузер (в первую очередь iPhone) запрещает автозапуск, ждёт первого касания/клика/клавиши и запускает музыку тогда;
   — не даёт играть одновременно в двух вкладках;
   — по умолчанию музыка выключена: включается только кнопкой «Звук», как и раньше.

   Кнопка: любой элемент с id="ambient-toggle" (внутри — id="ambient-label"). Громкость: VSAudio.setVolume(0…1). */
(function () {
  'use strict';
  if (window.VSAudio) return;

  var script = document.currentScript;
  var ROOT = script && script.src ? new URL('./', script.src).href : location.href;
  var MUSIC = ROOT + 'music.mp3';
  var KEY = 'vs:audio:v1', OWNER = 'vs:audio:owner';
  var DEFAULT_VOLUME = 0.24;
  var TAB = Math.random().toString(36).slice(2);

  /* Нативные методы сохраняем сразу: nav.js позже подменяет addEventListener, чтобы чистить слушатели страниц. */
  var docOn = document.addEventListener.bind(document);
  var winOn = window.addEventListener.bind(window);

  /* ---------- хранилище (с запасным вариантом в памяти) ---------- */
  var mem = {};
  function read(k) {
    try { var v = localStorage.getItem(k); return v === null ? (mem[k] === undefined ? null : mem[k]) : v; }
    catch (e) { return mem[k] === undefined ? null : mem[k]; }
  }
  function write(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }
  var S = { on: false, t: 0, at: 0, vol: DEFAULT_VOLUME };
  try { var saved = JSON.parse(read(KEY)); if (saved && typeof saved === 'object') { S.on = saved.on === true; S.t = +saved.t || 0; S.at = +saved.at || 0; S.vol = saved.vol >= 0 && saved.vol <= 1 ? +saved.vol : DEFAULT_VOLUME; } } catch (e) {}

  /* ---------- единственный плеер ---------- */
  var audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  audio.setAttribute('playsinline', '');
  audio.volume = S.vol;
  audio.src = MUSIC;

  var wantOn = false;      // музыка должна играть (желание пользователя)
  var failed = false;      // файл не загрузился
  var leaving = false;     // страница выгружается: паузу браузера не считаем решением пользователя
  var seekTo = null;       // позиция, к которой нужно перемотать после загрузки метаданных
  var unlockedAt = 0;
  var lastSave = 0;
  var unlockBound = false;

  function save() {
    S.on = wantOn; S.t = audio.currentTime || 0; S.at = Date.now(); S.vol = audio.volume;
    write(KEY, JSON.stringify(S));
  }

  /* ---------- интерфейс кнопок ---------- */
  function ui() {
    var playing = wantOn && !audio.paused;
    var pending = wantOn && audio.paused && !failed;
    var text = failed ? 'Нет звука' : (wantOn ? 'Звук ON' : 'Звук OFF');
    var title = failed ? 'Не удалось загрузить музыку'
      : pending ? 'Нажмите в любом месте страницы, чтобы продолжить музыку'
      : wantOn ? 'Выключить атмосферный звук' : 'Включить атмосферный звук';
    var btns = document.querySelectorAll('#ambient-toggle');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.setAttribute('aria-pressed', wantOn && !failed ? 'true' : 'false');
      b.title = title;
      if (pending) b.setAttribute('data-pending', ''); else b.removeAttribute('data-pending');
      var l = b.querySelector('#ambient-label'); if (l) l.textContent = text;
    }
    return playing;
  }

  /* ---------- позиция ---------- */
  function normalize(t) {
    var d = audio.duration;
    if (isFinite(d) && d > 0) t = ((t % d) + d) % d;
    return t < 0 ? 0 : t;
  }
  function applySeek() {
    if (seekTo === null) return;
    try { audio.currentTime = normalize(seekTo); seekTo = null; } catch (e) { /* метаданных ещё нет — применим позже */ }
  }
  audio.addEventListener('loadedmetadata', applySeek);

  /* ---------- запуск ---------- */
  function ownTab() { write(OWNER, TAB + ':' + Date.now()); }
  function play() {
    var p;
    applySeek();
    try { p = audio.play(); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(function () {
      failed = false; ownTab(); removeUnlock(); ui(); save();
      return true;
    }, function (err) {
      if (err && err.name === 'NotSupportedError') { failed = true; }
      else if (wantOn) addUnlock();             // автозапуск запрещён — ждём жеста пользователя
      ui();
      return false;
    });
  }

  function unlock(e) {
    if (!wantOn || !audio.paused || failed) return;
    unlockedAt = Date.now();
    play();
  }
  function addUnlock() {
    if (unlockBound) return; unlockBound = true;
    ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (t) { docOn(t, unlock, { capture: true, passive: true }); });
  }
  function removeUnlock() {
    if (!unlockBound) return; unlockBound = false;
    ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (t) { document.removeEventListener(t, unlock, { capture: true }); });
  }

  function turnOn() { wantOn = true; audio.preload = 'auto'; ui(); return play(); }
  function turnOff() { wantOn = false; removeUnlock(); audio.pause(); ui(); save(); }

  /* ---------- события плеера ---------- */
  audio.addEventListener('playing', function () { failed = false; ui(); });
  audio.addEventListener('pause', function () {
    if (leaving) return;
    if (wantOn && !seekTo) { wantOn = false; save(); }   // пауза извне (система, наушники, экран блокировки) = пользователь остановил музыку
    ui();
  });
  audio.addEventListener('error', function () { if (wantOn) { failed = true; ui(); } });
  audio.addEventListener('timeupdate', function () {
    var n = Date.now();
    if (n - lastSave > 2000) { lastSave = n; save(); }
  });

  /* ---------- кнопка «Звук» (делегирование: работает и после смены разделов) ---------- */
  docOn('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#ambient-toggle') : null;
    if (!b) return;
    e.preventDefault();
    if (Date.now() - unlockedAt < 600) return;           // этот же клик уже запустил музыку как «первый жест»
    if (wantOn && !audio.paused) turnOff(); else turnOn();
  });

  /* ---------- жизненный цикл страницы ---------- */
  winOn('pagehide', function () { leaving = true; save(); });
  winOn('beforeunload', function () { leaving = true; save(); });
  winOn('pageshow', function (e) { leaving = false; if (e.persisted) { ui(); if (wantOn && audio.paused) play(); } });
  docOn('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });
  docOn('DOMContentLoaded', ui);

  /* Музыка только в одной вкладке: если включили в другой — здесь останавливаем. */
  winOn('storage', function (e) {
    if (e.key !== OWNER || !e.newValue) return;
    if (e.newValue.split(':')[0] !== TAB && wantOn && !audio.paused) { wantOn = false; audio.pause(); ui(); }
  });

  /* ---------- экран блокировки / системные кнопки ---------- */
  try {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: 'Let It Snow, Let It Snow, Let It Snow', artist: 'Dean Martin', album: 'Winter Classics' });
      navigator.mediaSession.setActionHandler('play', function () { turnOn(); });
      navigator.mediaSession.setActionHandler('pause', function () { turnOff(); });
    }
  } catch (e) {}

  /* ---------- продолжение после загрузки страницы ---------- */
  if (S.on) {
    wantOn = true;
    audio.preload = 'auto';
    var gap = Date.now() - S.at;
    seekTo = S.t + (gap >= 0 && gap < 15000 ? gap / 1000 : 0);   // компенсируем время загрузки страницы
    applySeek();
    play();
  }

  window.VSAudio = {
    el: audio,
    refresh: ui,
    toggle: function () { if (wantOn && !audio.paused) turnOff(); else turnOn(); },
    setVolume: function (v) { v = Math.max(0, Math.min(1, +v)); audio.volume = v; save(); },
    state: function () { return { on: wantOn, paused: audio.paused, time: audio.currentTime, volume: audio.volume, failed: failed }; }
  };
})();
