/* =====================================================================
   COSA NOSTRA — MAIN MENU
   Builds the menu from menu.config.js, runs the intro, handles mouse /
   keyboard / wheel input, plays the button animations and hands picked
   actions to your game through the CosaMenu API (see README.md).
   ===================================================================== */
(function () {
  "use strict";

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const MENU_TOP = 276;          // must match .menu { top } in menu.css
  const MENU_BOTTOM = 598;       // keep items above the toast + key hints
  const MAX_ITEM_H = 46;
  const SUBMENU_OFFSET = 34;   // extra room for the submenu heading
  const BACK = Symbol("CosaMenu.BACK");

  const cfg = window.MENU_CONFIG || {};
  const bgCfg = cfg.background || {};
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);

  const reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- elements ---------------- */
  const el = {
    stage: $("stage"),
    scene: $("scene"),
    fx: $("fx"),
    panelBg: $("panel-bg"),
    title: $("title"),
    subtitle: $("subtitle"),
    menu: $("menu"),
    items: $("items"),
    heading: $("page-heading"),
    highlight: $("highlight"),
    toast: $("toast"),
    hints: $("hints"),
    modal: $("modal"),
    modalTitle: $("modal-title"),
    modalText: $("modal-text"),
    modalActions: $("modal-actions"),
    fade: $("fade")
  };

  /* ---------------- state ---------------- */
  let uid = 0;
  const handlers = new Map();
  const state = {
    stack: [],            // pages: { items, title, index }
    buttons: [],          // rendered buttons on the current page
    entries: [],          // item objects matching state.buttons
    index: 0,
    busy: false,          // true while an action is blinking / fading / running
    introDone: false,
    introTimers: [],
    modal: null,          // { buttons, index, resolve }
    placeholder: null,
    debug: false,
    scale: 1,
    lastPointer: { x: -1, y: -1 },
    toastTimer: 0,
    wheelAcc: 0,
    wheelTime: 0,
    ignoreClicksUntil: 0  // the click that skips the intro shouldn't also pick a button
  };

  /* =================================================================
     Config normalisation
     ================================================================= */
  function normalizeItems(list) {
    return (list || []).map((raw) => {
      const item = Object.assign({ enabled: true, visible: true }, raw);
      if (!item.id) item.id = "item-" + ++uid;
      if (item.submenu) item.submenu = normalizeItems(item.submenu);
      return item;
    });
  }
  const rootItems = normalizeItems(cfg.items);

  function findItem(id, list, parent) {
    list = list || rootItems;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.id === id) return { item: it, list, index: i, parent: parent || null };
      if (it.submenu) {
        const hit = findItem(id, it.submenu, it);
        if (hit) return hit;
      }
    }
    return null;
  }

  /* =================================================================
     Theme
     ================================================================= */
  function applyTheme() {
    const t = cfg.theme || {};
    const root = document.documentElement.style;
    const map = {
      gold: "--gold", goldBright: "--gold-bright", goldDeep: "--gold-deep",
      text: "--text", textDim: "--text-dim", panel: "--panel"
    };
    for (const k in map) if (t[k]) root.setProperty(map[k], t[k]);
    if (t.panelWidth) root.setProperty("--panel-w", t.panelWidth + "px");
    if (cfg.documentTitle) document.title = cfg.documentTitle;
  }

  function panelWidth() {
    return (cfg.theme && cfg.theme.panelWidth) || 440;
  }

  /* Grainy texture for the gold title lettering. */
  function makeGrungeTexture() {
    const size = 220;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    const img = x.createImageData(size, size);
    for (let p = 0; p < img.data.length; p += 4) {
      const v = 205 + Math.random() * 50;
      img.data[p] = v;
      img.data[p + 1] = v * 0.98;
      img.data[p + 2] = v * 0.95;
      img.data[p + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // worn patches
    for (let i = 0; i < 26; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const r = rand(4, 22);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(120,96,70,${rand(0.15, 0.4)})`);
      g.addColorStop(1, "rgba(120,96,70,0)");
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // fine scratches
    x.strokeStyle = "rgba(110,90,66,0.35)";
    x.lineWidth = 0.7;
    for (let i = 0; i < 18; i++) {
      const sx = Math.random() * size;
      const sy = Math.random() * size;
      const a = rand(-0.6, 0.6);
      const l = rand(6, 26);
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
      x.stroke();
    }
    document.documentElement.style.setProperty("--grunge", `url(${c.toDataURL()})`);
  }

  /* =================================================================
     Panel artwork (dark worn slab with a torn right edge)
     ================================================================= */
  const panelEdge = [];   // fixed random edge so it doesn't change on resize
  function buildPanelEdge() {
    const R = seeded(77);
    const rand = (a, b) => a + R() * (b - a);
    const pw = panelWidth();
    panelEdge.length = 0;
    const seeds = [rand(0, 100), rand(0, 100), rand(0, 100)];
    for (let y = 0; y <= STAGE_H; y += 3) {
      let x = pw - 8;
      x += Math.sin(y * 0.011 + seeds[0]) * 5 + Math.sin(y * 0.037 + seeds[1]) * 2.5;
      x += Math.sin(y * 0.19 + seeds[2]) * 1.1 + rand(-1.2, 1.2);
      panelEdge.push([x, y]);
    }
    // a few chips knocked out of the edge
    for (let i = 0; i < 7; i++) {
      const at = Math.floor(rand(0, panelEdge.length - 6));
      const depth = rand(3, 8);
      for (let k = 0; k < 5; k++) panelEdge[at + k][0] -= depth * Math.sin((k / 4) * Math.PI);
    }
  }

  /* Seeded random so the panel looks identical every time it's redrawn. */
  function seeded(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawPanel(scale) {
    const R = seeded(1931);
    const rand = (a, b) => a + R() * (b - a);
    const pw = panelWidth();
    const W = pw + 90;
    const c = el.panelBg;
    c.width = Math.round(W * scale);
    c.height = Math.round(STAGE_H * scale);
    const x = c.getContext("2d");
    x.setTransform(scale, 0, 0, scale, 0, 0);

    const shape = new Path2D();
    shape.moveTo(-20, -20);
    shape.lineTo(panelEdge[0][0], -20);
    for (const [px, py] of panelEdge) shape.lineTo(px, py);
    shape.lineTo(panelEdge[panelEdge.length - 1][0], STAGE_H + 20);
    shape.lineTo(-20, STAGE_H + 20);
    shape.closePath();

    // shadow cast onto the scene
    x.save();
    x.shadowColor = "rgba(0,0,0,0.9)";
    x.shadowBlur = 46;
    x.shadowOffsetX = 10;
    x.fillStyle = "#000";
    x.fill(shape);
    x.restore();

    x.save();
    x.clip(shape);

    // base tone
    const panelColor = (cfg.theme && cfg.theme.panel) || "#120d09";
    x.fillStyle = panelColor;
    x.fillRect(0, 0, W, STAGE_H);
    const v = x.createLinearGradient(0, 0, 0, STAGE_H);
    v.addColorStop(0, "rgba(0,0,0,0.35)");
    v.addColorStop(0.3, "rgba(60,42,24,0.18)");
    v.addColorStop(0.65, "rgba(48,34,20,0.12)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    x.fillStyle = v;
    x.fillRect(0, 0, W, STAGE_H);

    // warm pool of light behind the title
    const g = x.createRadialGradient(pw * 0.48, 150, 10, pw * 0.48, 150, 300);
    g.addColorStop(0, "rgba(120,82,40,0.22)");
    g.addColorStop(1, "rgba(120,82,40,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, STAGE_H);

    // cloudy grunge: a few octaves of smoothed noise
    const octave = (cols, alpha, mode) => {
      const t = document.createElement("canvas");
      t.width = cols;
      t.height = Math.ceil(cols * (STAGE_H / W));
      const tx = t.getContext("2d");
      const img = tx.createImageData(t.width, t.height);
      for (let p = 0; p < img.data.length; p += 4) {
        const n = R() * 255;
        img.data[p] = n;
        img.data[p + 1] = n * 0.9;
        img.data[p + 2] = n * 0.75;
        img.data[p + 3] = 255;
      }
      tx.putImageData(img, 0, 0);
      x.globalCompositeOperation = mode;
      x.globalAlpha = alpha;
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = "high";
      x.drawImage(t, 0, 0, W, STAGE_H);
    };
    octave(9, 0.22, "soft-light");
    octave(26, 0.16, "soft-light");
    octave(80, 0.1, "overlay");
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";

    // stains
    for (let i = 0; i < 14; i++) {
      const sx = rand(0, pw);
      const sy = rand(0, STAGE_H);
      const r = rand(20, 90);
      const s = x.createRadialGradient(sx, sy, 0, sx, sy, r);
      s.addColorStop(0, `rgba(0,0,0,${rand(0.1, 0.3)})`);
      s.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = s;
      x.fillRect(sx - r, sy - r, r * 2, r * 2);
    }

    // scratches
    for (let i = 0; i < 60; i++) {
      const sx = rand(0, pw);
      const sy = rand(0, STAGE_H);
      const a = rand(-0.5, 0.5) + (R() < 0.5 ? 0 : Math.PI / 2);
      const l = rand(8, 60);
      x.strokeStyle = R() < 0.5 ? `rgba(190,150,100,${rand(0.03, 0.07)})` : `rgba(0,0,0,${rand(0.1, 0.25)})`;
      x.lineWidth = rand(0.5, 1.1);
      x.beginPath();
      x.moveTo(sx, sy);
      x.quadraticCurveTo(sx + Math.cos(a) * l * 0.5 + rand(-4, 4), sy + Math.sin(a) * l * 0.5 + rand(-4, 4),
        sx + Math.cos(a) * l, sy + Math.sin(a) * l);
      x.stroke();
    }

    // fine speckle
    const sp = x.createImageData(Math.round(W * scale), Math.round(STAGE_H * scale));
    for (let p = 0; p < sp.data.length; p += 4) {
      if (R() < 0.5) continue;
      const n = R() < 0.5 ? 0 : 255;
      sp.data[p] = sp.data[p + 1] = sp.data[p + 2] = n;
      sp.data[p + 3] = R() * 14;
    }
    const spc = document.createElement("canvas");
    spc.width = sp.width;
    spc.height = sp.height;
    spc.getContext("2d").putImageData(sp, 0, 0);
    x.drawImage(spc, 0, 0, W, STAGE_H);

    // darker towards the torn edge and the screen edge
    const e = x.createLinearGradient(pw - 70, 0, pw + 4, 0);
    e.addColorStop(0, "rgba(0,0,0,0)");
    e.addColorStop(1, "rgba(0,0,0,0.55)");
    x.fillStyle = e;
    x.fillRect(pw - 70, 0, 80, STAGE_H);
    const l = x.createLinearGradient(0, 0, 60, 0);
    l.addColorStop(0, "rgba(0,0,0,0.5)");
    l.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = l;
    x.fillRect(0, 0, 60, STAGE_H);
    x.restore();

    // worn rim catching the light
    const rim = new Path2D();
    rim.moveTo(panelEdge[0][0], panelEdge[0][1]);
    for (const [px, py] of panelEdge) rim.lineTo(px, py);
    x.strokeStyle = "rgba(0,0,0,0.8)";
    x.lineWidth = 2.5;
    x.stroke(rim);
    x.save();
    x.translate(-1.2, 0);
    x.strokeStyle = "rgba(196,154,98,0.16)";
    x.lineWidth = 1;
    x.stroke(rim);
    x.restore();
  }

  /* =================================================================
     Rendering the menu
     ================================================================= */
  function renderTitle() {
    el.title.textContent = "";
    const lines = Array.isArray(cfg.title) ? cfg.title : [cfg.title || ""];
    for (const line of lines) {
      const span = document.createElement("span");
      span.className = "line";
      span.textContent = line;
      el.title.appendChild(span);
    }
    el.subtitle.textContent = cfg.subtitle || "";
    el.subtitle.style.display = cfg.subtitle ? "" : "none";
  }

  function renderHints() {
    el.hints.textContent = "";
    for (const h of cfg.hints || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hint";
      b.tabIndex = -1;
      b.dataset.action = h.action || "";
      const keys = document.createElement("span");
      keys.className = "hint-keys";
      for (const k of h.keys || []) {
        const kbd = document.createElement("kbd");
        kbd.className = "key";
        kbd.textContent = k;
        kbd.dataset.key = k;
        keys.appendChild(kbd);
      }
      const label = document.createElement("span");
      label.className = "hint-label";
      label.textContent = h.label;
      b.append(keys, label);
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        if (h.action === "select") activateCurrent();
        else if (h.action === "back") goBack();
      });
      el.hints.appendChild(b);
    }
  }

  function currentPage() {
    return state.stack[state.stack.length - 1];
  }

  function pageEntries(page) {
    const list = page.items.filter((it) => it.visible !== false);
    if (state.stack.length > 1 && page === currentPage()) {
      list.push({ id: "__back", label: cfg.backLabel || "Back", back: true, enabled: true });
    }
    return list;
  }

  function renderPage(selectId) {
    const page = currentPage();
    const entries = pageEntries(page);
    state.entries = entries;
    state.buttons = [];
    el.items.textContent = "";

    // submenu pages sit a little lower to make room for their heading
    const top = page.title ? MENU_TOP + SUBMENU_OFFSET : MENU_TOP;
    el.menu.style.top = top + "px";
    const n = Math.max(1, entries.length);
    const itemH = Math.min(MAX_ITEM_H, Math.floor((MENU_BOTTOM - top) / n));
    el.menu.style.setProperty("--item-h", itemH + "px");
    const fontScale = itemH < 40 ? itemH / 40 : 1;

    entries.forEach((it, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item";
      b.id = "menu-item-" + it.id;
      b.tabIndex = -1;
      b.setAttribute("role", "menuitem");
      b.style.setProperty("--i", i);
      if (fontScale !== 1) b.style.fontSize = Math.round(30 * fontScale) + "px";
      if (it.enabled === false) {
        b.classList.add("is-disabled");
        b.setAttribute("aria-disabled", "true");
      }
      if (it.submenu) b.setAttribute("aria-haspopup", "true");
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = it.label;
      b.appendChild(label);
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        if (state.busy || state.modal || performance.now() < state.ignoreClicksUntil) return;
        if (state.index !== i) setIndex(i, { sound: false });
        activate(i);
      });
      el.items.appendChild(b);
      state.buttons.push(b);
    });
    // measure labels at rest so the highlight width doesn't depend on hover styling
    for (const b of state.buttons) b.dataset.w = b.querySelector(".label").offsetWidth;

    el.heading.textContent = page.title || "";
    el.heading.classList.toggle("is-visible", !!page.title);

    let idx = page.index || 0;
    if (selectId) {
      const found = entries.findIndex((e) => e.id === selectId);
      if (found >= 0) idx = found;
    }
    setIndex(clamp(idx, 0, entries.length - 1), { sound: false, ignite: false });
    el.highlight.classList.toggle("is-hidden", entries.length === 0);
  }

  /* Move the selection. */
  function setIndex(i, opts) {
    opts = opts || {};
    const count = state.buttons.length;
    if (!count) return;
    i = clamp(i, 0, count - 1);
    const changed = i !== state.index;
    state.index = i;
    currentPage().index = i;

    state.buttons.forEach((b, k) => {
      b.classList.toggle("is-active", k === i);
      b.setAttribute("aria-selected", k === i ? "true" : "false");
    });
    el.items.setAttribute("aria-activedescendant", state.buttons[i].id);

    const itemH = parseFloat(getComputedStyle(el.menu).getPropertyValue("--item-h")) || MAX_ITEM_H;
    const labelW = parseFloat(state.buttons[i].dataset.w) || 160;
    const hlW = clamp(labelW * 1.18 + 96, 250, panelWidth() - 60);
    el.menu.style.setProperty("--hl-y", i * itemH + "px");
    el.menu.style.setProperty("--hl-w", hlW + "px");
    el.highlight.classList.toggle("is-disabled", state.entries[i] && state.entries[i].enabled === false);

    if ((changed || opts.ignite) && opts.ignite !== false) ignite();
    if (changed && opts.sound !== false) sfx("hover");
  }

  function ignite() {
    el.highlight.classList.remove("ignite");
    void el.highlight.offsetWidth;   // restart the CSS animation
    el.highlight.classList.add("ignite");
  }

  function move(delta) {
    const count = state.buttons.length;
    if (!count) return;
    let i = state.index + delta;
    if (cfg.wrapNavigation !== false) i = (i + count) % count;
    else i = clamp(i, 0, count - 1);
    if (i !== state.index) setIndex(i);
  }

  /* =================================================================
     Activation
     ================================================================= */
  function activateCurrent() {
    if (state.modal) return modalActivate();
    activate(state.index);
  }

  async function activate(i) {
    if (state.busy || !state.introDone) return;
    const item = state.entries[i];
    const btn = state.buttons[i];
    if (!item || !btn) return;

    if (item.enabled === false) {
      sfx("error");
      btn.classList.remove("is-shaking");
      void btn.offsetWidth;
      btn.classList.add("is-shaking");
      setTimeout(() => btn.classList.remove("is-shaking"), 450);
      toast(item.disabledText || "Unavailable", true);
      return;
    }

    if (item.back) return goBack();

    if (item.submenu) {
      state.busy = true;
      sfx("select");
      await blink(btn, 2);
      await openSubmenu(item);
      state.busy = false;
      return;
    }

    if (item.confirm) {
      state.busy = true;
      sfx("select");
      await blink(btn, 2);
      const ok = await confirmDialog(item.confirm);
      state.busy = false;
      if (!ok) return;
    }

    runAction(item, btn);
  }

  async function runAction(item, btn) {
    state.busy = true;
    const handler = handlers.get(item.action) || handlers.get("*");
    const hasDefault = item.href || item.action === "quit";

    sfx("select");
    if (scene) scene.pulse(0.9);
    burst(btn);
    await blink(btn, cfg.selectBlinks == null ? 4 : cfg.selectBlinks);

    window.dispatchEvent(new CustomEvent("cosamenu:action", { detail: { action: item.action, item } }));

    if (!handler && !hasDefault) {
      toast(item.toast || cfg.defaultToast || "Coming soon");
      state.busy = false;
      return;
    }

    if (cfg.fadeOutOnAction !== false) await fadeOut();

    if (handler) {
      let result;
      try {
        result = await handler(item, api);
      } catch (err) {
        console.error("[menu] action handler failed:", err);
        result = BACK;
      }
      if (result === BACK) show();
      return;
    }

    if (item.href) {
      window.location.href = item.href;
      return;
    }

    if (item.action === "quit") {
      // Works in Electron / NW.js / windows opened by script.
      // A normal browser tab refuses, so come back and explain.
      window.close();
      await wait(300);
      show();
      setTimeout(() => toast("Close this window to exit"), 500);
    }
  }

  function blink(btn, times) {
    if (!btn || times <= 0) return Promise.resolve();
    const t = reducedMotion ? 0.16 : 0.11;
    const els = [btn, el.highlight];
    for (const e of els) {
      e.style.setProperty("--blink-count", times);
      e.style.setProperty("--blink-time", t + "s");
    }
    btn.classList.add("is-blinking");
    el.highlight.classList.add("blink");
    return wait(times * t * 1000 + 40).then(() => {
      btn.classList.remove("is-blinking");
      el.highlight.classList.remove("blink");
    });
  }

  /* ---------------- pages ---------------- */
  async function swapPage(fn) {
    el.highlight.classList.add("is-hidden");
    el.items.classList.add("is-leaving");
    await wait(260 + state.buttons.length * 25);
    el.items.classList.remove("is-leaving");
    el.items.classList.add("is-entering");
    fn();
    void el.items.offsetWidth;
    el.items.classList.remove("is-entering");
    await wait(120);
    el.highlight.classList.remove("is-hidden");
    ignite();
  }

  function openSubmenu(item) {
    return swapPage(() => {
      state.stack.push({ items: item.submenu, title: item.label, index: 0 });
      renderPage();
    });
  }

  async function goBack() {
    if (state.modal) return closeModal(false);
    if (state.busy || !state.introDone) return;
    if (state.stack.length > 1) {
      state.busy = true;
      sfx("back");
      await swapPage(() => {
        state.stack.pop();
        renderPage();
      });
      state.busy = false;
      return;
    }
    if (cfg.escOnRootOpensQuit !== false) {
      const quit = state.entries.findIndex((e) => e.action === "quit" && e.enabled !== false);
      if (quit >= 0) {
        setIndex(quit);
        activate(quit);
      }
    }
  }

  /* ---------------- confirm dialog ---------------- */
  function confirmDialog(opts) {
    return new Promise((resolve) => {
      el.modalTitle.textContent = opts.title || "Are you sure?";
      el.modalText.textContent = opts.text || "";
      el.modalText.style.display = opts.text ? "" : "none";
      el.modalActions.textContent = "";
      const labels = [opts.yes || "Yes", opts.no || "No"];
      const buttons = labels.map((txt, k) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "modal-btn";
        b.tabIndex = -1;
        b.textContent = txt;
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("mousemove", () => setModalIndex(k));
        b.addEventListener("click", () => {
          setModalIndex(k);
          modalActivate();
        });
        el.modalActions.appendChild(b);
        return b;
      });
      state.modal = { buttons, index: 1, resolve, closing: false };
      setModalIndex(1, true);     // default to the safe choice
      el.modal.hidden = false;
      void el.modal.offsetWidth;
      el.modal.classList.add("is-open");
    });
  }

  function setModalIndex(i, silent) {
    const m = state.modal;
    if (!m || m.closing) return;
    const changed = m.index !== i;
    m.index = i;
    m.buttons.forEach((b, k) => b.classList.toggle("is-active", k === i));
    if (changed && !silent) sfx("hover");
  }

  async function modalActivate() {
    const m = state.modal;
    if (!m || m.closing) return;
    const yes = m.index === 0;
    m.closing = true;
    sfx(yes ? "select" : "back");
    const b = m.buttons[m.index];
    b.classList.add("is-blinking");
    await wait(320);
    closeModal(yes, true);
  }

  function closeModal(result, already) {
    const m = state.modal;
    if (!m) return;
    if (!already) {
      if (m.closing) return;
      m.closing = true;
      sfx("back");
    }
    el.modal.classList.remove("is-open");
    state.modal = null;
    setTimeout(() => {
      if (!state.modal) el.modal.hidden = true;
    }, 320);
    m.resolve(result);
  }

  /* ---------------- toast ---------------- */
  function toast(msg, isError) {
    clearTimeout(state.toastTimer);
    el.toast.textContent = msg;
    el.toast.classList.toggle("is-error", !!isError);
    el.toast.classList.remove("is-visible");
    void el.toast.offsetWidth;
    el.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 2000);
  }

  /* ---------------- fade / show / hide ---------------- */
  function fadeOut(ms) {
    ms = ms == null ? 650 : ms;
    el.fade.style.setProperty("--fade-time", ms / 1000 + "s");
    el.fade.classList.remove("is-clear");
    return wait(ms);
  }

  function fadeIn(ms) {
    ms = ms == null ? 650 : ms;
    el.fade.style.setProperty("--fade-time", ms / 1000 + "s");
    el.fade.classList.add("is-clear");
    return wait(ms);
  }

  /* Bring the menu back after a handler finished (e.g. leaving a game). */
  async function show() {
    el.stage.classList.remove("show-items");
    el.highlight.classList.add("is-hidden");
    fadeIn(700);
    await wait(250);
    el.stage.classList.add("show-items");
    await wait(300);
    el.highlight.classList.remove("is-hidden");
    setIndex(state.index, { sound: false, ignite: true });
    state.busy = false;
  }

  function hide() {
    state.busy = true;
    return fadeOut();
  }

  /* A stand-in screen so you can see the hand-off working. */
  function placeholder(title, text) {
    const p = document.createElement("div");
    p.className = "placeholder";
    const h = document.createElement("h2");
    h.textContent = title;
    const t = document.createElement("p");
    t.textContent = text || "";
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "hint";
    hint.dataset.action = "back";
    hint.innerHTML = '<span class="hint-keys"><kbd class="key">Esc</kbd></span><span class="hint-label">Return to menu</span>';
    p.append(h, t, hint);
    el.stage.appendChild(p);

    const close = async () => {
      if (!state.placeholder) return;
      state.placeholder = null;
      sfx("back");
      await fadeOut(450);
      p.remove();
      show();
    };
    hint.addEventListener("click", close);
    state.placeholder = { close };

    requestAnimationFrame(() => {
      p.classList.add("is-open");
      fadeIn(300);
    });
  }

  /* =================================================================
     Sparks (select burst)
     ================================================================= */
  const fx = {
    ctx: el.fx.getContext("2d"),
    sparks: [],
    flashes: [],
    scale: 1
  };

  function stagePoint(rect) {
    const s = el.stage.getBoundingClientRect();
    return {
      x: (rect.left - s.left) / state.scale,
      y: (rect.top - s.top) / state.scale,
      w: rect.width / state.scale,
      h: rect.height / state.scale
    };
  }

  function burst(btn) {
    if (reducedMotion || !btn) return;
    const r = stagePoint(el.highlight.getBoundingClientRect());
    const cy = r.y + r.h / 2;
    fx.flashes.push({ x: r.x + r.w / 2, y: cy, w: r.w * 1.6, life: 0.45, age: 0 });
    for (let i = 0; i < 46; i++) {
      const fromChevron = Math.random() < 0.35;
      const x = fromChevron ? r.x + r.w + 14 : r.x + rand(0.1, 0.9) * r.w;
      const y = cy + rand(-r.h * 0.4, r.h * 0.4);
      const ang = fromChevron ? rand(-1.2, 1.2) : rand(-Math.PI, 0);
      const sp = fromChevron ? rand(120, 340) : rand(60, 220);
      fx.sparks.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - rand(20, 80),
        life: rand(0.45, 1.05),
        age: 0,
        w: rand(0.8, 1.8)
      });
    }
  }

  function updateFx(dt) {
    const c = fx.ctx;
    if (!fx.sparks.length && !fx.flashes.length) {
      if (fx.dirty) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, el.fx.width, el.fx.height);
        fx.dirty = false;
      }
      return;
    }
    fx.dirty = true;
    c.setTransform(fx.scale, 0, 0, fx.scale, 0, 0);
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    c.globalCompositeOperation = "lighter";

    for (let i = fx.flashes.length - 1; i >= 0; i--) {
      const f = fx.flashes[i];
      f.age += dt;
      const u = f.age / f.life;
      if (u >= 1) {
        fx.flashes.splice(i, 1);
        continue;
      }
      const a = (1 - u) * (1 - u);
      const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.w / 2);
      g.addColorStop(0, `rgba(255,236,190,${0.55 * a})`);
      g.addColorStop(0.4, `rgba(255,200,120,${0.18 * a})`);
      g.addColorStop(1, "rgba(255,200,120,0)");
      c.save();
      c.translate(f.x, f.y);
      c.scale(1, 0.09 + u * 0.05);
      c.translate(-f.x, -f.y);
      c.fillStyle = g;
      c.fillRect(f.x - f.w / 2, f.y - f.w / 2, f.w, f.w);
      c.restore();
    }

    c.lineCap = "round";
    for (let i = fx.sparks.length - 1; i >= 0; i--) {
      const p = fx.sparks[i];
      p.age += dt;
      if (p.age >= p.life) {
        fx.sparks.splice(i, 1);
        continue;
      }
      p.vy += 420 * dt;
      p.vx *= 1 - dt * 1.4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      c.strokeStyle = `rgba(255,${190 + ((a * 50) | 0)},${110 + ((a * 80) | 0)},${a})`;
      c.lineWidth = p.w;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
  }

  /* =================================================================
     Sound
     ================================================================= */
  const sounds = {};
  let audioUnlocked = false;
  function initSound() {
    const s = cfg.sounds || {};
    for (const key of ["hover", "select", "back", "error"]) {
      if (s[key]) {
        const a = new Audio(s[key]);
        a.preload = "auto";
        sounds[key] = a;
      }
    }
    for (const key of ["music", "ambience"]) {
      if (s[key]) {
        const a = new Audio(s[key]);
        a.loop = true;
        a.preload = "auto";
        a.volume = (s.volume == null ? 0.7 : s.volume) * (key === "music" ? 0.6 : 0.8);
        sounds[key] = a;
      }
    }
  }

  function unlockAudio() {
    if (synth.ctx && synth.ctx.state === "suspended") synth.ctx.resume().catch(() => {});
    if (audioUnlocked) return;
    audioUnlocked = true;
    initSynth();
    for (const key of ["music", "ambience"]) {
      if (sounds[key]) sounds[key].play().catch(() => {});
    }
  }

  function volume() {
    const v = cfg.sounds && cfg.sounds.volume;
    return v == null ? 0.7 : v;
  }

  function sfx(name) {
    if (!audioUnlocked) return;
    const base = sounds[name];
    if (base) {
      const a = base.cloneNode();
      a.volume = volume();
      a.play().catch(() => {});
      return;
    }
    if (cfg.sounds && cfg.sounds.synth === false) return;
    playSynth(name);
  }

  /* ---------- built-in sounds (made in code, no files needed) ----------
     Used for any slot in cfg.sounds that has no file. Browsers only allow
     sound after the first click or key press. */
  const synth = { ctx: null, out: null, noise: null, lastHover: 0 };

  function initSynth() {
    if (synth.ctx || (cfg.sounds && cfg.sounds.synth === false)) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const out = ctx.createGain();
    out.gain.value = volume();
    // gentle compression keeps layered sounds from clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    out.connect(comp).connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    Object.assign(synth, { ctx, out, noise });
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  /* envelope: quick attack, exponential fall */
  function env(g, t, peak, decay, attack) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (attack || 0.002) + decay);
  }

  function tone(t, freq, peak, decay, type, toFreq, attack) {
    const { ctx, out } = synth;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + decay);
    env(g, t, peak, decay, attack);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.05);
    return g;
  }

  function noiseBurst(t, freq, q, peak, decay, kind) {
    const { ctx, out, noise } = synth;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = kind || "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, peak, decay, 0.001);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  /* a small hotel-desk bell: a few inharmonic partials ringing out */
  function bell(t, base, peak) {
    const partials = [[1, 1, 1.5], [2.0, 0.42, 1.0], [2.76, 0.3, 0.7], [5.4, 0.12, 0.35]];
    for (const [ratio, gain, decay] of partials) tone(t, base * ratio, peak * gain, decay);
  }

  function playSynth(name) {
    if (!synth.ctx) initSynth();
    const ctx = synth.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case "hover": {
        // brass switch tick
        const now = performance.now();
        if (now - synth.lastHover < 35) return;
        synth.lastHover = now;
        noiseBurst(t, 3200, 4, 0.32, 0.035);
        tone(t, 2300, 0.05, 0.04);
        tone(t, 190, 0.07, 0.05);
        break;
      }
      case "select":
        // heavy click, a low thunk, then the bell
        noiseBurst(t, 1800, 0.8, 0.35, 0.02, "highpass");
        tone(t, 150, 0.5, 0.22, "sine", 52);
        bell(t + 0.03, 659.25, 0.16);
        break;
      case "back":
        noiseBurst(t, 1400, 3, 0.22, 0.03);
        tone(t, 330, 0.12, 0.13, "triangle", 210);
        break;
      case "error":
        for (const dt of [0, 0.11]) tone(t + dt, 98, 0.1, 0.075, "square");
        tone(t, 70, 0.18, 0.2, "sine");
        break;
      default:
        break;
    }
  }

  /* =================================================================
     Input
     ================================================================= */
  function pressKeycap(action, keyText) {
    const hint = el.hints.querySelector(`.hint[data-action="${action}"]`);
    if (!hint) return;
    let key = keyText ? hint.querySelector(`.key[data-key="${CSS.escape(keyText)}"]`) : null;
    if (!key) key = hint.querySelector(".key");
    if (!key) return;
    key.classList.add("is-pressed");
    setTimeout(() => key.classList.remove("is-pressed"), 130);
  }

  function onKeyDown(e) {
    unlockAudio();
    document.body.classList.add("hide-cursor");
    const k = e.key;

    if (k === "F3") {
      e.preventDefault();
      state.debug = !state.debug;
      if (scene) scene.debug = state.debug;
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    if (!state.introDone) {
      if (k !== "F11" && k !== "F12") {
        e.preventDefault();
        skipIntro();
      }
      return;
    }

    const isUp = k === "ArrowUp" || k === "w" || k === "W";
    const isDown = k === "ArrowDown" || k === "s" || k === "S";
    const isLeft = k === "ArrowLeft" || k === "a" || k === "A";
    const isRight = k === "ArrowRight" || k === "d" || k === "D";
    const isSelect = k === "Enter" || k === " " || k === "Spacebar";
    const isBack = k === "Escape" || k === "Backspace";

    if (state.placeholder) {
      if (isBack || isSelect) {
        e.preventDefault();
        if (!e.repeat) state.placeholder.close();
      }
      return;
    }

    if (state.modal) {
      if (isLeft || isUp || (k === "Tab" && e.shiftKey)) { e.preventDefault(); setModalIndex(0); }
      else if (isRight || isDown || k === "Tab") { e.preventDefault(); setModalIndex(1); }
      else if (isSelect) { e.preventDefault(); if (!e.repeat) { pressKeycap("select"); modalActivate(); } }
      else if (isBack) { e.preventDefault(); if (!e.repeat) { pressKeycap("back"); closeModal(false); } }
      return;
    }

    if (state.busy) {
      if (isUp || isDown || isSelect || isBack || k === "Tab") e.preventDefault();
      return;
    }

    if (isUp || (k === "Tab" && e.shiftKey)) {
      e.preventDefault();
      pressKeycap("navigate", "↑");
      move(-1);
    } else if (isDown || k === "Tab") {
      e.preventDefault();
      pressKeycap("navigate", "↓");
      move(1);
    } else if (k === "Home") {
      e.preventDefault();
      setIndex(0);
    } else if (k === "End") {
      e.preventDefault();
      setIndex(state.buttons.length - 1);
    } else if (isSelect) {
      e.preventDefault();
      if (e.repeat) return;
      pressKeycap("select");
      activateCurrent();
    } else if (isBack) {
      e.preventDefault();
      if (e.repeat) return;
      pressKeycap("back");
      goBack();
    }
  }

  function onPointerMove(e) {
    document.body.classList.remove("hide-cursor");
    if (scene) {
      scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      const s = el.stage.getBoundingClientRect();
      scene.setMouseStage((e.clientX - s.left) / state.scale, (e.clientY - s.top) / state.scale);
    }
    // only real movement selects, so keyboard users aren't overridden by a resting cursor
    if (e.clientX === state.lastPointer.x && e.clientY === state.lastPointer.y) return;
    state.lastPointer.x = e.clientX;
    state.lastPointer.y = e.clientY;
    if (!state.introDone || state.busy || state.modal) return;
    const btn = e.target.closest && e.target.closest(".item");
    if (!btn) return;
    const i = state.buttons.indexOf(btn);
    if (i >= 0 && i !== state.index) setIndex(i);
  }

  function onWheel(e) {
    if (!state.introDone || state.busy || state.modal || state.placeholder) return;
    e.preventDefault();
    const now = performance.now();
    if (now - state.wheelTime > 250) state.wheelAcc = 0;
    state.wheelTime = now;
    state.wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(state.wheelAcc) >= 60) {
      move(state.wheelAcc > 0 ? 1 : -1);
      state.wheelAcc = 0;
    }
  }

  function onPointerDown(e) {
    unlockAudio();
    if (!state.introDone) {
      e.preventDefault();
      state.ignoreClicksUntil = performance.now() + 400;
      skipIntro();
      return;
    }
    // right click = back, like most PC games
    if (e.button === 2) {
      if (state.placeholder) state.placeholder.close();
      else goBack();
    }
  }

  /* =================================================================
     Layout / scaling
     ================================================================= */
  let scene = null;
  let resizeTimer = 0;

  function fitStage() {
    const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    state.scale = s;
    el.stage.style.setProperty("--scale", s);
    const rs = clamp(s * (window.devicePixelRatio || 1), 0.75, 2);
    if (scene) scene.resize(rs);
    fx.scale = rs;
    el.fx.width = Math.round(STAGE_W * rs);
    el.fx.height = Math.round(STAGE_H * rs);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawPanel(rs), state.panelDrawn ? 120 : 0);
    state.panelDrawn = true;
  }

  /* =================================================================
     Intro
     ================================================================= */
  const introSteps = [
    [0, "show-panel"],
    [450, "show-title1"],
    [700, "show-title2"],
    [1200, "show-subtitle"],
    [1500, "show-items"],
    [2100, "show-highlight"],
    [2250, "show-hints"],
    [2900, "ready"]
  ];

  function runIntro() {
    el.stage.classList.remove("is-loading");
    const play = cfg.playIntro !== false && !reducedMotion;
    if (!play) return skipIntro(true);
    fadeIn(2200);
    for (const [ms, cls] of introSteps) {
      state.introTimers.push(setTimeout(() => {
        el.stage.classList.add(cls);
        if (cls === "show-highlight") ignite();
        if (cls === "ready") state.introDone = true;
      }, 350 + ms));
    }
  }

  function skipIntro(quiet) {
    if (state.introDone) return;
    state.introTimers.forEach(clearTimeout);
    state.introTimers = [];
    el.stage.classList.add("instant");
    for (const [, cls] of introSteps) el.stage.classList.add(cls);
    fadeIn(quiet ? 500 : 350);
    ignite();
    state.introDone = true;
    setTimeout(() => el.stage.classList.remove("instant"), 450);
  }

  /* =================================================================
     Main loop
     ================================================================= */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (scene) {
      scene.update(dt);
      scene.draw();
    }
    updateFx(dt);
    requestAnimationFrame(frame);
  }

  /* =================================================================
     Public API
     ================================================================= */
  function rerender() {
    const sel = state.entries[state.index];
    // drop pages whose parent item vanished
    while (state.stack.length > 1) {
      const top = currentPage();
      const owner = rootItems && findOwner(top.items);
      if (owner && owner.visible !== false) break;
      state.stack.pop();
    }
    renderPage(sel && sel.id);
    if (el.stage.classList.contains("show-items")) {
      el.items.classList.add("is-entering");
      void el.items.offsetWidth;
      el.items.classList.remove("is-entering");
    }
  }

  function findOwner(list, within) {
    within = within || rootItems;
    for (const it of within) {
      if (it.submenu === list) return it;
      if (it.submenu) {
        const f = findOwner(list, it.submenu);
        if (f) return f;
      }
    }
    return null;
  }

  function update(id, patch) {
    const hit = findItem(id);
    if (!hit) {
      console.warn("[menu] no item with id", id);
      return api;
    }
    Object.assign(hit.item, patch);
    rerender();
    return api;
  }

  const api = {
    BACK,
    config: cfg,

    /** Run fn when an item with this action is picked. Use "*" as a catch-all. */
    on(action, fn) { handlers.set(action, fn); return api; },
    off(action) { handlers.delete(action); return api; },

    /** Add a button. where: { before: id } | { after: id } | { index: n } | { parent: id } */
    addItem(item, where) {
      where = where || {};
      const [it] = normalizeItems([item]);
      let list = rootItems;
      if (where.parent) {
        const p = findItem(where.parent);
        if (!p) { console.warn("[menu] no parent", where.parent); return api; }
        p.item.submenu = p.item.submenu || [];
        list = p.item.submenu;
      }
      let at = list.length;
      if (where.before || where.after) {
        const ref = findItem(where.before || where.after);
        if (ref) {
          list = ref.list;
          at = ref.index + (where.after ? 1 : 0);
        }
      } else if (typeof where.index === "number") {
        at = clamp(where.index, 0, list.length);
      }
      list.splice(at, 0, it);
      rerender();
      return api;
    },
    removeItem(id) {
      const hit = findItem(id);
      if (hit) {
        hit.list.splice(hit.index, 1);
        rerender();
      }
      return api;
    },
    setEnabled(id, enabled) { return update(id, { enabled: !!enabled }); },
    setVisible(id, visible) { return update(id, { visible: !!visible }); },
    setLabel(id, label) { return update(id, { label: String(label) }); },
    setAction(id, action) { return update(id, { action }); },
    getItem(id) { const h = findItem(id); return h ? h.item : null; },
    getItems() { return rootItems; },

    /** Highlight an item on the current page. */
    select(id) {
      const i = state.entries.findIndex((e) => e.id === id);
      if (i >= 0) setIndex(i);
      return api;
    },
    /** Pick an item as if the player chose it. */
    activate(id) {
      const i = state.entries.findIndex((e) => e.id === id);
      if (i >= 0) { setIndex(i, { sound: false }); activate(i); }
      return api;
    },

    show, hide, toast, placeholder,
    confirm: confirmDialog,
    get scene() { return scene; }
  };
  window.CosaMenu = api;

  /* =================================================================
     Boot
     ================================================================= */
  async function boot() {
    applyTheme();
    makeGrungeTexture();
    renderTitle();
    renderHints();
    buildPanelEdge();
    initSound();

    state.stack.push({ items: rootItems, title: null, index: 0 });

    scene = window.MenuScene ? new window.MenuScene(el.scene, bgCfg) : null;
    fitStage();

    const fontsReady = document.fonts
      ? Promise.race([
          Promise.all([
            document.fonts.load('600 30px "Oswald"'),
            document.fonts.load('700 96px "Oswald"'),
            document.fonts.load('500 25px "Oswald"')
          ]),
          wait(2500)
        ]).catch(() => {})
      : Promise.resolve();

    await Promise.all([scene ? scene.load() : null, fontsReady]);
    if (scene) {
      scene.resize(fx.scale);
      // let the rain and smoke settle so the first frame isn't empty
      for (let i = 0; i < 90; i++) scene.update(1 / 30);
    }

    renderPage();

    window.addEventListener("resize", () => {
      fitStage();
      setIndex(state.index, { sound: false, ignite: false });
    });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    el.stage.addEventListener("wheel", onWheel, { passive: false });
    el.items.tabIndex = 0;
    el.items.focus({ preventScroll: true });

    requestAnimationFrame((t) => {
      last = t;
      frame(t);
      runIntro();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
