/* =====================================================================
   COSA NOSTRA — MAIN MENU CONFIGURATION
   ---------------------------------------------------------------------
   Everything you'd want to change lives in this file. You don't need
   to touch menu.js or scene.js to add, remove, rename or reorder
   buttons, change colours, or turn effects on and off.

   Coordinates for background effects use the 1280 x 720 stage
   (top-left = 0,0). Press F3 in the menu to show the effect overlay
   and a live cursor readout, so you can line things up.
   ===================================================================== */

window.MENU_CONFIG = {

  /* ---------------- Title block ---------------- */
  title: ["COSA", "NOSTRA"],            // one entry per line
  subtitle: "A GENERATIONAL SAGA",
  documentTitle: "Cosa Nostra",          // browser tab / window title

  /* ---------------- Menu items ----------------
     id        unique name, used by the JS API (CosaMenu.setEnabled('load', false))
     label     text shown on the button
     action    name passed to your handler (see "Hooking up actions" in README)
     enabled   false = greyed out, can't be picked
     visible   false = hidden completely (same as deleting the line)
     confirm   { title, text, yes, no } asks before running the action
     submenu   [ ...more items ] opens a nested page; ESC goes back
     toast     message shown when picking it with no handler attached
  */
  items: [
    { id: "start",       label: "Start Game",  action: "start-game" },
    { id: "load",        label: "Load Game",   action: "load-game" },
    { id: "multiplayer", label: "Multiplayer", action: "multiplayer" },
    { id: "options",     label: "Options",     action: "options" },
    { id: "extras",      label: "Extras",      action: "extras" },
    /* Submenu example: swap the Extras line above for this to give it
       its own page (a "Back" button is added automatically).
    { id: "extras", label: "Extras", submenu: [
        { id: "gallery", label: "Gallery",      action: "gallery" },
        { id: "music",   label: "Music Player", action: "music-player" }
    ]},
    */
    { id: "credits",     label: "Credits",     action: "credits" },
    { id: "quit",        label: "Exit Game",   action: "quit",
      confirm: {
        title: "Leave the Family?",
        text:  "Nobody walks away from this thing of ours.",
        yes:   "Exit",
        no:    "Stay"
      }
    }
  ],

  /* Message shown when an item has no handler hooked up yet. */
  defaultToast: "Coming soon",

  /* ---------------- Key hints (bottom-left) ----------------
     keys     labels drawn as keycaps
     action   "navigate" (display only), "select" or "back"
  */
  hints: [
    { keys: ["↑", "↓"], label: "Navigate", action: "navigate" },
    { keys: ["Enter"],            label: "Select",   action: "select" },
    { keys: ["Esc"],              label: "Back",     action: "back" }
  ],

  /* ---------------- Behaviour ---------------- */
  playIntro: true,         // cinematic fade-in on first load (any key or click skips it)
  escOnRootOpensQuit: true,// pressing ESC on the top-level menu asks to exit
  wrapNavigation: true,    // pressing down on the last item jumps to the first
  selectBlinks: 4,         // how many times the button blinks when picked
  fadeOutOnAction: true,   // fade to black before handing off to the game

  /* ---------------- Theme (any CSS colour) ---------------- */
  theme: {
    gold:        "#e8c27a",
    goldBright:  "#fff1c9",
    goldDeep:    "#9b7135",
    text:        "#d9c7a3",
    textDim:     "#8a7c63",
    panel:       "#120d09",
    panelWidth:  440            // px on the 1280-wide stage
  },

  /* ---------------- Sound (optional) ----------------
     Paths to audio files. Leave null for silence.
     Browsers only allow sound after the first click or key press. */
  sounds: {
    hover:  null,              // e.g. "assets/sfx/hover.ogg"
    select: null,
    back:   null,
    error:  null,
    music:  null,              // looping menu music
    ambience: null,            // looping rain / bar ambience
    volume: 0.7
  },

  /* ---------------- Background & effects ---------------- */
  background: {
    image: "assets/background.jpg",   // any 16:9 image, drawn to cover 1280x720
                                      // (also shown while the animation loads)

    /* Frame-by-frame animation. Give it EITHER a video clip OR a set of
       numbered frames (same scene, drawn slightly differently each frame).
       Leave both null to use the still image + painted-on effects below.

       video:  "assets/animation/bar.mp4"         (mp4 / webm, loops)
       frames: { pattern: "assets/animation/frame_###.jpg", count: 24, start: 1 }
               ### becomes 001, 002 ... (use as many # as your file names have)
               or a plain list: ["assets/animation/a.jpg", "assets/animation/b.jpg"]
       fps:    frames per second for image frames (8-12 = hand-drawn feel)
       mode:   "loop" (1,2,3,1,2,3) or "pingpong" (1,2,3,2,1)
       blend:  0 = hard cuts between frames like classic animation,
               1 = soft cross-fade between frames
       keepEffects: true keeps the rain / neon / smoke effects on top */
    animation: {
      video: null,
      frames: null,
      fps: 10,
      mode: "loop",
      blend: 0,
      keepEffects: false
    },

    parallax: 10,                     // max px the scene drifts with the mouse (0 = off)
    drift: true,                      // slow "breathing" camera sway
    filmGrain: 0.06,                  // 0 = off
    vignette: 0.55,                   // 0 = off
    lightFlicker: true,               // subtle warm flicker of the room light

    /* Rain + glass effects run only where this mask is opaque.
       x / y = where the mask image sits on the 1280x720 stage. */
    window: {
      enabled: true,
      mask: "assets/window-mask.png",
      x: 911, y: 0, w: 351, h: 592,
      rain: 260,                      // streak count
      droplets: 34,                   // drops sliding down the glass
      lightning: true,
      lightningEvery: [14, 30],       // seconds (random between)
      cars: false,                    // headlights passing outside (off: the painted cars are parked)
      carsEvery: [9, 20]
    },

    /* Neon signs: glow, hum, and the odd flicker-out. */
    neon: [
      { name: "BAR",    x: 942,  y: 247, w: 30, h: 84,  color: "#ff5ad1", rim: "#5fb7ff", flicker: 0.9 },
      { name: "Red",    x: 1015, y: 280, w: 15, h: 51,  color: "#ff3c5a", flicker: 0.4 },
      { name: "HOTEL",  x: 1187, y: 199, w: 32, h: 124, color: "#ffd46b", flicker: 0.25 }
    ],

    /* Warm light sources (chandelier, lamps, sconces). */
    lights: [
      { name: "Chandelier", x: 695,  y: 80,  r: 210, color: "#ffcf8a", strength: 0.30, flicker: 0.30 },
      { name: "Shade L1",   x: 585,  y: 35,  r: 60,  color: "#ffe1a8", strength: 0.30, flicker: 0.5 },
      { name: "Shade L2",   x: 615,  y: 62,  r: 50,  color: "#ffe1a8", strength: 0.25, flicker: 0.5 },
      { name: "Shade R1",   x: 800,  y: 35,  r: 60,  color: "#ffe1a8", strength: 0.30, flicker: 0.5 },
      { name: "Shade R2",   x: 765,  y: 62,  r: 50,  color: "#ffe1a8", strength: 0.25, flicker: 0.5 },
      { name: "Table lamp", x: 950,  y: 486, r: 90,  color: "#ffd58f", strength: 0.40, flicker: 0.2 },
      { name: "Sconce",     x: 835,  y: 317, r: 55,  color: "#ffc98a", strength: 0.30, flicker: 0.3 },
      { name: "Street 1",   x: 1130, y: 285, r: 40,  color: "#cfe3ff", strength: 0.25, flicker: 0.1 },
      { name: "Street 2",   x: 1062, y: 307, r: 30,  color: "#cfe3ff", strength: 0.20, flicker: 0.1 }
    ],

    /* Cigar / cigarette smoke. ember = glowing tip that brightens on each drag. */
    smoke: [
      { name: "Don's cigar",   x: 892, y: 446, rate: 7, ember: true },
      { name: "Hat cigarette", x: 962, y: 507, rate: 5, ember: true }
    ],

    /* The painted smoke plume in the artwork gently sways. */
    smokeSway: { enabled: true, x: 760, y: 120, w: 150, h: 300, amount: 2.2 },

    /* Floating dust in the chandelier light. */
    dust: { count: 70, x: 440, y: 0, w: 480, h: 420 }
  }
};
