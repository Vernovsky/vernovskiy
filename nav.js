/* VERNOVSKIY — плавные переходы между разделами.
   Зачем: при обычном переходе по ссылке браузер выгружает страницу вместе с плеером, и музыка прерывается
   (на iPhone после этого ещё и требуется новое касание). Здесь внутренние ссылки между страницами сайта
   подгружают следующую страницу в фоне и заменяют содержимое, а единый плеер из audio.js продолжает играть.

   Безопасность: если что-то идёт не так (нет сети, нестандартная страница), выполняется обычный переход по ссылке.
   Подключается вторым, сразу после audio.js и до остальных скриптов страницы. */
(function () {
  'use strict';
  if (window.VSNav) return;

  var script = document.currentScript;
  var ROOT = script && script.src ? new URL('./', script.src).href : location.origin + '/';
  var natDocAdd = document.addEventListener.bind(document);
  var natWinAdd = window.addEventListener.bind(window);
  var natDocRem = document.removeEventListener.bind(document);
  var natWinRem = window.removeEventListener.bind(window);
  var natSetInterval = window.setInterval.bind(window);
  var natClearInterval = window.clearInterval.bind(window);

  /* ---------- учёт того, что создаёт сама страница, чтобы при уходе с неё ничего не оставалось работать ---------- */
  var tracked = [];       // слушатели window/document
  var intervals = [];     // setInterval
  function trackListeners(target, nativeAdd) {
    target.addEventListener = function (type, fn, opts) {
      tracked.push([target, type, fn, opts]);
      return nativeAdd(type, fn, opts);
    };
  }
  trackListeners(window, natWinAdd);
  trackListeners(document, natDocAdd);
  window.setInterval = function () {
    var id = natSetInterval.apply(window, arguments);
    intervals.push(id);
    return id;
  };
  function teardown() {
    tracked.forEach(function (t) { (t[0] === window ? natWinRem : natDocRem)(t[1], t[2], t[3]); });
    tracked = [];
    intervals.forEach(function (id) { natClearInterval(id); });
    intervals = [];
  }

  /* ---------- какие ссылки обрабатываем ---------- */
  var rootPath = new URL(ROOT).pathname;
  function targetOf(a, e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    if (a.target && a.target !== '_self') return null;
    if (a.hasAttribute('download')) return null;
    var raw = a.getAttribute('href');
    if (!raw) return null;
    var u;
    try { u = new URL(raw, location.href); } catch (err) { return null; }
    if (u.origin !== location.origin) return null;
    if (u.pathname.indexOf(rootPath) !== 0) return null;
    if (!/\/$|\.html$/.test(u.pathname)) return null;
    if (u.pathname === location.pathname) return null;  // та же страница: обычное поведение (якоря и т. п.)
    return u;
  }

  /* ---------- загрузка и подмена страницы ---------- */
  var token = 0;
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var FONTS = /fonts\.googleapis\.com/;

  function fetchPage(u) {
    return fetch(u.href, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc.body || !doc.querySelector('script[src$="audio.js"]')) throw new Error('not a site page');
      if (Array.prototype.some.call(doc.querySelectorAll('script:not([src])'), function (s) { return s.textContent.trim(); })) throw new Error('inline script');
      return doc;
    });
  }

  function go(u, push, restoreY) {
    var my = ++token;
    return fetchPage(u).then(function (doc) {
      if (my !== token) return;
      /* 1. стили новой страницы грузим «выключенными» (media=print), чтобы текущая страница не меняла вид раньше времени */
      var wanted = Array.prototype.map.call(doc.querySelectorAll('link[rel="stylesheet"]'), function (l) { return new URL(l.getAttribute('href'), u.href).href; });
      var have = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
      var haveHref = have.map(function (l) { return l.href; });
      var added = [], waits = [];
      wanted.forEach(function (href) {
        if (haveHref.indexOf(href) !== -1) return;
        var l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href; l.media = 'print';
        /* порядок подключения — как в новой странице: вставляем ПЕРЕД ближайшим следующим уже имеющимся общим стилем
           (иначе стили страницы окажутся после общего violet.css и перебьют его) */
        var ref = null;
        for (var wi = wanted.indexOf(href) + 1; wi < wanted.length && !ref; wi++) { var hi = haveHref.indexOf(wanted[wi]); if (hi !== -1) ref = have[hi]; }
        if (ref) document.head.insertBefore(l, ref); else document.head.appendChild(l);
        added.push(l);
        if (!FONTS.test(href)) waits.push(new Promise(function (r) { l.onload = l.onerror = r; }));
      });
      var scripts = Array.prototype.map.call(doc.querySelectorAll('script[src]'), function (s) { return new URL(s.getAttribute('src'), u.href).href; })
        .filter(function (src) { return !/\/(audio|nav)\.js(\?.*)?$/.test(src); });
      return Promise.race([Promise.all(waits), delay(5000)]).then(function () {
        if (my !== token) { added.forEach(function (l) { l.remove(); }); return; }

        /* 2. подмена */
        if (push) { try { history.pushState({ vs: 1, y: 0 }, '', u.href); } catch (e) { location.href = u.href; return; } }
        teardown();
        document.title = doc.title;
        var md = document.querySelector('meta[name="description"]'), nd = doc.querySelector('meta[name="description"]');
        if (md && nd) md.setAttribute('content', nd.getAttribute('content') || '');
        /* haveHref посчитан ДО pushState: после смены адреса относительные href старой страницы пересчитываются от нового адреса
           (atmosphere.css → /news/atmosphere.css), и общие стили ошибочно считались бы лишними */
        have.forEach(function (l, i) { if (wanted.indexOf(haveHref[i]) === -1 && !FONTS.test(haveHref[i])) l.remove(); });
        added.forEach(function (l) { l.media = 'all'; });
        var frag = document.createDocumentFragment();
        Array.prototype.forEach.call(doc.body.childNodes, function (n) {
          if (n.nodeName === 'SCRIPT') return;
          frag.appendChild(document.importNode(n, true));
        });
        document.body.className = doc.body.className;
        document.body.replaceChildren(frag);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (window.VSAudio) window.VSAudio.refresh();     // кнопка «Звук» сразу показывает верное состояние

        /* 3. скрипты новой страницы по порядку */
        return scripts.reduce(function (p, src) {
          return p.then(function () {
            if (my !== token) return;
            return new Promise(function (res) {
              var s = document.createElement('script');
              s.src = src; s.async = false;
              s.onload = s.onerror = function () { s.remove(); res(); };
              document.body.appendChild(s);
            });
          });
        }, Promise.resolve()).then(function () {
          if (my !== token) return;
          if (window.VSAudio) window.VSAudio.refresh();
          if (restoreY) window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' });
          else if (u.hash) { var t = document.getElementById(decodeURIComponent(u.hash.slice(1))); if (t) t.scrollIntoView(); }
          var main = document.querySelector('main');
          if (main) { main.setAttribute('tabindex', '-1'); main.style.outline = 'none'; main.focus({ preventScroll: true }); }
          window.dispatchEvent(new CustomEvent('vs:navigated', { detail: { url: u.href } }));
        });
      });
    }).catch(function () {
      if (my === token) location.href = u.href;     // запасной вариант: обычный переход
    });
  }

  natDocAdd('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var u = targetOf(a, e);
    if (!u) return;
    e.preventDefault();
    try { history.replaceState({ vs: 1, y: window.scrollY }, ''); } catch (err) {}   // запоминаем прокрутку страницы, с которой уходим
    go(u, true);
  });

  var currentPath = location.pathname;
  natWinAdd('popstate', function () {
    if (location.pathname === currentPath) return;      // смена якоря на той же странице
    var y = history.state && history.state.y;
    go(new URL(location.href), false, y || 0);
  });
  natWinAdd('vs:navigated', function () { currentPath = location.pathname; });

  window.VSNav = { go: function (url) { return go(new URL(url, location.href), true); } };
})();
