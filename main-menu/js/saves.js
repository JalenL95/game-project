/* =====================================================================
   COSA NOSTRA — SAVE SLOTS
   A small save system the Load Game screen reads from. Your game writes
   to it; saves are kept in the browser's storage on this computer.

     CosaSaves.save(1, {
       family:   "The Moretti Family",   // shown as the save's title
       don:      "Don Salvatore",        // optional second-line name
       date:     "10/24/1947",           // in-game date, any text
       playTime: 31335,                  // seconds (or "08:42:15")
       thumbnail: "data:image/jpeg;...", // optional picture (URL or data URL)
       data:     { ...your game state... }
     });
     CosaSaves.get(1)      -> the save, or null
     CosaSaves.list()      -> [slot1, slot2, slot3] (null = empty)
     CosaSaves.remove(1)   CosaSaves.clear()
     CosaSaves.onChange(fn)
   ===================================================================== */
(function () {
  "use strict";

  const KEY = "cosanostra.saves";
  const cfg = (window.MENU_CONFIG && window.MENU_CONFIG.loadGame) || {};
  const SLOTS = Math.max(1, Math.min(3, cfg.slots || 3));   // the case file has room for 3 cards
  const listeners = [];

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      return raw && raw.slots ? raw : { version: 1, slots: {} };
    } catch (e) {
      return { version: 1, slots: {} };
    }
  }

  function write(store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      console.error("[saves] could not write save data:", e);
      return false;
    }
  }

  function notify() {
    const list = api.list();
    for (const fn of listeners) {
      try { fn(list); } catch (e) { console.error(e); }
    }
  }

  function checkSlot(slot) {
    const n = Number(slot);
    if (!Number.isInteger(n) || n < 1 || n > SLOTS) throw new Error(`Save slot must be 1-${SLOTS}, got ${slot}`);
    return n;
  }

  /** "08:42:15" from seconds; text is passed through. */
  function formatPlayTime(t) {
    if (typeof t === "string") return t;
    const s = Math.max(0, Math.floor(Number(t) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
  }

  const api = {
    slots: SLOTS,
    formatPlayTime,

    list() {
      const store = read();
      const out = [];
      for (let i = 1; i <= SLOTS; i++) out.push(store.slots[i] || null);
      return out;
    },

    get(slot) {
      return read().slots[checkSlot(slot)] || null;
    },

    hasAny() {
      return api.list().some(Boolean);
    },

    save(slot, info) {
      const n = checkSlot(slot);
      if (!info || !info.family) throw new Error("A save needs at least a family name");
      const store = read();
      store.slots[n] = {
        slot: n,
        family: String(info.family),
        don: info.don ? String(info.don) : "",
        date: info.date ? String(info.date) : "",
        playTime: info.playTime == null ? 0 : info.playTime,
        thumbnail: info.thumbnail || "",
        data: info.data == null ? null : info.data,
        savedAt: new Date().toISOString()
      };
      const ok = write(store);
      if (ok) notify();
      return ok;
    },

    remove(slot) {
      const n = checkSlot(slot);
      const store = read();
      delete store.slots[n];
      write(store);
      notify();
    },

    clear() {
      write({ version: 1, slots: {} });
      notify();
    },

    onChange(fn) {
      listeners.push(fn);
      return api;
    }
  };

  window.CosaSaves = api;
})();
