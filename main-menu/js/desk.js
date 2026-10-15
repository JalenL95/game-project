/* =====================================================================
   COSA NOSTRA — ANIMATED DESK
   The desk behind the Options and Load Game screens: the lamp hums and
   now and then stutters (dimming the whole room), the cigarette in the
   ashtray smoulders and a thin thread of smoke curls up from it.
   One shared instance, so moving between those screens is seamless.

   CosaDesk.attach(layer, beforeNode, shadeBeforeNode) puts the desk into
   a screen; CosaDesk.start() / CosaDesk.stop() run and pause it.
   ===================================================================== */
(function () {
  "use strict";

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const menu = window.CosaMenu;
  if (!menu) return;

  const cfg = Object.assign({
    background: "assets/options/desk.jpg",
    lamp: { x: 1088, y: 120 },          // desk lamp bulb (stage coordinates)
    cigarette: { x: 1113, y: 508 },     // where smoke leaves the cigarette
    ember: { x: 1120, y: 515 },         // glowing tip
    paintedSmoke: { x: 1040, y: 300, w: 100, h: 200 }
  }, (window.MENU_CONFIG && window.MENU_CONFIG.desk) || {});

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "opt-scene";
  const ctx = canvas.getContext("2d");
  // the room dims with the lamp: this sits above the paper so ink and paper dim together
  const shade = document.createElement("div");
  shade.className = "opt-shade";
  let active = false;

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
  window.addEventListener("resize", () => { if (active) resize(); });

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
    if (active) {
      update(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  // pre-roll so smoke is already rising the first time the screen opens
  scene.ready.then(() => { for (let i = 0; i < 260; i++) update(1 / 40); });


  window.CosaDesk = {
    ready: scene.ready,
    /** Put the desk into a screen: canvas before `beforeNode`, room shade before `shadeBefore`. */
    attach(layer, beforeNode, shadeBefore) {
      layer.insertBefore(canvas, beforeNode || layer.firstChild);
      layer.insertBefore(shade, shadeBefore || null);
    },
    start() {
      resize();
      active = true;
      update(0);
      draw();
    },
    stop() { active = false; }
  };
})();
