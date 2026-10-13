# Cosa Nostra: Main Menu (HTML)

An animated, PC-focused main menu built from the concept art. It's plain HTML/CSS/JS with no build step and no dependencies.

**Run it:** open `index.html` in a browser. It also works when served, or inside Electron, NW.js or Tauri.

```
main-menu/
  index.html            page + where you hook up your game
  js/menu.config.js     <- everything you customise lives here
  js/menu.js            menu logic, input, animations, API
  js/scene.js           animated background (canvas)
  css/menu.css          look of the panel, title, buttons, dialog
  assets/background.jpg concept art fitted to 1280x720
  assets/window-mask.png  where the rain is allowed to fall (the glass)
  assets/fonts/         Oswald (SIL Open Font License, see OFL.txt)
  assets/concept-original.webp  your original concept, for reference
```

## Controls

| Input | Does |
|---|---|
| Mouse hover / click | select / pick |
| Mouse wheel | move selection |
| Right click | back |
| ↑ ↓ or W S (Tab / Shift+Tab) | move selection |
| Home / End | first / last item |
| Enter or Space | pick |
| Esc or Backspace | back (on the top menu it asks to exit) |
| F3 | effect overlay + cursor coordinates (for lining up effects) |

The cursor hides while you use the keyboard and comes back when the mouse moves. The key hints at the bottom are clickable, and their keycaps press down when you hit the matching key.

## Customising (`js/menu.config.js`)

### Add, remove, rename, reorder buttons
Edit the `items` list. Order in the list = order on screen.

```js
{ id: "multiplayer", label: "Multiplayer", action: "multiplayer", visible: false } // hidden
{ id: "load",        label: "Load Game",   action: "load-game",   enabled: false } // greyed out
```

- To remove a button, delete its line or set `visible: false`.
- `enabled: false` greys the button out. Picking it shakes the button and shows "Unavailable" (change the text with `disabledText`).
- `confirm: { title, text, yes, no }` asks before running the action.
- `submenu: [ ... ]` gives the button its own page. A Back button is added automatically.
- `toast: "..."` is the message shown if nothing is hooked up yet.
- `href: "game.html"` goes to that page after the fade.

### Other settings
- Title and subtitle: `title` (one string per line) and `subtitle`.
- Key hints: `hints`.
- Colours and panel width: `theme`.
- Intro, wrap-around and number of blinks: `playIntro`, `wrapNavigation`, `selectBlinks`.
- Sounds and music: `sounds`. Point them at `.ogg` or `.mp3` files; `null` = silent.
- Effects: `background`. Every effect can be switched off or tuned: rain amount, droplets, lightning and how often, passing cars, each neon sign, each light, smoke emitters, parallax, film grain, vignette.

### Frame-by-frame background animation
The background can play a real animation instead of the still image: the same scene redrawn over several frames, like classic animation. Set `background.animation` in the config:

```js
animation: {
  video: "assets/animation/bar.mp4",   // a looping clip (mp4 or webm)...
  // ...or numbered images:
  // frames: { pattern: "assets/animation/frame_###.jpg", count: 24 },
  fps: 10,          // image frames only; 8-12 gives a hand-drawn feel
  mode: "loop",     // or "pingpong" (1,2,3,2,1): hides a jump at the loop
  blend: 0,         // 0 = hard cuts, 1 = soft cross-fade between frames
  keepEffects: false
}
```

While the animation plays, the painted-on rain, neon and smoke effects switch off (set `keepEffects: true` to keep them). Film grain, the vignette and the mouse parallax stay on. The still image shows until the frames finish loading. If the animation can't load, the menu falls back to the still image with effects.

Frames should be 16:9, ideally 1280x720 or 1920x1080. The left part of the picture sits under the menu panel, so it doesn't matter what's there.

### Using a different background image
1. Set `background.image`.
2. Press F3 and move the mouse to read coordinates.
3. Update the `neon`, `lights`, `smoke` and `window` entries.

The rain mask (`window-mask.png`) is a white PNG whose opacity marks the glass. Paint a new one for a new window, or set `window.enabled: false`.

## Hooking up your game

```js
CosaMenu.on("start-game", (item) => {
  window.location.href = "game.html";   // or show your game screen
});

CosaMenu.on("options", async () => {
  await openMyOptionsScreen();
  return CosaMenu.BACK;                 // fade the menu back in afterwards
});
```

When an item is picked, the button blinks, sparks fly and the screen fades to black. Then your handler runs. Actions with no handler show the "Coming soon" toast and don't fade. `quit` closes the window in Electron and NW.js; a normal browser tab won't allow that, so the menu says so.

Every pick also fires a `cosamenu:action` event on `window`.

### Runtime API
```js
CosaMenu.setVisible("multiplayer", false);
CosaMenu.setEnabled("load", hasSaveFile);
CosaMenu.setLabel("start", "Continue");
CosaMenu.addItem({ id: "news", label: "News", action: "news" }, { after: "start" });
CosaMenu.removeItem("extras");
CosaMenu.select("options");      // highlight
CosaMenu.activate("start");      // pick, as if the player did
CosaMenu.toast("Saved");
CosaMenu.confirm({ title: "Overwrite save?" }).then(ok => ...);
CosaMenu.show();  CosaMenu.hide();
```

## What's animated

**Background**
- Rain behind the window glass, in three depths with gusting wind.
- Droplets that cling to the glass and slide down, leaving trails.
- Lightning. The rain lights up and the room catches the flash.
- Car headlights passing outside (off by default; turn on with `window.cars`).
- Neon signs that hum, flicker and sometimes die and buzz back on. The rain picks up their colour.
- Chandelier, lamps and sconce flicker gently, with an occasional power dip.
- Cigar and cigarette smoke. The embers flare when someone takes a drag, then they exhale.
- The painted smoke plume sways slowly.
- Dust drifts in the chandelier light.
- Mouse parallax, a slow camera drift, film grain and a vignette.

**Menu**
- Intro: fade in, panel slides in, title letters close up, buttons cascade in. Any key or click skips it.
- The highlight bar glides between buttons with a little overshoot.
- Each time the selection moves, the bar flickers on like a bulb warming up and a shine sweeps across it.
- Chevrons pulse, the hairline flares breathe, and the selected text grows and glows.
- Picking a button makes it blink rapidly with a light flash and a burst of gold sparks, then fades to black.
- The gold title has a periodic light sweep.

People who set "reduce motion" in their OS get calmer motion and no lightning flashes.

## Performance
The background costs about 2 ms per frame at 1280x720. It renders at the screen's real resolution, capped at 2x, and scales to any window size with letterboxing. Animation pauses automatically when the tab or window is hidden.
