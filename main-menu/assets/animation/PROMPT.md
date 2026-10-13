# Animation prompt: street scene

Upload `assets/backgrounds/street-mirrored.jpg` (the man on the RIGHT) as the starting image. The menu panel covers the left third of the screen, so the man has to stay on the right.

Tool settings:
- **Image to video**, using the picture as the **first frame**.
- If the tool has an end-frame option, use the **same picture as the last frame** too.
- 16:9, 1080p if available, 8–10 seconds.

## Prompt

```
Bring this exact photograph to life as a seamless, looping cinematic shot. Keep the composition, framing, lighting, colors and every object exactly as they are in the image. This is a living painting, not a new scene.

CAMERA: Completely locked-off tripod shot. No camera movement at all: no pan, no tilt, no zoom, no dolly, no shake, no focus change. The frame never moves.

SETTING: A rain-soaked 1940s New York side street at night. Red-brick tenement buildings with an iron fire escape, wet cobblestones, an old cast-iron street lamp, and the Empire State Building glowing in the misty distance.

RAIN: Steady, medium-heavy rain falls in thin silver streaks at a slight consistent angle across the whole frame for the entire clip, at the same speed and density from first frame to last. Raindrops land on the cobblestones, making small splashes and gentle ripples in the shallow puddles between the stones. The wet cobblestones keep reflecting the warm lamplight and the car's headlights with a soft shimmer as the water moves. Rain runs down the brick walls and drips from the fire escape.

THE CAR: The black 1940s coupe stays parked and perfectly still. It does not move, roll, bounce or change shape. Its headlights stay on and steady, with rain visibly falling through the beams. Raindrops bead on the glossy black paint and slowly trickle down the hood, fenders and windshield. Reflections slide gently across the wet bodywork.

THE MAN: The man in the long dark overcoat and fedora stays leaning against the front of the car in the same spot the whole time. He does not walk, turn around or leave. His face, hat, coat and build stay exactly the same, with no morphing or warping. Slow, calm, natural movement only:
- At about 2 seconds he slowly raises the cigarette to his lips and takes a long drag. The ember glows brighter orange.
- At about 4 seconds he lowers his hand back to the same resting position.
- At about 5 seconds he exhales a soft plume of smoke that curls upward and drifts sideways, thinning out in the rain.
- He breathes slowly. A thin wisp of smoke rises continuously from the cigarette between drags.
- The hem of his coat moves very slightly in the wind. Water drips occasionally from the brim of his hat.
- By the last second he is back in exactly the same pose as in the first frame.

LIGHT AND ATMOSPHERE: The street lamp keeps its warm amber glow with a very subtle, natural flicker, and rain sparkles in its halo. Light mist and fog drift slowly through the street and around the distant skyline. The Empire State Building's lights stay steady. Warm windows stay lit. Everything keeps its moody film-noir color grade: deep shadows, warm amber highlights, cool blue night tones.

LOOP: The last frame must match the first frame as closely as possible (same pose, same smoke position, same light) so the clip loops forever with no visible jump.

QUALITY: Photorealistic, cinematic, sharp detail, natural motion, 24 fps, no flicker or frame jitter, no blurriness, consistent detail in every frame.
```

## Negative prompt (if the tool has a separate box for it)

```
camera movement, zoom, pan, shake, cuts, scene change, new people, extra people, car driving, car moving, wheels turning, man walking away, man turning around, face morphing, warped hands, extra fingers, distorted car, changing car shape, flickering frame, strobing light, lightning flash, text, letters, logo, watermark, subtitles, cartoon, painting style change, color shift, oversaturated, blurry, low resolution, slow motion, speeding up
```

## If something goes wrong

- **The man walks or turns:** add "He remains leaning against the car the entire time" at the start of the prompt and generate again.
- **The camera moves:** many tools have a "camera: static" or "fixed camera" setting. Turn it on.
- **It doesn't loop cleanly:** send it anyway. The menu project blends the end into the start (see the README).
- **The face or hands warp:** make the motion smaller. Replace the drag-and-exhale section with "He holds the cigarette still while smoke rises from it."
