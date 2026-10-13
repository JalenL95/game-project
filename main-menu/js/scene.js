/* =====================================================================
   COSA NOSTRA — ANIMATED BACKGROUND
   Draws the painted bar interior and brings it to life on a <canvas>:
   rain + droplets on the window glass, lightning, passing headlights,
   flickering neon, breathing lamps and chandelier, cigar smoke with
   glowing embers, swaying painted smoke, dust in the light, film grain.

   All coordinates are on the 1280 x 720 stage (see menu.config.js).
   ===================================================================== */
(function () {
  "use strict";

  const STAGE_W = 1280;
  const STAGE_H = 720;
  const CAMERA_ZOOM = 1.035;   // slight overscan so parallax never shows an edge

  /* ---------- small helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  function makeNoise(seed) {
    const hash = (n) => {
      const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return (t) => {
      const i = Math.floor(t);
      const f = t - i;
      return lerp(hash(i), hash(i + 1), smooth(f));
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn("[menu] could not load image:", src);
        resolve(null);
      };
      img.src = src;
    });
  }

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Soft round light sprite, cached per colour. */
  const glowCache = new Map();
  function glowSprite(color) {
    if (glowCache.has(color)) return glowCache.get(color);
    const [r, g, b] = hexToRgb(color);
    const c = makeCanvas(128, 128);
    const x = c.getContext("2d");
    const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.25, `rgba(${r},${g},${b},0.55)`);
    grd.addColorStop(0.6, `rgba(${r},${g},${b},0.14)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, 128, 128);
    glowCache.set(color, c);
    return c;
  }

  /* Irregular smoke puff made from overlapping soft blobs. */
  function smokeSprite() {
    const c = makeCanvas(96, 96);
    const x = c.getContext("2d");
    for (let i = 0; i < 9; i++) {
      const px = 48 + rand(-16, 16);
      const py = 48 + rand(-16, 16);
      const pr = rand(14, 30);
      const grd = x.createRadialGradient(px, py, 0, px, py, pr);
      grd.addColorStop(0, "rgba(236,230,220,0.22)");
      grd.addColorStop(1, "rgba(236,230,220,0)");
      x.fillStyle = grd;
      x.beginPath();
      x.arc(px, py, pr, 0, Math.PI * 2);
      x.fill();
    }
    return c;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =================================================================
     Scene
     ================================================================= */
  class MenuScene {
    constructor(canvas, cfg) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.cfg = cfg || {};
      this.reducedMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      this.time = 0;
      this.scale = 1;
      this.debug = false;

      this.pointer = { x: 0, y: 0 };      // -1..1, set by the menu
      this.cam = { x: 0, y: 0 };
      this.mouseStage = { x: 0, y: 0 };   // for the F3 readout

      this.pulseLevel = 0;                // brief warm surge when an item is picked
      this.brownout = { t: 0, next: rand(18, 34) };
      this.noiseA = makeNoise(1.7);
      this.noiseB = makeNoise(9.3);
      this.noiseC = makeNoise(4.1);
    }

    async load() {
      const bg = this.cfg;
      const win = bg.window || {};
      const [image, mask] = await Promise.all([
        loadImage(bg.image),
        win.enabled ? loadImage(win.mask) : Promise.resolve(null)
      ]);
      this.image = image;
      this.mask = mask;
      this.anim = await this.loadAnimation(bg.animation);
      // with real animation playing, the painted-on effects are optional
      this.effects = bg.effects !== false && (!this.anim || !!bg.animation.keepEffects);
      this.fit = this.anim
        ? this.computeFit(this.anim.width, this.anim.height)
        : this.computeFit(image && image.naturalWidth, image && image.naturalHeight);
      this.buildEffects();
    }

    /* ---------------- frame-by-frame / video background ---------------- */
    async loadAnimation(a) {
      if (!a || a.enabled === false) return null;

      if (a.video) {
        const v = document.createElement("video");
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.setAttribute("aria-hidden", "true");
        v.disablePictureInPicture = true;
        // The video sits on the page behind the canvas. Browsers pause or
        // freeze videos that aren't on the page, so it can't stay hidden.
        v.className = "bg-video";
        this.canvas.parentNode.insertBefore(v, this.canvas);
        const tryLoad = (src) => new Promise((resolve) => {
          const done = (r) => {
            clearTimeout(timer);
            v.removeEventListener("loadeddata", onLoad);
            v.removeEventListener("error", onError);
            resolve(r);
          };
          const onLoad = () => done(true);
          const onError = () => done(false);
          const timer = setTimeout(() => done(false), 10000);
          v.addEventListener("loadeddata", onLoad);
          v.addEventListener("error", onError);
          v.src = src;
        });
        // a list of files: try each in order until one plays in this browser
        const sources = Array.isArray(a.video) ? a.video : [a.video];
        let ok = false;
        for (const src of sources) {
          ok = await tryLoad(src);
          if (ok) break;
          console.warn("[menu] could not play background video:", src);
        }
        if (ok) {
          if (a.playbackRate) v.playbackRate = a.playbackRate;
          const play = () => v.play().catch(() => {});
          play();
          // some browsers only start video after the first click or key press
          window.addEventListener("pointerdown", play, { once: true });
          window.addEventListener("keydown", play, { once: true });
          return { type: "video", el: v, width: v.videoWidth, height: v.videoHeight, play, lastTime: -1, stall: 0 };
        }
        v.remove();
      }

      if (a.slides && a.slides.images && a.slides.images.length) {
        const sl = a.slides;
        const entries = sl.images.map((it) => (typeof it === "string" ? { src: it } : it));
        const imgs = await Promise.all(entries.map((e) => loadImage(e.src)));
        let slides = entries
          .map((e, i) => ({ img: imgs[i], focus: e.focus || [0.5, 0.5] }))
          .filter((x) => x.img);
        if (slides.length < entries.length) console.warn(`[menu] ${entries.length - slides.length} slide image(s) failed to load`);
        if (slides.length) {
          if (sl.shuffle) {
            for (let i = slides.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [slides[i], slides[j]] = [slides[j], slides[i]];
            }
          }
          return {
            type: "slides",
            slides,
            duration: Math.max(1, sl.duration || 7),
            fade: clamp(sl.fade == null ? 1.8 : sl.fade, 0, Math.max(1, sl.duration || 7)),
            zoom: this.reducedMotion ? 1 : Math.max(1, sl.zoom || 1.1),
            t: 0,
            width: slides[0].img.naturalWidth,
            height: slides[0].img.naturalHeight
          };
        }
      }

      let list = [];
      if (Array.isArray(a.frames)) list = a.frames;
      else if (a.frames && a.frames.pattern) {
        const start = a.frames.start == null ? 1 : a.frames.start;
        const pat = a.frames.pattern;
        const m = pat.match(/#+/);
        for (let i = 0; i < (a.frames.count || 0); i++) {
          const n = String(start + i);
          list.push(m ? pat.replace(m[0], n.padStart(m[0].length, "0")) : pat + n);
        }
      }
      if (!list.length) return null;

      const imgs = (await Promise.all(list.map(loadImage))).filter(Boolean);
      if (!imgs.length) return null;
      if (imgs.length < list.length) console.warn(`[menu] ${list.length - imgs.length} animation frame(s) failed to load`);
      return {
        type: "frames",
        imgs,
        fps: a.fps || 12,
        mode: a.mode === "pingpong" ? "pingpong" : "loop",
        blend: clamp(a.blend || 0, 0, 1),
        t: 0,
        width: imgs[0].naturalWidth,
        height: imgs[0].naturalHeight
      };
    }

    /* Which frame is showing, and how far into the next one (for blending). */
    frameAt(anim) {
      const n = anim.imgs.length;
      if (n === 1) return { a: anim.imgs[0], b: null, k: 0 };
      const f = anim.t * anim.fps;
      const whole = Math.floor(f);
      const k = f - whole;
      let i, j;
      if (anim.mode === "pingpong") {
        const period = 2 * n - 2;
        const p = whole % period;
        const q = (p + 1) % period;
        i = p < n ? p : period - p;
        j = q < n ? q : period - q;
      } else {
        i = whole % n;
        j = (i + 1) % n;
      }
      return { a: anim.imgs[i], b: anim.imgs[j], k };
    }

    /* Keep the video running: restart it if the browser paused or froze it. */
    watchVideo(dt) {
      const a = this.anim;
      const v = a.el;
      if (document.hidden) return;
      if (v.paused || v.ended) {
        a.stall += dt;
        if (a.stall > 0.5) {
          a.stall = 0;
          a.play();
        }
        return;
      }
      if (v.currentTime === a.lastTime) {
        a.stall += dt;
        if (a.stall > 1.5) {
          // stuck on one frame while "playing": nudge it
          a.stall = 0;
          const t = v.currentTime;
          v.currentTime = t + 0.04 < v.duration ? t + 0.04 : 0;
          a.play();
        }
      } else {
        a.stall = 0;
        a.lastTime = v.currentTime;
      }
    }

    /* Slideshow: each picture slowly pushes in or pulls out (the
       "Ken Burns" move) and dissolves into the next one. */
    drawSlides(ctx, anim) {
      const n = anim.slides.length;
      const k = Math.floor(anim.t / anim.duration);
      const local = anim.t - k * anim.duration;
      const span = anim.duration + anim.fade;
      if (k > 0 && local < anim.fade && n > 1) {
        this.drawSlide(ctx, anim, k - 1, (local + anim.duration) / span, 1);
        this.drawSlide(ctx, anim, k, local / span, smooth(local / anim.fade));
      } else {
        this.drawSlide(ctx, anim, k, local / span, 1);
      }
    }

    drawSlide(ctx, anim, k, p, alpha) {
      const slide = anim.slides[k % anim.slides.length];
      const img = slide.img;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const base = Math.max(STAGE_W / iw, STAGE_H / ih);
      // alternate pushing in and pulling out so consecutive slides feel different
      const zoomIn = k % 2 === 0;
      const z = zoomIn ? lerp(1, anim.zoom, p) : lerp(anim.zoom, 1, p);
      const f = slide.focus;
      const fx = zoomIn ? lerp(0.5, f[0], p) : lerp(f[0], 0.5, p);
      const fy = zoomIn ? lerp(0.5, f[1], p) : lerp(f[1], 0.5, p);
      const dw = iw * base * z;
      const dh = ih * base * z;
      // keep the picture covering the whole stage while it drifts
      const cx = clamp(fx, STAGE_W / (2 * dw), 1 - STAGE_W / (2 * dw));
      const cy = clamp(fy, STAGE_H / (2 * dh), 1 - STAGE_H / (2 * dh));
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, STAGE_W / 2 - cx * dw, STAGE_H / 2 - cy * dh, dw, dh);
      ctx.globalAlpha = 1;
    }

    drawBackground(ctx) {
      const f = this.fit;
      const anim = this.anim;
      if (anim && anim.type === "video") {
        // the <video> element shows itself behind the canvas; just move it with the camera
        anim.el.style.transform =
          `translate(${this.cam.x.toFixed(2)}px, ${this.cam.y.toFixed(2)}px) scale(${CAMERA_ZOOM})`;
        return;
      }
      if (anim && anim.type === "slides") {
        this.drawSlides(ctx, anim);
        return;
      }
      if (anim && anim.type === "frames") {
        const fr = this.frameAt(anim);
        ctx.drawImage(fr.a, f.x, f.y, f.w, f.h);
        if (anim.blend > 0 && fr.b && fr.k > 0) {
          ctx.globalAlpha = smooth(fr.k) * anim.blend;
          ctx.drawImage(fr.b, f.x, f.y, f.w, f.h);
          ctx.globalAlpha = 1;
        }
        return;
      }
      if (this.image) ctx.drawImage(this.image, f.x, f.y, f.w, f.h);
    }

    computeFit(iw, ih) {
      if (!iw || !ih) return { x: 0, y: 0, s: 1, w: STAGE_W, h: STAGE_H };
      const s = Math.max(STAGE_W / iw, STAGE_H / ih);
      return { s, w: iw * s, h: ih * s, x: (STAGE_W - iw * s) / 2, y: (STAGE_H - ih * s) / 2 };
    }

    /* Called by the menu whenever the stage is resized. */
    resize(renderScale) {
      const s = clamp(renderScale, 0.5, 2);
      this.scale = s;
      this.canvas.width = Math.round(STAGE_W * s);
      this.canvas.height = Math.round(STAGE_H * s);
      if (this.win) {
        this.win.layer.width = Math.ceil(this.win.w * s);
        this.win.layer.height = Math.ceil(this.win.h * s);
      }
      this.buildVignette();
    }

    setPointer(nx, ny) {
      this.pointer.x = clamp(nx, -1, 1);
      this.pointer.y = clamp(ny, -1, 1);
    }

    /* Stage-space mouse position, used for the debug coordinate readout. */
    setMouseStage(x, y) {
      this.mouseStage.x = x;
      this.mouseStage.y = y;
    }

    pulse(strength) {
      this.pulseLevel = Math.max(this.pulseLevel, strength == null ? 1 : strength);
    }

    /* ---------------- setup ---------------- */
    buildEffects() {
      const bg = this.cfg;
      const rm = this.reducedMotion;

      /* Window: rain, droplets, lightning, cars */
      const w = bg.window;
      if (w && w.enabled && this.mask) {
        this.win = {
          x: w.x, y: w.y, w: w.w, h: w.h,
          layer: makeCanvas(w.w, w.h),
          streaks: [],
          drops: [],
          lightning: { level: 0, seq: null, next: rand(6, 12) },
          car: null,
          nextCar: rand(3, 8)
        };
        const n = Math.round(w.rain == null ? 260 : w.rain);
        for (let i = 0; i < n; i++) this.win.streaks.push(this.newStreak(true));
        const d = Math.round(w.droplets == null ? 30 : w.droplets);
        for (let i = 0; i < d; i++) this.win.drops.push(this.newDrop(true));
      }

      /* Neon signs */
      this.neons = (bg.neon || []).map((n) => ({
        ...n,
        level: 1,
        target: 1,
        seq: null,
        next: rand(2, 8) / Math.max(0.05, n.flicker || 0.5),
        glow: this.buildNeonGlow(n),
        dark: this.buildNeonDark(n),
        noise: makeNoise(rand(0, 100))
      }));

      /* Lights */
      this.lights = (bg.lights || []).map((l) => ({
        ...l,
        sprite: glowSprite(l.color || "#ffd59a"),
        noise: makeNoise(rand(0, 100))
      }));

      /* Smoke */
      this.smokeSprites = [smokeSprite(), smokeSprite(), smokeSprite()];
      this.smoke = [];
      this.emitters = (bg.smoke || []).map((e) => ({
        ...e,
        acc: 0,
        ember: e.ember ? { level: 0.35, phase: "idle", t: 0, next: rand(3, 9) } : null
      }));

      /* Dust */
      const dust = bg.dust || { count: 0 };
      this.dust = [];
      for (let i = 0; i < (rm ? Math.min(20, dust.count) : dust.count); i++) {
        this.dust.push({
          x: dust.x + Math.random() * dust.w,
          y: dust.y + Math.random() * dust.h,
          vx: rand(-4, 4),
          vy: rand(-3, 3),
          size: rand(0.5, 1.5),
          phase: rand(0, 6.28)
        });
      }

      /* Film grain */
      this.grain = [];
      if (bg.filmGrain > 0) {
        for (let i = 0; i < 4; i++) {
          const c = makeCanvas(192, 192);
          const x = c.getContext("2d");
          const img = x.createImageData(192, 192);
          for (let p = 0; p < img.data.length; p += 4) {
            const v = Math.random() * 255;
            img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
            img.data[p + 3] = 255;
          }
          x.putImageData(img, 0, 0);
          this.grain.push(c);
        }
        this.grainPatterns = this.grain.map((c) => this.ctx.createPattern(c, "repeat"));
      }
    }

    buildNeonGlow(n) {
      const pad = 34;
      const c = makeCanvas(n.w + pad * 2, n.h + pad * 2);
      const x = c.getContext("2d");
      x.shadowColor = n.color;
      x.shadowBlur = 22;
      x.strokeStyle = n.color;
      x.lineWidth = 3;
      roundRectPath(x, pad, pad, n.w, n.h, 5);
      x.stroke();
      x.shadowBlur = 0;
      x.globalAlpha = 0.16;
      x.fillStyle = n.color;
      x.fill();
      if (n.rim) {
        x.globalAlpha = 1;
        x.shadowColor = n.rim;
        x.shadowBlur = 14;
        x.strokeStyle = n.rim;
        x.lineWidth = 1.5;
        roundRectPath(x, pad - 2, pad - 2, n.w + 4, n.h + 4, 6);
        x.stroke();
      }
      return { canvas: c, pad };
    }

    buildNeonDark(n) {
      const pad = 16;
      const c = makeCanvas(n.w + pad * 2, n.h + pad * 2);
      const x = c.getContext("2d");
      x.shadowColor = "rgba(8,10,18,1)";
      x.shadowBlur = 10;
      x.fillStyle = "rgba(8,10,18,1)";
      roundRectPath(x, pad, pad, n.w, n.h, 4);
      x.fill();
      return { canvas: c, pad };
    }

    buildVignette() {
      const v = this.cfg.vignette || 0;
      if (v <= 0) {
        this.vignette = null;
        return;
      }
      const c = makeCanvas(640, 360);
      const x = c.getContext("2d");
      const grd = x.createRadialGradient(400, 170, 80, 360, 180, 520);
      grd.addColorStop(0, "rgba(0,0,0,0)");
      grd.addColorStop(0.55, `rgba(0,0,0,${v * 0.25})`);
      grd.addColorStop(1, `rgba(0,0,0,${v})`);
      x.fillStyle = grd;
      x.fillRect(0, 0, 640, 360);
      this.vignette = c;
    }

    newStreak(scatter) {
      const w = this.win;
      const z = Math.random();
      return {
        x: rand(-20, w.w + 10),
        y: scatter ? rand(-40, w.h) : rand(-60, -10),
        z,
        len: 7 + z * 22,
        speed: 520 + z * 900,
        alpha: 0.1 + z * 0.3
      };
    }

    newDrop(scatter) {
      const w = this.win;
      return {
        x: rand(4, w.w - 4),
        y: rand(4, w.h - 10),
        r: rand(0.9, 2.6),
        grow: scatter ? 1 : 0,
        vy: 0,
        sliding: false,
        nextSlide: rand(1, 14),
        trail: [],
        wobble: rand(0, 6.28)
      };
    }

    /* =================================================================
       update
       ================================================================= */
    update(dt) {
      this.time += dt;
      const t = this.time;
      const bg = this.cfg;
      const rm = this.reducedMotion;

      /* camera: mouse parallax + slow breathing drift */
      const par = rm ? 0 : bg.parallax || 0;
      let tx = -this.pointer.x * par;
      let ty = -this.pointer.y * par * 0.6;
      if (bg.drift && !rm) {
        tx += Math.sin(t * 0.13) * 3.2 + Math.sin(t * 0.071) * 2;
        ty += Math.cos(t * 0.11) * 2;
      }
      const k = 1 - Math.pow(0.0025, dt);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;

      this.pulseLevel = Math.max(0, this.pulseLevel - dt * 1.6);

      /* chandelier brownout: the power dips for a moment */
      const bo = this.brownout;
      if (bg.lightFlicker && !rm) {
        bo.next -= dt;
        if (bo.next <= 0) {
          bo.t = 0.55;
          bo.next = rand(20, 40);
        }
        bo.t = Math.max(0, bo.t - dt);
      }

      if (this.anim && (this.anim.type === "frames" || this.anim.type === "slides")) this.anim.t += dt;
      if (this.anim && this.anim.type === "video") this.watchVideo(dt);
      if (!this.effects) return;
      if (this.win) this.updateWindow(dt);
      this.updateNeon(dt);
      this.updateSmoke(dt);
      this.updateDust(dt);
    }

    /* Room light multiplier, shared by lights and the ambient flicker. */
    roomLight() {
      if (!this.cfg.lightFlicker || this.reducedMotion) return 1;
      const t = this.time;
      let v = 1 + (this.noiseA(t * 2.3) - 0.5) * 0.06 + (this.noiseB(t * 9) - 0.5) * 0.03;
      const bo = this.brownout.t;
      if (bo > 0) {
        // stutter: dim, catch, dim, recover
        const p = 1 - bo / 0.55;
        const dip = p < 0.25 ? 0.62 : p < 0.4 ? 0.95 : p < 0.6 ? 0.7 : lerp(0.7, 1, (p - 0.6) / 0.4);
        v *= dip;
      }
      return v;
    }

    updateWindow(dt) {
      const w = this.win;
      const cfg = this.cfg.window;
      const rm = this.reducedMotion;
      const wind = 0.085 + Math.sin(this.time * 0.21) * 0.035;
      w.wind = wind;

      for (const s of w.streaks) {
        s.y += s.speed * dt;
        s.x += s.speed * wind * dt;
        if (s.y - s.len > w.h || s.x > w.w + 30) Object.assign(s, this.newStreak(false));
      }

      for (let i = 0; i < w.drops.length; i++) {
        const d = w.drops[i];
        d.grow = Math.min(1, d.grow + dt * 0.8);
        if (!d.sliding) {
          d.nextSlide -= dt;
          if (d.nextSlide <= 0 && d.r > 1.5) {
            d.sliding = true;
            d.vy = rand(30, 90);
          }
        } else {
          d.wobble += dt * 6;
          d.x += Math.sin(d.wobble) * 6 * dt;
          d.y += d.vy * dt;
          d.vy = clamp(d.vy + rand(-60, 40) * dt, 10, 140);
          if (Math.random() < dt * 0.6) {
            d.sliding = false;
            d.nextSlide = rand(0.4, 4);
          }
          if (d.trail.length === 0 || d.y - d.trail[d.trail.length - 1].y > 5) {
            d.trail.push({ x: d.x, y: d.y, a: 1 });
          }
          d.r = Math.max(1.2, d.r - dt * 0.12);
        }
        for (const p of d.trail) p.a -= dt * 0.35;
        while (d.trail.length && d.trail[0].a <= 0) d.trail.shift();
        if (d.y > w.h + 6) w.drops[i] = this.newDrop(false);
      }

      /* lightning */
      const L = w.lightning;
      if (cfg.lightning && !rm) {
        L.next -= dt;
        if (!L.seq && L.next <= 0) {
          const big = Math.random() < 0.5;
          L.seq = { t: 0, keys: big
            ? [[0, 0], [0.04, 0.85], [0.1, 0.05], [0.16, 0.55], [0.22, 0.1], [0.3, 1], [1.1, 0]]
            : [[0, 0], [0.05, 0.55], [0.12, 0.08], [0.2, 0.4], [0.8, 0]] };
          const ev = cfg.lightningEvery || [14, 30];
          L.next = rand(ev[0], ev[1]);
        }
      }
      if (L.seq) {
        L.seq.t += dt;
        const keys = L.seq.keys;
        let lvl = 0;
        for (let i = 0; i < keys.length - 1; i++) {
          const [t0, v0] = keys[i];
          const [t1, v1] = keys[i + 1];
          if (L.seq.t >= t0 && L.seq.t < t1) {
            lvl = lerp(v0, v1, (L.seq.t - t0) / (t1 - t0));
            break;
          }
        }
        if (L.seq.t >= keys[keys.length - 1][0]) L.seq = null;
        L.level = lvl;
      } else {
        L.level = 0;
      }

      /* passing cars */
      if (cfg.cars) {
        w.nextCar -= dt;
        if (!w.car && w.nextCar <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          w.car = {
            dir,
            x: dir > 0 ? -140 : w.w + 140,
            y: rand(462, 474) - w.y,
            speed: rand(110, 190),
            bright: rand(0.7, 1)
          };
          const ev = cfg.carsEvery || [9, 20];
          w.nextCar = rand(ev[0], ev[1]);
        }
        if (w.car) {
          w.car.x += w.car.dir * w.car.speed * dt;
          if (w.car.x < -200 || w.car.x > w.w + 200) w.car = null;
        }
      }
    }

    updateNeon(dt) {
      const rm = this.reducedMotion;
      for (const n of this.neons) {
        if (!rm && n.flicker > 0) {
          n.next -= dt;
          if (!n.seq && n.next <= 0) {
            const steps = [];
            const roll = Math.random();
            if (roll < 0.22) {
              // dies for a moment, then buzzes back to life
              steps.push([rand(0.4, 1.3), 0.05]);
              for (let i = 0; i < 4; i++) steps.push([rand(0.03, 0.08), i % 2 ? 0.1 : 0.9]);
            } else {
              const c = 2 + Math.floor(Math.random() * 5);
              for (let i = 0; i < c; i++) steps.push([rand(0.025, 0.11), i % 2 ? 1 : rand(0.05, 0.4)]);
            }
            steps.push([0, 1]);
            n.seq = { steps, i: 0, t: steps[0][0] };
            n.next = rand(3, 14) / Math.max(0.05, n.flicker);
          }
        }
        if (n.seq) {
          const st = n.seq.steps[n.seq.i];
          n.target = st[1];
          n.seq.t -= dt;
          if (n.seq.t <= 0) {
            n.seq.i++;
            if (n.seq.i >= n.seq.steps.length) n.seq = null;
            else n.seq.t = n.seq.steps[n.seq.i][0];
          }
        } else {
          n.target = 1;
        }
        // neon snaps on/off quickly, but not instantly
        n.level += (n.target - n.level) * (1 - Math.pow(0.0001, dt));
      }
    }

    updateSmoke(dt) {
      const rm = this.reducedMotion;
      for (const e of this.emitters) {
        let rate = e.rate || 5;
        const em = e.ember;
        if (em) {
          em.t += dt;
          if (em.phase === "idle") {
            em.level = 0.35 + this.noiseC(this.time * 3 + e.x) * 0.15;
            em.next -= dt;
            if (em.next <= 0) { em.phase = "drag"; em.t = 0; }
          } else if (em.phase === "drag") {
            // drawing on the cigar: the tip flares up
            em.level = lerp(0.4, 1.25, smooth(clamp(em.t / 1.3, 0, 1)));
            if (em.t > 1.5) { em.phase = "exhale"; em.t = 0; }
          } else if (em.phase === "exhale") {
            em.level = lerp(1.2, 0.4, smooth(clamp(em.t / 1.6, 0, 1)));
            rate *= 2.5;
            if (em.t > 1.6) { em.phase = "idle"; em.next = rand(6, 13); }
          }
        }
        if (rm) rate *= 0.5;
        e.acc += rate * dt;
        while (e.acc >= 1) {
          e.acc -= 1;
          const exhale = em && em.phase === "exhale";
          this.smoke.push({
            x: e.x + rand(-2, 2) + (exhale ? rand(-10, -2) : 0),
            y: e.y + rand(-2, 2) - (exhale ? rand(4, 12) : 0),
            vx: exhale ? rand(-20, -4) : rand(-3, 3),
            vy: exhale ? rand(-22, -10) : rand(-26, -14),
            age: 0,
            life: rand(3.8, 6.5),
            size: rand(4, 7) * (exhale ? 1.5 : 1),
            grow: rand(9, 16) * (exhale ? 1.4 : 1),
            alpha: rand(0.12, 0.22),
            rot: rand(0, 6.28),
            spin: rand(-0.4, 0.4),
            seed: rand(0, 100),
            sprite: this.smokeSprites[(Math.random() * 3) | 0]
          });
        }
      }
      for (let i = this.smoke.length - 1; i >= 0; i--) {
        const p = this.smoke[i];
        p.age += dt;
        if (p.age >= p.life) {
          this.smoke.splice(i, 1);
          continue;
        }
        const curl = Math.sin(p.age * 1.6 + p.seed) * 9 + Math.sin(p.age * 0.7 + p.seed * 2) * 6;
        p.x += (p.vx + curl + 4) * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - dt * 0.6;
        p.vy *= 1 - dt * 0.12;
        p.size += p.grow * dt;
        p.rot += p.spin * dt;
      }
    }

    updateDust(dt) {
      const d = this.cfg.dust;
      if (!d) return;
      for (const m of this.dust) {
        m.vx += rand(-6, 6) * dt;
        m.vy += rand(-6, 6) * dt;
        m.vx = clamp(m.vx, -6, 6);
        m.vy = clamp(m.vy, -5, 5) + 0.02;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.phase += dt * 1.3;
        if (m.x < d.x) m.x += d.w;
        if (m.x > d.x + d.w) m.x -= d.w;
        if (m.y < d.y) m.y += d.h;
        if (m.y > d.y + d.h) m.y -= d.h;
      }
    }

    /* =================================================================
       draw
       ================================================================= */
    draw() {
      const ctx = this.ctx;
      const s = this.scale;
      const bg = this.cfg;

      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      if (this.anim && this.anim.type === "video") {
        ctx.clearRect(0, 0, STAGE_W, STAGE_H);   // see-through: the video is underneath
      } else {
        ctx.fillStyle = "#050403";
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
      }

      /* camera space */
      ctx.save();
      ctx.translate(STAGE_W / 2 + this.cam.x, STAGE_H / 2 + this.cam.y);
      ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
      ctx.translate(-STAGE_W / 2, -STAGE_H / 2);

      this.drawBackground(ctx);

      if (this.effects) this.drawEffects(ctx);

      if (this.debug) this.drawDebug(ctx);
      ctx.restore();

      /* screen space */
      this.drawScreenSpace(ctx);
    }

    /* The painted-on effects layered over a still image. */
    drawEffects(ctx) {
      const bg = this.cfg;
      if (bg.smokeSway && bg.smokeSway.enabled && this.image && !this.anim && !this.reducedMotion) this.drawSmokeSway(ctx);

      const room = this.roomLight();

      /* ambient flicker: the room breathes with the chandelier */
      if (room < 1) {
        ctx.fillStyle = `rgba(4,3,2,${clamp((1 - room) * 0.9, 0, 0.45)})`;
        ctx.fillRect(-40, -40, STAGE_W + 80, STAGE_H + 80);
      }

      if (this.win) this.drawWindow(ctx);
      this.drawNeon(ctx);
      this.drawLights(ctx, room);
      this.drawSmoke(ctx);
      this.drawDust(ctx, room);

      /* lightning spill into the room */
      if (this.win && this.win.lightning.level > 0) {
        const L = this.win.lightning.level;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = L * 0.32;
        const spr = glowSprite("#8ea6dc");
        ctx.drawImage(spr, 1090 - 700, 300 - 600, 1400, 1200);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    drawScreenSpace(ctx) {
      if (this.pulseLevel > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = this.pulseLevel * 0.16;
        ctx.drawImage(glowSprite("#ffcf8a"), 300, -300, 900, 900);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      if (this.vignette) ctx.drawImage(this.vignette, 0, 0, STAGE_W, STAGE_H);
      if (this.grainPatterns && this.grainPatterns.length) this.drawGrain(ctx);
      if (this.debug) this.drawDebugReadout(ctx);
    }

    drawSmokeSway(ctx) {
      const sw = this.cfg.smokeSway;
      const f = this.fit;
      const img = this.image;
      const t = this.time;
      const step = 3;
      for (let y = sw.y; y < sw.y + sw.h; y += step) {
        const v = (y - sw.y) / sw.h;
        const env = Math.sin(v * Math.PI);                 // calm at top and bottom
        const off = (Math.sin(t * 0.8 + y * 0.032) + Math.sin(t * 0.47 - y * 0.018) * 0.6) * sw.amount * env;
        const sx = (sw.x - f.x) / f.s;
        const sy = (y - f.y) / f.s;
        ctx.drawImage(img, sx, sy, sw.w / f.s, step / f.s, sw.x + off, y, sw.w, step);
      }
    }

    drawWindow(ctx) {
      const w = this.win;
      const lc = w.layer.getContext("2d");
      const s = this.scale;
      const L = w.lightning.level;

      lc.setTransform(s, 0, 0, s, 0, 0);
      lc.globalCompositeOperation = "source-over";
      lc.globalAlpha = 1;
      lc.clearRect(0, 0, w.w, w.h);

      /* lightning washes the whole street */
      if (L > 0) {
        lc.fillStyle = `rgba(205,220,255,${L * 0.5})`;
        lc.fillRect(0, 0, w.w, w.h);
      }

      /* headlights passing outside */
      if (w.car) this.drawCar(lc, w.car);

      /* rain streaks in three depth batches */
      const wind = w.wind || 0.08;
      const boost = 1 + L * 1.4;
      const batches = [[0, 0.33, 0.8], [0.33, 0.66, 1], [0.66, 1.01, 1.3]];
      for (const [z0, z1, width] of batches) {
        lc.beginPath();
        let a = 0;
        let count = 0;
        for (const st of w.streaks) {
          if (st.z < z0 || st.z >= z1) continue;
          lc.moveTo(st.x, st.y);
          lc.lineTo(st.x - st.len * wind, st.y - st.len);
          a += st.alpha;
          count++;
        }
        if (!count) continue;
        lc.strokeStyle = `rgba(200,218,245,${clamp((a / count) * boost, 0, 0.9)})`;
        lc.lineWidth = width;
        lc.stroke();
      }

      /* droplets clinging to the glass */
      for (const d of w.drops) {
        for (const p of d.trail) {
          lc.fillStyle = `rgba(190,210,240,${p.a * 0.16})`;
          lc.fillRect(p.x - d.r * 0.35, p.y - 3, d.r * 0.7, 5);
        }
        const r = d.r * d.grow;
        if (r < 0.4) continue;
        lc.fillStyle = "rgba(8,12,22,0.35)";
        lc.beginPath();
        lc.arc(d.x, d.y, r, 0, Math.PI * 2);
        lc.fill();
        lc.fillStyle = `rgba(225,238,255,${0.55 + L * 0.4})`;
        lc.beginPath();
        lc.arc(d.x - r * 0.3, d.y - r * 0.35, r * 0.38, 0, Math.PI * 2);
        lc.fill();
        lc.strokeStyle = "rgba(170,200,240,0.3)";
        lc.lineWidth = 0.6;
        lc.beginPath();
        lc.arc(d.x, d.y, r * 0.85, 0.3, Math.PI - 0.3);
        lc.stroke();
      }

      /* neon and street lights tint the rain that passes in front of them */
      lc.globalCompositeOperation = "source-atop";
      for (const n of this.neons) {
        const cx = n.x + n.w / 2 - w.x;
        const cy = n.y + n.h / 2 - w.y;
        const r = Math.max(n.w, n.h) * 1.1;
        lc.globalAlpha = 0.85 * n.level;
        lc.drawImage(glowSprite(n.color), cx - r, cy - r, r * 2, r * 2);
      }
      lc.globalAlpha = 1;

      /* keep everything on the glass only */
      lc.globalCompositeOperation = "destination-in";
      lc.drawImage(this.mask, 0, 0, w.w, w.h);
      lc.globalCompositeOperation = "source-over";

      ctx.drawImage(w.layer, w.x, w.y, w.w, w.h);
    }

    drawCar(lc, car) {
      const ahead = car.dir;
      const hx = car.x + ahead * 40;       // headlights at the front
      const tx = car.x - ahead * 46;       // tail lights at the back
      const y = car.y;
      const b = car.bright;
      lc.globalCompositeOperation = "lighter";

      // beam spilling forward along the street
      const beam = lc.createLinearGradient(hx, y, hx + ahead * 170, y);
      beam.addColorStop(0, `rgba(255,236,190,${0.35 * b})`);
      beam.addColorStop(1, "rgba(255,236,190,0)");
      lc.fillStyle = beam;
      lc.beginPath();
      lc.moveTo(hx, y - 3);
      lc.lineTo(hx + ahead * 170, y - 16);
      lc.lineTo(hx + ahead * 170, y + 14);
      lc.lineTo(hx, y + 3);
      lc.closePath();
      lc.fill();

      const warm = glowSprite("#ffe9b8");
      lc.globalAlpha = 0.9 * b;
      lc.drawImage(warm, hx - 18, y - 18, 36, 36);
      lc.globalAlpha = 0.5 * b;
      lc.drawImage(warm, hx - ahead * 10 - 12, y - 12, 24, 24);
      lc.globalAlpha = 0.25 * b;
      lc.drawImage(warm, hx - 70, y - 70, 140, 140);

      // reflections on the wet road
      lc.globalAlpha = 0.35 * b;
      lc.drawImage(warm, hx - 6, y + 4, 12, 46);

      const red = glowSprite("#ff3b30");
      lc.globalAlpha = 0.7 * b;
      lc.drawImage(red, tx - 8, y - 6, 16, 16);
      lc.globalAlpha = 0.25 * b;
      lc.drawImage(red, tx - 5, y + 6, 10, 30);

      lc.globalAlpha = 1;
      lc.globalCompositeOperation = "source-over";
    }

    drawNeon(ctx) {
      for (const n of this.neons) {
        const hum = n.level * (0.92 + n.noise(this.time * 18) * 0.08);
        if (n.level < 0.97) {
          ctx.globalAlpha = (1 - n.level) * 0.72;
          ctx.drawImage(n.dark.canvas, n.x - n.dark.pad, n.y - n.dark.pad);
        }
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = hum * 0.42;
        ctx.drawImage(n.glow.canvas, n.x - n.glow.pad, n.y - n.glow.pad);
        const r = Math.max(n.w, n.h) * 1.05;
        ctx.globalAlpha = hum * 0.14;
        ctx.drawImage(glowSprite(n.color), n.x + n.w / 2 - r, n.y + n.h / 2 - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    }

    drawLights(ctx, room) {
      const t = this.time;
      const rm = this.reducedMotion;
      ctx.globalCompositeOperation = "lighter";
      for (const l of this.lights) {
        const fl = rm ? 0 : l.flicker || 0;
        const v = (1 + (l.noise(t * 2.1) - 0.5) * 0.5 * fl + (l.noise(t * 13 + 50) - 0.5) * 0.18 * fl) *
                  room * (1 + this.pulseLevel * 0.6);
        ctx.globalAlpha = clamp(l.strength * v, 0, 1);
        ctx.drawImage(l.sprite, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }

      /* glowing tips of the cigars */
      for (const e of this.emitters) {
        if (!e.ember) continue;
        const lv = e.ember.level;
        ctx.globalAlpha = clamp(0.55 * lv, 0, 1);
        ctx.drawImage(glowSprite("#ff7a2a"), e.x - 9, e.y - 9, 18, 18);
        ctx.globalAlpha = clamp(0.9 * lv, 0, 1);
        ctx.drawImage(glowSprite("#ffd27a"), e.x - 2.5, e.y - 2.5, 5, 5);
        ctx.globalAlpha = clamp(0.12 * lv, 0, 1);
        ctx.drawImage(glowSprite("#ff8a3a"), e.x - 34, e.y - 34, 68, 68);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawSmoke(ctx) {
      ctx.globalCompositeOperation = "screen";
      for (const p of this.smoke) {
        const u = p.age / p.life;
        const fade = smooth(Math.min(1, p.age / 0.9)) * (1 - smooth(u));
        ctx.globalAlpha = clamp(p.alpha * fade, 0, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const sz = p.size * 2;
        ctx.drawImage(p.sprite, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawDust(ctx, room) {
      const d = this.cfg.dust;
      if (!d || !this.dust.length) return;
      const src = this.lights[0] || { x: d.x + d.w / 2, y: d.y };
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgb(255,228,186)";
      for (const m of this.dust) {
        const dist = Math.hypot(m.x - src.x, m.y - src.y);
        const lit = clamp(1 - dist / 430, 0, 1);
        const tw = 0.5 + 0.5 * Math.sin(m.phase * 2.1);
        ctx.globalAlpha = lit * (0.25 + tw * 0.55) * room;
        if (ctx.globalAlpha < 0.02) continue;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawGrain(ctx) {
      this.grainFrame = ((this.grainFrame || 0) + 1) % (this.grainPatterns.length * 2);
      const pat = this.grainPatterns[this.grainFrame >> 1];
      ctx.save();
      // over a see-through canvas "overlay" has nothing to blend with, so lay the grain on lightly
      const overVideo = this.anim && this.anim.type === "video";
      ctx.globalCompositeOperation = overVideo ? "source-over" : "overlay";
      ctx.globalAlpha = this.cfg.filmGrain * (overVideo ? 0.45 : 1);
      ctx.translate(-((Math.random() * 192) | 0), -((Math.random() * 192) | 0));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, STAGE_W + 192, STAGE_H + 192);
      ctx.restore();
    }

    /* ---------------- F3 debug overlay ---------------- */
    drawDebug(ctx) {
      const bg = this.cfg;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.font = "11px monospace";
      const label = (txt, x, y, c) => {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(x, y - 11, ctx.measureText(txt).width + 6, 14);
        ctx.fillStyle = c;
        ctx.fillText(txt, x + 3, y);
      };
      if (bg.window) {
        ctx.strokeStyle = "#4fc3ff";
        ctx.strokeRect(bg.window.x, bg.window.y, bg.window.w, bg.window.h);
        label("window", bg.window.x + 4, bg.window.y + 14, "#4fc3ff");
      }
      for (const n of this.neons) {
        ctx.strokeStyle = "#ff5ad1";
        ctx.strokeRect(n.x, n.y, n.w, n.h);
        label(n.name || "neon", n.x, n.y - 3, "#ff5ad1");
      }
      for (const l of this.lights) {
        ctx.strokeStyle = "#ffd36b";
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#ffd36b";
        ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
        label(l.name || "light", l.x + 4, l.y - 4, "#ffd36b");
      }
      for (const e of this.emitters) {
        ctx.strokeStyle = "#9cff8a";
        ctx.strokeRect(e.x - 4, e.y - 4, 8, 8);
        label(e.name || "smoke", e.x + 6, e.y + 12, "#9cff8a");
      }
      if (bg.smokeSway) {
        ctx.strokeStyle = "#c9a0ff";
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bg.smokeSway.x, bg.smokeSway.y, bg.smokeSway.w, bg.smokeSway.h);
        ctx.setLineDash([]);
        label("smokeSway", bg.smokeSway.x + 4, bg.smokeSway.y + 14, "#c9a0ff");
      }
      ctx.restore();
    }

    drawDebugReadout(ctx) {
      // convert the stage mouse position back into scene coordinates
      const sx = (this.mouseStage.x - STAGE_W / 2 - this.cam.x) / CAMERA_ZOOM + STAGE_W / 2;
      const sy = (this.mouseStage.y - STAGE_H / 2 - this.cam.y) / CAMERA_ZOOM + STAGE_H / 2;
      const txt = `x ${Math.round(sx)}  y ${Math.round(sy)}   (F3 to hide)`;
      ctx.save();
      ctx.font = "13px monospace";
      const w = ctx.measureText(txt).width + 16;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(STAGE_W - w - 12, 12, w, 24);
      ctx.fillStyle = "#9cff8a";
      ctx.fillText(txt, STAGE_W - w - 4, 29);
      ctx.restore();
    }
  }

  window.MenuScene = MenuScene;
})();
