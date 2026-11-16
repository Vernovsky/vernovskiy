/* VERNOVSKIY — «Ночной сад»: звёзды, сакура, лепестки и Несса.
   Подключается в <head> каждой страницы сразу после nav.js. Слои живут в <html>, поэтому плавные переходы
   между разделами их не трогают. Повторный запуск (nav.js догружает скрипты страниц) безопасен.

   Осторожно с nav.js: он подменяет window/document.addEventListener и setInterval, чтобы «чистить» страницу при переходе.
   Поэтому здесь нет глобальных слушателей и setInterval — только setTimeout и слушатели на своих элементах. */
(function () {
  'use strict';
  if (window.VSAtmo) return;

  var script = document.currentScript;
  var BASE = script && script.src ? new URL('./', script.src).href : '';
  var NS = 'http://www.w3.org/2000/svg';
  var doc = document, root = doc.documentElement;
  var rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var reduced = rm.matches;
  var small = window.matchMedia ? window.matchMedia('(max-width: 720px)').matches : false;
  var rand = Math.random;
  var between = function (a, b) { return a + rand() * (b - a); };

  function el(tag, cls, ns) {
    var e = ns ? doc.createElementNS(NS, tag) : doc.createElement(tag);
    if (cls) e.setAttribute('class', cls);
    return e;
  }
  function seeded(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ================= звёзды ================= */
  function starTile(r, n, size, rMin, rMax, glow) {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">';
    if (glow) s += '<defs><radialGradient id="g"><stop offset="0" stop-color="#cdb8ff" stop-opacity=".55"/><stop offset="1" stop-color="#cdb8ff" stop-opacity="0"/></radialGradient></defs>';
    var cols = ['#ffffff', '#efe6ff', '#d3c0ff', '#ffffff', '#c4adff'];
    for (var i = 0; i < n; i++) {
      var x = (r() * size).toFixed(1), y = (r() * size).toFixed(1), rad = rMin + r() * (rMax - rMin);
      var op = (0.45 + r() * 0.55).toFixed(2), c = cols[(r() * cols.length) | 0];
      if (glow) s += '<circle cx="' + x + '" cy="' + y + '" r="' + (rad * 4.2).toFixed(1) + '" fill="url(#g)" opacity="' + (op * 0.6).toFixed(2) + '"/>';
      s += '<circle cx="' + x + '" cy="' + y + '" r="' + rad.toFixed(2) + '" fill="' + c + '" opacity="' + op + '"/>';
    }
    return 'url("data:image/svg+xml,' + encodeURIComponent(s + '</svg>') + '")';
  }

  function buildStars(bg) {
    var wrap = el('div', 'vsa-stars');
    var k = small ? 0.6 : 1;
    var tiles = [
      ['s1', 70, 640, 0.5, 0.9, false], ['s2', 70, 700, 0.5, 0.9, false],
      ['s3', 34, 880, 0.9, 1.3, false], ['s4', 34, 940, 0.9, 1.3, false],
      ['s5', 16, 1180, 1.3, 1.8, true], ['s6', 16, 1260, 1.3, 1.8, true]
    ];
    tiles.forEach(function (t, i) {
      var r = seeded(1000 + i * 97), layer = el('div', 'vsa-sl ' + t[0]);
      var n = Math.max(6, Math.round(t[1] * k));
      layer.style.backgroundImage = starTile(r, n, t[2], t[3], t[4], t[5]);
      layer.style.backgroundSize = t[2] + 'px ' + t[2] + 'px';
      layer.style.backgroundPosition = ((r() * 300) | 0) + 'px ' + ((r() * 300) | 0) + 'px';
      wrap.appendChild(layer);
    });
    /* яркие четырёхлучевые звёзды */
    var count = small ? 7 : 13, r2 = seeded(777);
    for (var i = 0; i < count; i++) {
      var sp = el('i', 'vsa-sp' + (i % 4 === 1 ? ' flare' : ''));
      sp.style.left = (4 + r2() * 92).toFixed(1) + '%';
      sp.style.top = (3 + r2() * 90).toFixed(1) + '%';
      sp.style.setProperty('--z', (11 + r2() * 15).toFixed(0) + 'px');
      sp.style.setProperty('--d', (4.5 + r2() * 5.5).toFixed(1) + 's');
      sp.style.setProperty('--dl', '-' + (r2() * 10).toFixed(1) + 's');
      if (sp.className.indexOf('flare') > -1) sp.style.setProperty('--d', (9 + r2() * 6).toFixed(1) + 's');
      wrap.appendChild(sp);
    }
    bg.appendChild(wrap);
  }

  /* ================= сакура ================= */
  function petalPath() {
    var d = '', i, a;
    for (i = 0; i < 5; i++) {
      a = i * 72;
      d += '<path transform="rotate(' + a + ')" d="M0 0C-8-4-10.5-14-3.4-17.4Q0-15 3.4-17.4C10.5-14 8-4 0 0Z"/>';
    }
    return d;
  }

  function defsSVG() {
    var svg = el('svg', '', true);
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svg.setAttribute('aria-hidden', 'true');
    var variants = [
      ['vsa-b1', '#fff3fc', '#f0b2ee', '#b985ff'],
      ['vsa-b2', '#f6ecff', '#d2adff', '#9d7cf5'],
      ['vsa-b3', '#ffe8f8', '#f19ae6', '#c07aff']
    ];
    var s = '<defs>';
    variants.forEach(function (v) {
      s += '<radialGradient id="' + v[0] + 'g" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="' + v[1] + '"/><stop offset=".55" stop-color="' + v[2] + '"/><stop offset="1" stop-color="' + v[3] + '"/></radialGradient>';
      s += '<g id="' + v[0] + '"><g fill="url(#' + v[0] + 'g)" stroke="rgba(255,255,255,.35)" stroke-width=".5">' + petalPath() + '</g><circle r="2.6" fill="#7a3fc8"/><circle r="1.1" fill="#ffd9ff"/></g>';
    });
    s += '</defs>';
    svg.innerHTML = s;
    return svg;
  }

  /* Одна ветка: рекурсивные веточки, цветы и листья. Верхние уровни качаются (CSS-анимация .vsa-sw). */
  function branchSVG(seed, flip) {
    var r = seeded(seed), W = 520, H = 640, out = '';
    var maxBlossom = small ? 24 : 58, nb = 0;

    function cubic(p0, c1, c2, p1, t) {
      var u = 1 - t;
      return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
              u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]];
    }
    function deriv(p0, c1, c2, p1, t) {
      var u = 1 - t;
      return [3 * u * u * (c1[0] - p0[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (p1[0] - c2[0]),
              3 * u * u * (c1[1] - p0[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (p1[1] - c2[1])];
    }
    function blossom(x, y, size) {
      if (nb >= maxBlossom) return '';
      nb++;
      var v = 'vsa-b' + (1 + ((r() * 3) | 0));
      return '<use href="#' + v + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + ((r() * 360) | 0) + ') scale(' + (size / 17).toFixed(2) + ')"/>';
    }
    function leaf(x, y, ang, size) {
      var c = r() < 0.5 ? '#6d45c4' : '#8a63de';
      return '<path transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + ang.toFixed(0) + ') scale(' + (size / 10).toFixed(2) + ')" d="M0 0C3-3 8-3 11 0 8 3 3 3 0 0Z" fill="' + c + '" opacity=".92"/>';
    }

    function limb(x, y, ang, len, wid, depth, lvl) {
      var bend = (r() - 0.5) * 0.9, a1 = ang + bend;
      var p0 = [x, y], p1 = [x + Math.cos(a1) * len, y + Math.sin(a1) * len];
      var c1 = [x + Math.cos(ang) * len * 0.4, y + Math.sin(ang) * len * 0.4];
      var c2 = [p1[0] - Math.cos(a1) * len * 0.4, p1[1] - Math.sin(a1) * len * 0.4];
      var d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'C' + c1.map(function (v) { return v.toFixed(1); }).join(' ') + ' ' + c2.map(function (v) { return v.toFixed(1); }).join(' ') + ' ' + p1.map(function (v) { return v.toFixed(1); }).join(' ');
      var s = '<path class="vsa-bk" stroke-width="' + wid.toFixed(1) + '" d="' + d + '"/>';
      if (wid > 4) s += '<path class="vsa-bh" stroke-width="1" transform="translate(-' + (wid * 0.18).toFixed(1) + ' -' + (wid * 0.18).toFixed(1) + ')" d="' + d + '"/>';

      if (depth > 0) {
        var ts = [0.3, 0.5, 0.7, 0.88], side = r() < 0.5 ? 1 : -1, made = 0;
        for (var i = 0; i < ts.length; i++) {
          if (made >= 3 || r() < 0.28) continue;
          var t = ts[i], p = cubic(p0, c1, c2, p1, t), dv = deriv(p0, c1, c2, p1, t);
          var ta = Math.atan2(dv[1], dv[0]);
          s += limb(p[0], p[1], ta + side * (0.5 + r() * 0.6), len * (0.42 + r() * 0.26), Math.max(1.3, wid * 0.58), depth - 1, lvl + 1);
          side = -side; made++;
        }
      }
      /* цветы вдоль ветки и на конце */
      var tipN = depth === 0 ? 2 + ((r() * 2) | 0) : 1 + (r() < 0.5 ? 1 : 0);
      for (var k = 0; k < tipN; k++) {
        s += blossom(p1[0] + (r() - 0.5) * 18, p1[1] + (r() - 0.5) * 18, 16 + r() * 12);
      }
      if (len > 30) {   /* цветки вдоль всей ветви, а не только на концах */
        var ats = [0.3, 0.5, 0.68, 0.84];
        for (var q = 0; q < ats.length; q++) {
          if (r() < 0.5) {
            var tp = cubic(p0, c1, c2, p1, ats[q] + (r() - 0.5) * 0.08);
            s += blossom(tp[0] + (r() - 0.5) * 16, tp[1] + (r() - 0.5) * 16, 15 + r() * 12);
          }
        }
      }
      if (r() < 0.65) {
        var lp = cubic(p0, c1, c2, p1, 0.4 + r() * 0.5);
        s += leaf(lp[0], lp[1], (r() * 360), 10 + r() * 7);
      }
      if (depth === 0 && r() < 0.8) { /* бутон */
        s += '<ellipse cx="' + (p1[0] + 3).toFixed(1) + '" cy="' + (p1[1] + 4).toFixed(1) + '" rx="3" ry="4.2" fill="#e28df0" transform="rotate(' + ((r() * 80) | 0) + ' ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ')"/>';
      }

      /* качание: только крупные верхние ветки */
      if (lvl <= 1 && len > 60) {
        var amp = [0.9, 1.9, 2.8][lvl], dur = between(5.5, 9.5) - lvl * 0.9;
        s = '<g class="vsa-sw" style="--o:' + x.toFixed(0) + 'px ' + y.toFixed(0) + 'px;--a:' + amp + 'deg;--d:' + dur.toFixed(1) + 's;--dl:-' + (r() * 8).toFixed(1) + 's">' + s + '</g>';
      }
      return s;
    }

    nb = 0; out += limb(-30, 34, 0.16, 400, 11, 4, 0);        /* верхняя ветка */
    nb = 0; out += limb(-30, 56, 1.28, 430, 9.5, 3, 0);       /* ветка, спускающаяся вдоль края */
    nb = 0; if (!small) out += limb(-30, 250, 0.34, 210, 6, 2, 0);   /* нижний отросток */

    var g = flip ? '<g transform="translate(' + W + ' 0) scale(-1 1)">' + out + '</g>' : out;
    var svg = el('svg', '', true);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = g;
    return svg;
  }

  /* ================= падающие лепестки и листья ================= */
  function placePetal(p, first) {
    var m = p.firstChild, i = m.firstChild, side = rand(), x, dx;
    if (side < 0.44) { x = between(1, 20); dx = between(-4, 16); }            /* от левой ветки */
    else if (side < 0.88) { x = between(80, 99); dx = between(-18, 4); }       /* от правой ветки */
    else { x = between(12, 88); dx = between(-10, 10); }                       /* унесённые ветром */
    var y = between(4, 38);                                                    /* высота «отрыва» — там, где ветки */
    var kind = i.__kind, size = kind === 'lf' ? between(13, 22) : between(11, 25);
    p.style.setProperty('--x', x.toFixed(1) + 'vw');
    p.style.setProperty('--y', y.toFixed(1) + 'vh');
    p.style.setProperty('--dx', dx.toFixed(1) + 'vw');
    p.style.setProperty('--fall', (112 - y).toFixed(1) + 'vh');
    p.style.setProperty('--o', between(0.55, 0.92).toFixed(2));
    p.style.setProperty('--s', size.toFixed(1) + 'px');
    if (first) {
      var dur = Math.max(13, 34 - size * 0.9 + between(-3, 5));
      p.style.setProperty('--dur', dur.toFixed(1) + 's');
      p.style.setProperty('--dl', (rand() < 0.65 ? -between(0, dur) : between(0.5, 9)).toFixed(1) + 's');
      p.style.setProperty('--amp', between(14, 46).toFixed(0) + 'px');
      p.style.setProperty('--sw', between(3.6, 7.2).toFixed(1) + 's');
      p.style.setProperty('--sd', '-' + between(0, 6).toFixed(1) + 's');
      p.style.setProperty('--fl', between(2.4, 5).toFixed(1) + 's');
      p.style.setProperty('--r0', Math.round(between(-40, 20)) + 'deg');
      p.style.setProperty('--r1', Math.round(between(60, 200)) + 'deg');   /* часть лепестков заметно вращается, часть едва */
      p.style.setProperty('--tilt', Math.round(between(10, 70)) + 'deg');
      if (rand() < 0.35) { p.style.setProperty('--r0', Math.round(between(-12, 0)) + 'deg'); p.style.setProperty('--r1', Math.round(between(0, 22)) + 'deg'); }
    }
  }
  function buildPetals(layer) {
    var n = small ? 9 : 16, kinds = ['pa', 'pb', 'pc', 'pa', 'pb', 'lf', 'lf', 'pc'];
    for (var k = 0; k < n; k++) {
      var p = el('span', 'vsa-p'), m = el('span', 'vsa-pm'), kind = kinds[k % kinds.length], i = el('i', 'vsa-pi ' + kind);
      i.__kind = kind;
      m.appendChild(i); p.appendChild(m); layer.appendChild(p);
      placePetal(p, true);
    }
    /* каждый круг падения начинается с новой ветки/высоты — траектории не повторяются */
    layer.addEventListener('animationiteration', function (e) {
      if (e.animationName === 'vsa-fall' && e.target && e.target.classList.contains('vsa-p')) placePetal(e.target, false);
    });
  }

  /* ================= Несса ================= */
  function buildNessa(fg) {
    var box = el('div', 'vsa-nessa');
    box.innerHTML = '<span class="vsa-ring"></span><img alt="" decoding="async" draggable="false"><i class="vsa-ns n1"></i><i class="vsa-ns n2"></i><i class="vsa-ns n3"></i><i class="vsa-ns n4"></i>';
    var img = box.querySelector('img'), ready = false, timer = 0;
    img.onload = function () { ready = true; };
    img.src = BASE + 'nessa.webp';
    fg.appendChild(box);

    var VISIBLE = 12500, tries = 0;
    var SEL = 'a[href],button,input,select,textarea,h1,h2,h3,h4,p,summary,label,.film-title,.day-cell,.holiday-item,.qz-q,.msg';
    var SPOTS = [['', 1], ['side-r', 1], ['', 0.72], ['side-r', 0.72]];   /* угол × размер */

    /* Площадь, которую Несса закрыла бы из текста и интерактивных элементов, если встанет в этот угол с этим масштабом. */
    function overlap(side, k) {
      box.classList.toggle('side-r', side === 'side-r');
      box.style.setProperty('--k', k);
      var w = box.offsetWidth, h = w * 674 / 960, vw = doc.documentElement.clientWidth, vh = window.innerHeight;
      var x0 = side === 'side-r' ? vw - w : 0, y0 = vh - h, x1 = x0 + w, y1 = vh, sum = 0;
      var nodes = doc.querySelectorAll(SEL);
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < y0 || r.top > y1 || r.right < x0 || r.left > x1) continue;
        if (nodes[i].tagName === 'A' && r.width * r.height > 40000) continue;   /* карточка-ссылка целиком: считаем её текст отдельно */
        var ox = Math.min(r.right, x1) - Math.max(r.left, x0), oy = Math.min(r.bottom, y1) - Math.max(r.top, y0);
        if (ox > 0 && oy > 0) sum += ox * oy;
      }
      return sum / (w * h);
    }
    function pickSpot() {
      var best = null;
      for (var i = 0; i < SPOTS.length; i++) {
        var sc = overlap(SPOTS[i][0], SPOTS[i][1]);
        if (!best || sc < best.sc) best = { side: SPOTS[i][0], k: SPOTS[i][1], sc: sc };
        if (sc < 0.06) break;                      /* свободное место найдено */
      }
      return best;
    }

    function schedule(ms) { clearTimeout(timer); timer = setTimeout(show, ms); }
    function show() {
      if (!ready || doc.hidden) { schedule(3000); return; }
      var spot = pickSpot();
      /* Место закрыто текстом — подождём (человек прокрутит страницу), но не дольше 3 попыток: тогда выберем наименее занятое. */
      if (spot.sc > 0.12 && tries < 3) { tries++; schedule(6000); box.classList.remove('side-r'); return; }
      tries = 0;
      box.classList.toggle('side-r', spot.side === 'side-r');
      box.style.setProperty('--k', spot.k);
      box.classList.add('is-on');
      timer = setTimeout(hide, VISIBLE);
    }
    function hide() {
      box.classList.remove('is-on');
      schedule(between(38000, 70000));           /* пауза между появлениями */
    }
    schedule(4500);                               /* первое появление — вскоре после загрузки */
    /* Вкладка скрыта — показ откладывается (doc.hidden проверяется в show), глобальных слушателей нет. */
    return box;
  }

  /* ================= сборка ================= */
  function mount() {
    if (doc.getElementById('vsa-bg')) return;
    var bg = el('div', 'vsa-bg'), fg = el('div', 'vsa-fg');
    bg.id = 'vsa-bg'; fg.id = 'vsa-fg';
    bg.setAttribute('aria-hidden', 'true'); fg.setAttribute('aria-hidden', 'true');

    bg.appendChild(el('div', 'vsa-sky'));
    ['g1', 'g2', 'g3'].forEach(function (c) { bg.appendChild(el('div', 'vsa-glow ' + c)); });
    buildStars(bg);

    bg.appendChild(defsSVG());
    var bl = el('div', 'vsa-branch l'), br = el('div', 'vsa-branch r');
    bl.appendChild(branchSVG(41, false));
    br.appendChild(branchSVG(2718, true));
    bg.appendChild(bl); bg.appendChild(br);

    if (!reduced) {
      var layer = el('div', 'vsa-petals');
      fg.appendChild(layer);
      buildPetals(layer);
    }
    buildNessa(fg);

    root.appendChild(bg);
    root.appendChild(fg);
  }

  window.VSAtmo = { mounted: true };
  mount();
})();
