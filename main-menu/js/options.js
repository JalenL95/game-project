/* =====================================================================
   COSA NOSTRA — OPTIONS SCREEN
   Opens from the main menu's "Options" button. A case file on a desk:
   the lamp flickers now and then, the cigarette in the ashtray smoulders
   and smoke curls up from it. The menu music keeps playing.

   Settings it controls:
     Audio volume  -> CosaMenu.setSfxVolume   (button sounds etc.)
     Music volume  -> CosaMenu.setMusicVolume
     Subtitles     -> CosaOptions.get().subtitles   (true / false)
     Display       -> CosaOptions.get().display     ("4:3" / "16:9")
   Listen for changes:  CosaOptions.onChange((settings) => { ... })
   ===================================================================== */
(function () {
  "use strict";

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const STORE_KEY = "cosamenu.options";
  const menu = window.CosaMenu;
  if (!menu) return;

  const cfg = Object.assign({
    title: "Options",
    background: "assets/options/desk.jpg",
    labels: {
      audio: "Audio Volume",
      music: "Music Volume",
      subtitles: "Subtitles",
      display: "Display",
      controller: "Controller Setup",
      save: "Save & Exit"
    },
    volumeStep: 0.05,
    controllerToast: "Coming soon",
    lamp: { x: 1088, y: 120 },          // desk lamp bulb (stage coordinates)
    cigarette: { x: 1113, y: 508 },     // where smoke leaves the cigarette
    ember: { x: 1120, y: 515 },         // glowing tip
    paintedSmoke: { x: 1040, y: 300, w: 100, h: 200 }
  }, (window.MENU_CONFIG && window.MENU_CONFIG.options) || {});
  cfg.labels = Object.assign({
    audio: "Audio Volume", music: "Music Volume", subtitles: "Subtitles",
    display: "Display", controller: "Controller Setup", save: "Save & Exit"
  }, cfg.labels);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- stored settings ---------------- */
  const settings = { subtitles: true, display: "16:9" };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved) {
      if (typeof saved.subtitles === "boolean") settings.subtitles = saved.subtitles;
      if (saved.display === "4:3" || saved.display === "16:9") settings.display = saved.display;
    }
  } catch (e) { /* storage blocked: defaults */ }
  const listeners = [];
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }
  function changed() {
    const snapshot = api.get();
    for (const fn of listeners) {
      try { fn(snapshot); } catch (e) { console.error(e); }
    }
    window.dispatchEvent(new CustomEvent("cosaoptions:change", { detail: snapshot }));
  }

  /* =================================================================
     DOM
     ================================================================= */
  const layout = {
    // row top (stage px relative to the paper sheet); matches the concept art
    audio: 90, music: 158, subtitles: 226, display: 272, controller: 318, save: 364
  };
  const rows = [
    { id: "audio", kind: "volume" },
    { id: "music", kind: "volume" },
    { id: "subtitles", kind: "toggle", choices: [["on", true], ["off", false]] },
    { id: "display", kind: "toggle", choices: [["4:3", "4:3"], ["16:9", "16:9"]] },
    { id: "controller", kind: "action" },
    { id: "save", kind: "action", centered: true }
  ];

  let root, sheet, canvas, ctx, shade, plaque, titleEl, underline, stamp;
  const el = {};

  function build() {
    root = document.createElement("div");
    root.className = "options";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", cfg.title);

    canvas = document.createElement("canvas");
    canvas.className = "opt-scene";
    ctx = canvas.getContext("2d");

    sheet = document.createElement("div");
    sheet.className = "opt-sheet";

    titleEl = document.createElement("h2");
    titleEl.className = "opt-title";
    const t = String(cfg.title).toUpperCase();
    titleEl.innerHTML = `<span class="cap"></span><span class="rest"></span>`;
    titleEl.querySelector(".cap").textContent = t.charAt(0);
    titleEl.querySelector(".rest").textContent = t.slice(1);

    underline = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    underline.setAttribute("class", "opt-underline");
    underline.setAttribute("viewBox", "0 0 210 14");
    // a marker stroke: thin at both ends, heavier in the middle
    underline.innerHTML = '<path d="M1 10 C 40 6.5, 110 4, 170 4.6 C 190 4.8, 202 5.6, 209 6.4 C 203 7.6, 190 8, 170 8.2 C 110 8.6, 45 10.5, 3 12.2 C 0.5 12.4, 0 10.6, 1 10 Z" />';

    plaque = document.createElement("div");
    plaque.className = "opt-plaque";
    plaque.innerHTML =
      '<svg class="opt-arrow" viewBox="0 0 34 30" aria-hidden="true">' +
      '<defs><linearGradient id="optArrowFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f6e2a2"/><stop offset="0.5" stop-color="#d1ad5c"/><stop offset="1" stop-color="#8a6a2c"/>' +
      '</linearGradient></defs>' +
      '<path d="M3 2 L31 15 L3 28 L9 15 Z" fill="url(#optArrowFill)" stroke="#6b5122" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M6 5 L26 15" stroke="rgba(255,250,220,0.75)" stroke-width="1.2" stroke-linecap="round"/>' +
      "</svg>";

    stamp = document.createElement("div");
    stamp.className = "opt-stamp";

    sheet.append(titleEl, underline, plaque);

    rows.forEach((row, i) => {
      const r = document.createElement("div");
      r.className = "opt-row" + (row.centered ? " is-centered" : "");
      r.style.top = layout[row.id] + "px";
      r.style.setProperty("--i", i);
      r.dataset.index = i;
      const label = cfg.labels[row.id];
      if (row.kind === "volume") {
        r.innerHTML = '<div class="ink"><span class="label"></span>: <span class="value"></span></div>' +
          '<div class="opt-bar" role="slider" aria-valuemin="0" aria-valuemax="100"><div class="fill"></div></div>';
      } else if (row.kind === "toggle") {
        r.innerHTML = '<div class="ink"><span class="label"></span>: ' +
          row.choices.map((c, k) => `<span class="opt-choice" data-k="${k}">${c[0]}</span>`).join(" / ") + "</div>";
      } else {
        r.innerHTML = '<div class="ink"><span class="label"></span></div>';
      }
      r.querySelector(".label").textContent = label;
      sheet.appendChild(r);
      el[row.id] = r;
      row.el = r;
    });
    sheet.appendChild(stamp);

    shade = document.createElement("div");
    shade.className = "opt-shade";

    const hints = document.createElement("div");
    hints.className = "opt-hints";
    hints.innerHTML = [
      ['<kbd class="key">↑</kbd><kbd class="key">↓</kbd>', "Navigate", ""],
      ['<kbd class="key">←</kbd><kbd class="key">→</kbd>', "Adjust", ""],
      ['<kbd class="key">Enter</kbd>', "Select", "select"],
      ['<kbd class="key">Esc</kbd>', "Back", "back"]
    ].map(([keys, lab, act]) =>
      `<button type="button" class="hint" tabindex="-1" data-action="${act}"><span class="hint-keys">${keys}</span><span class="hint-label">${lab}</span></button>`
    ).join("");
    hints.addEventListener("mousedown", (e) => e.preventDefault());
    hints.addEventListener("click", (e) => {
      const b = e.target.closest(".hint");
      if (!b) return;
      if (b.dataset.action === "select") activate();
      if (b.dataset.action === "back") close();
    });
    el.hints = hints;

    root.append(canvas, sheet, shade, hints);
    menu.stage.appendChild(root);

    // rubber-stamp texture for the "coming soon" stamp
    const g = document.createElement("canvas");
    g.width = 160;
    g.height = 48;
    const gx = g.getContext("2d");
    gx.fillStyle = "#000";
    gx.fillRect(0, 0, 160, 48);
    gx.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 110; i++) {
      gx.globalAlpha = rand(0.15, 0.6);
      gx.beginPath();
      gx.arc(rand(0, 160), rand(0, 48), rand(0.3, 1.1), 0, Math.PI * 2);
      gx.fill();
    }
    document.documentElement.style.setProperty("--stamp-grunge", `url(${g.toDataURL()})`);

    wireInput();
  }

  /* =================================================================
     Values -> DOM
     ================================================================= */
  function volumeOf(id) {
    return id === "audio" ? menu.getSfxVolume() : menu.getMusicVolume();
  }

  function render(popId) {
    for (const id of ["audio", "music"]) {
      const v = Math.round(volumeOf(id) * 100);
      const r = el[id];
      const val = r.querySelector(".value");
      val.textContent = v + "%";
      const fill = r.querySelector(".fill");
      fill.style.width = `calc(${v}% - ${v >= 100 ? 2 : v > 0 ? 1 : 0}px)`;
      fill.classList.toggle("is-full", v >= 100);
      r.querySelector(".opt-bar").setAttribute("aria-valuenow", v);
      if (popId === id) pop(val);
    }
    for (const row of rows) {
      if (row.kind !== "toggle") continue;
      const cur = settings[row.id];
      row.el.querySelectorAll(".opt-choice").forEach((c) => {
        c.classList.toggle("is-on", row.choices[+c.dataset.k][1] === cur);
        if (popId === row.id && row.choices[+c.dataset.k][1] === cur) pop(c);
      });
    }
  }

  function pop(node) {
    node.classList.remove("is-pop");
    void node.offsetWidth;
    node.classList.add("is-pop");
  }

  /* =================================================================
     Selection
     ================================================================= */
  let index = 0;
  let isOpen = false;
  let busy = false;

  function plaqueBox(i) {
    const row = rows[i];
    const top = layout[row.id] - 8;
    const h = row.kind === "volume" ? 64 : 42;
    return { top, h };
  }

  function select(i, sound) {
    i = (i + rows.length) % rows.length;
    const changedRow = i !== index;
    index = i;
    const b = plaqueBox(i);
    plaque.style.transform = `translateY(${b.top}px)`;
    plaque.style.height = b.h + "px";
    rows.forEach((r, k) => r.el.classList.toggle("is-active", k === i));
    if (changedRow) {
      plaque.classList.remove("ignite");
      void plaque.offsetWidth;
      plaque.classList.add("ignite");
      if (sound !== false) menu.sfx("hover");
    }
  }

  function adjust(dir) {
    const row = rows[index];
    if (row.kind === "volume") {
      const step = cfg.volumeStep || 0.05;
      const cur = volumeOf(row.id);
      const next = clamp(Math.round((cur + dir * step) / step) * step, 0, 1);
      if (next === cur) return;
      setVolume(row.id, next);
    } else if (row.kind === "toggle") {
      const k = row.choices.findIndex((c) => c[1] === settings[row.id]);
      const nk = clamp(k + dir, 0, row.choices.length - 1);
      if (nk === k) return;
      settings[row.id] = row.choices[nk][1];
      menu.sfx("hover");
      render(row.id);
      changed();
    }
  }

  function setVolume(id, v) {
    if (id === "audio") menu.setSfxVolume(v);
    else menu.setMusicVolume(v);
    // the click is played at the new level so you hear what you set
    menu.sfx("hover");
    render(id);
    changed();
  }

  async function activate() {
    if (busy || !isOpen) return;
    const row = rows[index];
    if (row.kind === "toggle") {
      const k = row.choices.findIndex((c) => c[1] === settings[row.id]);
      settings[row.id] = row.choices[(k + 1) % row.choices.length][1];
      menu.sfx("select");
      render(row.id);
      changed();
    } else if (row.kind === "volume") {
      // Enter on a bar: jump in bigger steps, wrapping back to 0
      const cur = volumeOf(row.id);
      setVolume(row.id, cur >= 0.999 ? 0 : clamp(Math.round((cur + 0.25) * 4) / 4, 0, 1));
    } else if (row.id === "controller") {
      menu.sfx("select");
      blink();
      const handled = menu.__optionsController && menu.__optionsController();
      if (!handled) stampToast(cfg.controllerToast, layout.controller - 4);
    } else if (row.id === "save") {
      close(true);
    }
  }

  function blink() {
    plaque.classList.remove("blink", "ignite");
    void plaque.offsetWidth;
    plaque.classList.add("blink");
    setTimeout(() => plaque.classList.remove("blink"), 480);
  }

  function stampToast(text, top) {
    stamp.textContent = text;
    stamp.style.top = top + "px";
    stamp.classList.remove("is-down");
    void stamp.offsetWidth;
    stamp.classList.add("is-down");
  }

  /* =================================================================
     Input
     ================================================================= */
  let dragBar = null;

  function wireInput() {
    // keyboard: capture phase so the main menu underneath never sees it
    window.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      e.stopPropagation();
      document.body.classList.add("hide-cursor");
      menu.unlockAudio();
      const k = e.key;
      if (k === "F11" || k === "F12" || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (busy) return;
      if (k === "ArrowUp" || k === "w" || k === "W" || (k === "Tab" && e.shiftKey)) { press("↑"); select(index - 1); }
      else if (k === "ArrowDown" || k === "s" || k === "S" || k === "Tab") { press("↓"); select(index + 1); }
      else if (k === "ArrowLeft" || k === "a" || k === "A") { press("←"); adjust(-1); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { press("→"); adjust(1); }
      else if (k === "Home") select(0);
      else if (k === "End") select(rows.length - 1);
      else if (k === "Enter" || k === " ") { if (!e.repeat) { press("Enter"); activate(); } }
      else if (k === "Escape" || k === "Backspace") { if (!e.repeat) { press("Esc"); close(); } }
    }, true);

    root.addEventListener("pointermove", (e) => {
      document.body.classList.remove("hide-cursor");
      if (busy) return;
      if (dragBar) {
        dragTo(e);
        return;
      }
      const r = e.target.closest(".opt-row");
      if (r) {
        const i = +r.dataset.index;
        if (i !== index) select(i);
      }
    });

    root.addEventListener("pointerdown", (e) => {
      menu.unlockAudio();
      if (busy) return;
      if (e.button === 2) {
        close();
        return;
      }
      const bar = e.target.closest(".opt-bar");
      if (bar) {
        const r = bar.closest(".opt-row");
        select(+r.dataset.index, false);
        dragBar = { bar, id: rows[+r.dataset.index].id, last: -1 };
        root.setPointerCapture(e.pointerId);
        dragTo(e);
        e.preventDefault();
      }
    });

    const endDrag = () => { dragBar = null; };
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);

    root.addEventListener("click", (e) => {
      if (busy || e.target.closest(".opt-bar")) return;
      const choice = e.target.closest(".opt-choice");
      const r = e.target.closest(".opt-row");
      if (!r) return;
      const i = +r.dataset.index;
      if (i !== index) select(i, false);
      const row = rows[i];
      if (choice && row.kind === "toggle") {
        const val = row.choices[+choice.dataset.k][1];
        if (settings[row.id] !== val) {
          settings[row.id] = val;
          menu.sfx("select");
          render(row.id);
          changed();
        }
        return;
      }
      if (row.kind !== "volume") activate();
    });

    root.addEventListener("wheel", (e) => {
      if (busy) return;
      e.preventDefault();
      const now = performance.now();
      if (now - (root._wheelT || 0) < 90) return;
      root._wheelT = now;
      // over a bar: adjust it; anywhere else: move the selection
      const bar = e.target.closest(".opt-bar");
      if (bar) {
        const i = +bar.closest(".opt-row").dataset.index;
        if (i !== index) select(i, false);
        adjust(e.deltaY < 0 ? 1 : -1);
      } else {
        select(index + (e.deltaY > 0 ? 1 : -1));
      }
    }, { passive: false });

    root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function dragTo(e) {
    const rect = dragBar.bar.getBoundingClientRect();
    const k = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const step = cfg.volumeStep || 0.05;
    const v = clamp(Math.round(k / step) * step, 0, 1);
    if (v === dragBar.last) return;
    dragBar.last = v;
    setVolume(dragBar.id, v);
  }

  function press(keyText) {
    const key = [...root.querySelectorAll(".opt-hints .key")].find((k) => k.textContent === keyText);
    if (!key) return;
    key.classList.add("is-pressed");
    setTimeout(() => key.classList.remove("is-pressed"), 130);
  }

  /* =================================================================
     Open / close
     ================================================================= */
  async function open() {
    if (!root) build();
    await scene.ready;
    resize();
    render();
    index = 0;
    root.hidden = false;
    root.classList.remove("is-open", "is-ready");
    titleEl.classList.remove("is-written");
    underline.classList.remove("is-drawn");
    select(0, false);
    if (menu.scene) menu.scene.paused = true;
    isOpen = true;
    busy = true;
    void root.offsetWidth;
    root.classList.add("is-open");
    menu.fadeIn(600);
    await wait(250);
    titleEl.classList.add("is-written");
    underline.classList.add("is-drawn");
    await wait(reducedMotion ? 100 : 800);
    root.classList.add("is-ready");
    plaque.classList.add("ignite");
    busy = false;
  }

  async function close(fromSave) {
    if (!isOpen || busy) return;
    busy = true;
    save();
    menu.sfx(fromSave ? "select" : "back");
    if (fromSave) {
      blink();
      await wait(450);
    }
    await menu.fadeOut(500);
    isOpen = false;
    root.hidden = true;
    if (menu.scene) menu.scene.paused = false;
    busy = false;
    menu.show();
  }

  /* =================================================================
     Animated desk: lamp flicker, smouldering cigarette, smoke
     ================================================================= */
  const scene = {
    img: null,
    t: 0,
    scale: 1,
    light: 1,
    flick: null,
    nextFlick: rand(6, 12),
    strands: [],
    ember: 0.6,
    ready: null
  };
  scene.ready = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { scene.img = img; resolve(); };
    img.onerror = () => { console.warn("[options] could not load", cfg.background); resolve(); };
    img.src = cfg.background;
  });

  const noise = (seed) => {
    const h = (n) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
    return (t) => { const i = Math.floor(t); const f = t - i; return lerp(h(i), h(i + 1), smooth(f)); };
  };
  const nA = noise(3.3), nB = noise(8.1), nC = noise(5.7), nWind = noise(1.9);

  // two smoke strands from the same cigarette, slightly out of step
  for (let s = 0; s < 2; s++) scene.strands.push({ pts: [], acc: 0, phase: rand(0, 10), strength: s ? 0.5 : 1 });

  function resize() {
    const stageScale = parseFloat(getComputedStyle(menu.stage).getPropertyValue("--scale")) || 1;
    const s = clamp(stageScale * (window.devicePixelRatio || 1), 0.75, 2);
    scene.scale = s;
    canvas.width = Math.round(STAGE_W * s);
    canvas.height = Math.round(STAGE_H * s);
  }
  window.addEventListener("resize", () => { if (isOpen) resize(); });

  function update(dt) {
    scene.t += dt;
    const t = scene.t;

    /* lamp: a steady tungsten hum, and now and then a quick stutter */
    let light = 1 + (nA(t * 1.7) - 0.5) * 0.035 + (nB(t * 7) - 0.5) * 0.015;
    if (!reducedMotion) {
      scene.nextFlick -= dt;
      if (!scene.flick && scene.nextFlick <= 0) {
        const keys = [[0, 1]];
        let at = 0;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          at += rand(0.04, 0.09);
          keys.push([at, rand(0.55, 0.75)]);
          at += rand(0.03, 0.08);
          keys.push([at, rand(0.92, 1)]);
        }
        keys.push([at + 0.15, 1]);
        scene.flick = { t: 0, keys };
        scene.nextFlick = rand(9, 22);
      }
    }
    if (scene.flick) {
      const f = scene.flick;
      f.t += dt;
      const k = f.keys;
      let v = 1;
      for (let i = 0; i < k.length - 1; i++) {
        if (f.t >= k[i][0] && f.t < k[i + 1][0]) { v = lerp(k[i][1], k[i + 1][1], (f.t - k[i][0]) / (k[i + 1][0] - k[i][0])); break; }
      }
      if (f.t >= k[k.length - 1][0]) scene.flick = null;
      light *= v;
    }
    scene.light = light;

    /* cigarette ember: slow smoulder */
    scene.ember = 0.55 + (nC(t * 0.6) - 0.5) * 0.35 + (nB(t * 5 + 9) - 0.5) * 0.08;

    /* smoke strands */
    const wind = (nWind(t * 0.15) - 0.5) * 10 + 2;
    for (const s of scene.strands) {
      s.acc += dt;
      while (s.acc > 1 / 40) {
        s.acc -= 1 / 40;
        s.pts.push({ x: cfg.cigarette.x + rand(-0.4, 0.4), y: cfg.cigarette.y, age: 0, seed: rand(0, 6.28) });
      }
      for (let i = s.pts.length - 1; i >= 0; i--) {
        const p = s.pts[i];
        p.age += dt;
        const a = p.age;
        // rises steadily; sideways sway grows with height, like a real thread of smoke
        const sway = Math.sin(t * 0.9 + a * 1.6 + s.phase) * (1.5 + a * a * 2.2) +
                     Math.sin(t * 2.3 + a * 3.1 + s.phase * 2) * (0.4 + a * 1.1);
        p.x += (wind * Math.min(1, a * 0.6) + sway) * dt;
        p.y -= (16 + a * 5) * dt;
        if (a > 6.5) s.pts.splice(i, 1);
      }
    }
  }

  function draw() {
    const s = scene.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#120c07";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    if (scene.img) {
      const iw = scene.img.naturalWidth, ih = scene.img.naturalHeight;
      const k = Math.max(STAGE_W / iw, STAGE_H / ih);
      const dw = iw * k, dh = ih * k, dx = (STAGE_W - dw) / 2, dy = (STAGE_H - dh) / 2;
      ctx.drawImage(scene.img, dx, dy, dw, dh);
      if (!reducedMotion) drawPaintedSmokeSway(dx, dy, k);
    }

    const L = scene.light;

    // lamp: warm bloom on the shade and a soft pool on the desk
    ctx.globalCompositeOperation = "lighter";
    glow(cfg.lamp.x, cfg.lamp.y, 70, [255, 214, 140], 0.20 * L * L);
    glow(cfg.lamp.x - 30, cfg.lamp.y + 40, 330, [255, 190, 110], 0.07 * L * L);

    // cigarette ember
    const e = scene.ember;
    glow(cfg.ember.x, cfg.ember.y, 8, [255, 120, 40], 0.55 * e);
    glow(cfg.ember.x, cfg.ember.y, 2.6, [255, 215, 150], 0.7 * e);
    glow(cfg.ember.x, cfg.ember.y, 26, [255, 110, 40], 0.12 * e);

    // smoke
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const st of scene.strands) drawStrand(st, L);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // the whole room (DOM included) dims with the lamp
    shade.style.opacity = clamp((1 - L) * 0.8, 0, 0.4).toFixed(3);
  }

  function glow(x, y, r, c, a) {
    if (a <= 0.002) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`);
    g.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${clamp(a * 0.4, 0, 1)})`);
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawStrand(st, L) {
    const pts = st.pts;
    if (pts.length < 3) return;
    // newest point is last; walk from the cigarette upward
    for (let pass = 0; pass < 2; pass++) {
      for (let i = pts.length - 1; i > 1; i--) {
        const p0 = pts[i], p1 = pts[i - 1], p2 = pts[i - 2];
        const a = p1.age;
        const life = 6.5;
        const fadeIn = clamp(a / 0.35, 0, 1);
        const fadeOut = Math.pow(clamp(1 - a / life, 0, 1), 1.6);
        let alpha = 0.2 * fadeIn * fadeOut * st.strength * (0.85 + 0.15 * L);
        let width = 0.9 + a * 1.9;
        if (pass === 0) { alpha *= 0.18; width *= 3.4; }   // soft halo first, then the thread
        if (alpha < 0.004) continue;
        ctx.strokeStyle = `rgba(222,218,208,${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
        ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        ctx.stroke();
      }
    }
  }

  /* the smoke already painted in the picture drifts gently */
  function drawPaintedSmokeSway(dx, dy, k) {
    const sw = cfg.paintedSmoke;
    const t = scene.t;
    const step = 3;
    for (let y = sw.y; y < sw.y + sw.h; y += step) {
      const v = (y - sw.y) / sw.h;
      const env = Math.sin(v * Math.PI) * (1 - v * 0.3);
      const off = (Math.sin(t * 0.7 + y * 0.03) + Math.sin(t * 0.43 - y * 0.017) * 0.6) * 1.8 * env;
      ctx.drawImage(scene.img, (sw.x - dx) / k, (y - dy) / k, sw.w / k, step / k, sw.x + off, y, sw.w, step);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (isOpen && !root.hidden) {
      update(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  // pre-roll so smoke is already rising the first time the screen opens
  scene.ready.then(() => { for (let i = 0; i < 260; i++) update(1 / 40); });

  /* =================================================================
     Public API + hook into the main menu
     ================================================================= */
  const api = {
    open,
    close: () => close(false),
    get() {
      return {
        audioVolume: menu.getSfxVolume(),
        musicVolume: menu.getMusicVolume(),
        subtitles: settings.subtitles,
        display: settings.display
      };
    },
    onChange(fn) { listeners.push(fn); return api; },
    /** Run your own controller-setup screen. Return true if handled. */
    onControllerSetup(fn) { menu.__optionsController = fn; return api; }
  };
  window.CosaOptions = api;

  menu.on("options", () => { open(); });
})();
