/* =====================================================================
   COSA NOSTRA — LOAD GAME SCREEN
   Opens from the main menu's "Load Game" button. Three save slots as
   index cards in the case file (same animated desk as Options).

   Hook your game up:
     CosaLoad.onLoad((save) => { startGame(save.data); });
   The screen blinks the card, fades to black, then calls your function
   with the save (see saves.js for what a save holds). The menu music
   keeps playing; call CosaMenu.stopMusic() when your game takes over.
   ===================================================================== */
(function () {
  "use strict";

  const menu = window.CosaMenu;
  const saves = window.CosaSaves;
  if (!menu || !saves || !window.CosaDesk) return;

  const cfg = Object.assign({
    title: "Load Game",
    backLabel: "Back to Main Menu",
    emptyTitle: "Empty Slot",
    emptyLine: "No family saved",
    emptyToast: "Empty",
    playTimeLabel: "Play Time",
    // Shown only while no real save exists yet, so the screen isn't empty
    // during development. Set to false before release.
    exampleSaves: true,
    examples: [
      { family: "The Moretti Family", don: "Don Salvatore", date: "10/24/1947", playTime: 31335, thumbnail: "assets/loadgame/example-1.jpg" },
      { family: "The Esposito Family", don: "Don Carmine", date: "10/18/1947", playTime: 15332, thumbnail: "assets/loadgame/example-2.jpg" },
      { family: "The Russo Family", don: "Don Aldo", date: "10/12/1947", playTime: 4928, thumbnail: "assets/loadgame/example-3.jpg" }
    ]
  }, (window.MENU_CONFIG && window.MENU_CONFIG.loadGame) || {});

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CARD_TOPS = [90, 182, 274];   // card tops on the sheet (match the concept art)
  const CARD_H = 86;
  const BACK_TOP = 372;

  let root, sheet, titleEl, underline, pointer, clip, backEl, stamp, hintsEl;
  let cards = [];
  let entries = [];        // { save, example, slot } per card
  let index = 0;
  let isOpen = false;
  let busy = false;
  let loadHandler = null;

  /* =================================================================
     DOM
     ================================================================= */
  const FLOURISH = '<svg class="lg-flourish {side}" viewBox="0 0 58 22" aria-hidden="true">' +
    '<path d="M57 11 H22 C 16 11, 12 6, 15 3.5 C 18 1, 22 4, 20 7 C 18 10, 12 9, 11 5 C 10 1, 4 2, 3 6 C 2 10, 6 14, 11 13" />' +
    '<path d="M57 13.5 H30 C 26 13.5, 24 16, 26 18 C 28 20, 31 18, 30 16" />' +
    '</svg>';

  function build() {
    root = document.createElement("div");
    root.className = "options loadgame";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", cfg.title);

    sheet = document.createElement("div");
    sheet.className = "opt-sheet";

    // handwritten title: first letter of each word written larger, like the concept
    titleEl = document.createElement("h2");
    titleEl.className = "opt-title";
    String(cfg.title).toUpperCase().split(" ").forEach((word, i) => {
      if (i) titleEl.appendChild(document.createTextNode(" "));
      const cap = document.createElement("span");
      cap.className = "cap";
      cap.textContent = word.charAt(0);
      titleEl.appendChild(cap);
      titleEl.appendChild(document.createTextNode(word.slice(1)));
    });

    underline = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    underline.setAttribute("class", "opt-underline");
    underline.setAttribute("viewBox", "0 0 210 14");
    underline.innerHTML = '<path d="M1 10 C 40 6.5, 110 4, 170 4.6 C 190 4.8, 202 5.6, 209 6.4 C 203 7.6, 190 8, 170 8.2 C 110 8.6, 45 10.5, 3 12.2 C 0.5 12.4, 0 10.6, 1 10 Z" />';

    const fl = document.createElement("div");
    fl.innerHTML = FLOURISH.replace("{side}", "left") + FLOURISH.replace("{side}", "right");

    pointer = document.createElement("div");
    pointer.className = "lg-pointer";
    pointer.innerHTML =
      '<svg class="opt-arrow" viewBox="0 0 34 30" aria-hidden="true">' +
      '<defs><linearGradient id="lgArrowFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#f6e2a2"/><stop offset="0.5" stop-color="#d1ad5c"/><stop offset="1" stop-color="#8a6a2c"/>' +
      '</linearGradient></defs>' +
      '<path d="M3 2 L31 15 L3 28 L9 15 Z" fill="url(#lgArrowFill)" stroke="#6b5122" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M6 5 L26 15" stroke="rgba(255,250,220,0.75)" stroke-width="1.2" stroke-linecap="round"/>' +
      "</svg>";

    // steel paper clip that hops onto the selected card
    clip = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    clip.setAttribute("class", "lg-clip");
    clip.setAttribute("viewBox", "0 0 20 62");
    clip.innerHTML =
      '<defs><linearGradient id="lgClip" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#6f6a63"/><stop offset="0.45" stop-color="#d9d5cc"/><stop offset="1" stop-color="#7d776e"/>' +
      "</linearGradient></defs>" +
      '<path d="M6 44 V10 C6 4.5, 14 4.5, 14 10 V50 C14 58, 3 58, 3 50 V16" fill="none" stroke="url(#lgClip)" stroke-width="2.4" stroke-linecap="round"/>';

    stamp = document.createElement("div");
    stamp.className = "opt-stamp";

    backEl = document.createElement("div");
    backEl.className = "lg-back";
    backEl.innerHTML = '<span><i class="lg-glow"></i><b class="lg-back-label" style="position:relative;font-weight:inherit"></b></span>';
    backEl.querySelector(".lg-back-label").textContent = cfg.backLabel;

    sheet.append(titleEl, underline, ...fl.children);

    for (let i = 0; i < saves.slots; i++) {
      const c = document.createElement("div");
      c.className = "lg-card";
      c.style.top = CARD_TOPS[i] + "px";
      c.style.setProperty("--i", i);
      c.dataset.index = i;
      c.innerHTML =
        '<i class="lg-glow"></i>' +
        '<div class="lg-text"><div class="lg-title"></div><div class="lg-line l2"></div><div class="lg-line l3"></div></div>' +
        '<div class="lg-thumb"></div>';
      sheet.appendChild(c);
      cards.push(c);
    }
    backEl.dataset.index = saves.slots;
    sheet.append(backEl, pointer, clip, stamp);

    hintsEl = document.createElement("div");
    // same keycap hints as the main menu and Options
    hintsEl.className = "opt-hints";
    hintsEl.innerHTML = [
      ['<kbd class="key">\u2191</kbd><kbd class="key">\u2193</kbd>', "Navigate", ""],
      ['<kbd class="key">Enter</kbd>', "Select", "select"],
      ['<kbd class="key">Esc</kbd>', "Back", "back"]
    ].map(([keys, lab, act]) =>
      `<button type="button" class="hint" tabindex="-1" data-action="${act}"><span class="hint-keys">${keys}</span><span class="hint-label">${lab}</span></button>`
    ).join("");
    hintsEl.addEventListener("mousedown", (e) => e.preventDefault());
    hintsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".hint");
      if (!b || busy) return;
      if (b.dataset.action === "select") activate();
      else if (b.dataset.action === "back") close();
    });

    root.append(sheet, hintsEl);
    menu.stage.appendChild(root);
    wireInput();
  }

  /* =================================================================
     Cards
     ================================================================= */
  function currentEntries() {
    const real = saves.list();
    const useExamples = cfg.exampleSaves && !real.some(Boolean);
    return real.map((save, i) => {
      if (save) return { save, slot: i + 1, example: false };
      if (useExamples && cfg.examples[i]) return { save: Object.assign({ slot: i + 1 }, cfg.examples[i]), slot: i + 1, example: true };
      return { save: null, slot: i + 1, example: false };
    });
  }

  function render() {
    entries = currentEntries();
    entries.forEach((e, i) => {
      const c = cards[i];
      const n = String(i + 1).padStart(2, "0");
      const title = c.querySelector(".lg-title");
      const l2 = c.querySelector(".lg-line.l2");
      const l3 = c.querySelector(".lg-line.l3");
      const thumb = c.querySelector(".lg-thumb");
      thumb.textContent = "";
      c.classList.toggle("is-empty", !e.save);
      if (!e.save) {
        title.textContent = `${n}. ${cfg.emptyTitle}`;
        l2.textContent = cfg.emptyLine;
        l3.textContent = "";
        c.setAttribute("aria-label", `Slot ${i + 1}, empty`);
        return;
      }
      const s = e.save;
      title.textContent = `${n}. ${s.family}`;
      const parts = [s.don, s.date || (s.savedAt ? new Date(s.savedAt).toLocaleDateString() : "")].filter(Boolean);
      l2.textContent = parts.join(" - ");
      l3.textContent = `${cfg.playTimeLabel}: ${saves.formatPlayTime(s.playTime)}`;
      if (s.thumbnail) {
        const img = document.createElement("img");
        img.alt = "";
        img.src = s.thumbnail;
        img.onerror = () => { thumb.innerHTML = '<span class="no-photo">NO PHOTO</span>'; };
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = '<span class="no-photo">NO PHOTO</span>';
      }
      c.setAttribute("aria-label", `Slot ${i + 1}, ${s.family}, ${l2.textContent}, ${l3.textContent}`);
    });
  }

  /* Long family or Don names shrink a little to fit instead of being cut
     off. Every card uses the same sizes so the file stays neat. */
  function fitText() {
    const fit = (sel, size, min) => {
      let fs = size;
      const nodes = cards.map((c) => c.querySelector(sel));
      for (const node of nodes) {
        node.style.fontSize = fs + "px";
        while (node.scrollWidth > node.clientWidth + 0.5 && fs > min) {
          fs -= 0.5;
          node.style.fontSize = fs + "px";
        }
      }
      return fs;
    };
    const title = fit(".lg-title", 26, 17);
    const line = Math.min(fit(".lg-line.l2", 21, 16), fit(".lg-line.l3", 21, 16));
    for (const c of cards) {
      c.querySelector(".lg-title").style.fontSize = title + "px";
      c.querySelectorAll(".lg-line").forEach((n) => { n.style.fontSize = line + "px"; });
    }
  }

  /* =================================================================
     Selection
     ================================================================= */
  const count = () => saves.slots + 1;     // cards + "back"

  function select(i, sound) {
    i = (i + count()) % count();
    const changed = i !== index;
    index = i;
    const all = [...cards, backEl];
    all.forEach((el, k) => el.classList.toggle("is-active", k === i));
    const onCard = i < saves.slots;
    const y = onCard ? CARD_TOPS[i] + CARD_H / 2 - 15 : BACK_TOP - 2;
    pointer.style.transform = `translate(${onCard ? 0 : 40}px, ${y}px)`;
    // the clip only holds a card; it lifts off when "back" is selected
    clip.classList.toggle("is-hidden", !onCard);
    if (onCard) clip.style.transform = `translateY(${CARD_TOPS[i] - 26}px)`;
    if (changed) {
      const glow = all[i].querySelector(".lg-glow");
      glow.classList.remove("ignite");
      void glow.offsetWidth;
      glow.classList.add("ignite");
      if (sound !== false) menu.sfx("hover");
    }
  }

  async function activate() {
    if (busy || !isOpen) return;
    if (index >= saves.slots) return close();
    const e = entries[index];
    const card = cards[index];
    if (!e.save) {
      menu.sfx("error");
      card.classList.remove("is-shaking");
      void card.offsetWidth;
      card.classList.add("is-shaking");
      setTimeout(() => card.classList.remove("is-shaking"), 450);
      stampToast(cfg.emptyToast, CARD_TOPS[index] + 24);
      return;
    }
    busy = true;
    menu.sfx("select");
    card.classList.add("is-blinking");
    await wait(reducedMotion ? 200 : 480);
    card.classList.remove("is-blinking");
    await menu.fadeOut(600);
    hide();
    const save = e.example ? null : saves.get(e.slot);
    if (save && loadHandler) {
      try {
        await loadHandler(save, e.slot);
      } catch (err) {
        console.error("[load] your load handler failed:", err);
        menu.show();
      }
    } else if (save) {
      menu.placeholder(save.family, "Save loaded. Hook up CosaLoad.onLoad to start the game.");
    } else {
      menu.placeholder(e.save.family, "Example save. Real saves appear here once the game uses CosaSaves.save.");
    }
    busy = false;
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
  function wireInput() {
    // capture phase so the main menu underneath never sees these keys
    window.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      e.stopPropagation();
      document.body.classList.add("hide-cursor");
      menu.unlockAudio();
      const k = e.key;
      if (k === "F11" || k === "F12" || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (busy) return;
      if (k === "ArrowUp" || k === "w" || k === "W" || (k === "Tab" && e.shiftKey)) { press("\u2191"); select(index - 1); }
      else if (k === "ArrowDown" || k === "s" || k === "S" || k === "Tab") { press("\u2193"); select(index + 1); }
      else if (k === "Home") select(0);
      else if (k === "End") select(count() - 1);
      else if (k === "Enter" || k === " ") { if (!e.repeat) { press("Enter"); activate(); } }
      else if (k === "Escape" || k === "Backspace") { if (!e.repeat) { press("Esc"); close(); } }
    }, true);

    root.addEventListener("pointermove", (e) => {
      document.body.classList.remove("hide-cursor");
      if (busy) return;
      const t = e.target.closest(".lg-card, .lg-back");
      if (t) {
        const i = +t.dataset.index;
        if (i !== index) select(i);
      }
    });
    root.addEventListener("pointerdown", (e) => {
      menu.unlockAudio();
      if (e.button === 2 && !busy) close();
    });
    root.addEventListener("click", (e) => {
      if (busy) return;
      const t = e.target.closest(".lg-card, .lg-back");
      if (!t) return;
      const i = +t.dataset.index;
      if (i !== index) select(i, false);
      activate();
    });
    root.addEventListener("wheel", (e) => {
      if (busy) return;
      e.preventDefault();
      const now = performance.now();
      if (now - (root._wheelT || 0) < 90) return;
      root._wheelT = now;
      select(index + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
    root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function press(keyText) {
    const key = [...hintsEl.querySelectorAll(".key")].find((k) => k.textContent === keyText);
    if (!key) return;
    key.classList.add("is-pressed");
    setTimeout(() => key.classList.remove("is-pressed"), 130);
  }

  /* =================================================================
     Open / close
     ================================================================= */
  async function open() {
    if (!root) build();
    await window.CosaDesk.ready;
    window.CosaDesk.attach(root, sheet, hintsEl);
    window.CosaDesk.start();
    render();
    // start on the first slot that has a save
    const first = entries.findIndex((e) => e.save);
    index = -1;
    root.hidden = false;
    fitText();
    root.classList.remove("is-open", "is-ready");
    titleEl.classList.remove("is-written");
    underline.classList.remove("is-drawn");
    select(first >= 0 ? first : saves.slots, false);
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
    busy = false;
  }

  function hide() {
    isOpen = false;
    window.CosaDesk.stop();
    root.hidden = true;
    if (menu.scene) menu.scene.paused = false;
  }

  async function close() {
    if (!isOpen || busy) return;
    busy = true;
    menu.sfx("back");
    await menu.fadeOut(500);
    hide();
    busy = false;
    menu.show();
  }

  /* keep the main menu's Load Game button in step with the saves */
  function syncMenuButton() {
    const any = saves.hasAny() || cfg.exampleSaves;
    menu.setEnabled("load", any);
  }

  /* =================================================================
     Public API + hook into the main menu
     ================================================================= */
  window.CosaLoad = {
    open,
    close,
    /** Called with (save, slot) when the player loads a save. */
    onLoad(fn) { loadHandler = fn; return window.CosaLoad; }
  };

  menu.on("load-game", () => { open(); });
  saves.onChange(() => { syncMenuButton(); if (isOpen) { render(); fitText(); select(index, false); } });
  syncMenuButton();
})();
