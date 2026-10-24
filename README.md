# yehezkieled.github.io

Personal site, served by GitHub Pages from the `main` branch root:
<https://yehezkieled.github.io>

Two versions of the same content:

| Version | URL | What it is |
| --- | --- | --- |
| Room | `/` | A small 3D trainer's bedroom (three.js), shared with Piplup and Gible. Click the PC, badge case, TV, red handheld or phone to open a section. |
| Plain | `/plain/` | Static, text-first page with the same sections. Light/dark theme. |

In Room, drag to orbit; right-drag, Shift-drag or two-finger drag to pan; scroll or pinch to zoom. Outside the section panel, arrow keys orbit, +/− zoom, and 0 or Home resets the view. The "Reset view" button also resets it: to the selected section's view while a section is open, or to the default room view otherwise.

Piplup and Gible have flat-shaded, low-poly models with crisp pixel-art details. They wander, play and visit each other. Tap either for a reaction (a hop, a chest puff, a chomp, a spin and more; the other one answers when it is close by). About one tap in four is one too many: the pet stomps and shakes under an anger mark, then Piplup uses Water Gun (a spray of low-poly droplets that splash where they land) or Gible uses Bite (a lunge and a snap). Press and drag on one to lift it: it dangles under the pointer or finger and a ring shows where it will come down. Drop it on the floor or on top of the bed, desk, chair, nightstand, TV stand or shelf: it stays up there and wanders only the clear part of that surface until it is lifted again. A spot that is too small or blocked snaps to the nearest clear one, or to the floor. Dragging anywhere else still orbits. With reduced motion enabled, they do not wander or animate reactions and a tantrum shows only the move's name and pose; lifting and dropping still work.

The Day/Night button in the top bar (or the N key outside the section panel) switches the window sky and the room lighting. The first visit follows the visitor's clock (night from 18:00 to 07:00); a choice is remembered when browser storage is available. The creatures yawn when the lights go down and doze while it is night.

Viewports narrower than 640 pixels, data-saver connections, devices reporting 2 GB of memory or less, and browsers without hardware WebGL 2 are sent to the plain version automatically. On `/`, `?room=1` forces Room, `?plain=1` forces Plain, and `?auto=1` resets the choice and detects again. Explicit queries take precedence over saved preferences; choices are remembered when browser storage is available.

## Editing content

Profile, section headings, projects, posts and links live in [`content.js`](content.js). After editing it, the shared renderer (`assets/sections.js`) or `plain/template.html`, run `node scripts/render-plain.mjs` with Node.js and commit the source changes and updated `plain/index.html`. The command uses the shared section renderer to keep the delivered no-JavaScript page in sync. Edit `plain/template.html` for Plain page layout and interface text; `plain/index.html` is generated.

## Layout

```
index.html          room page (capability router inline in <head>)
plain/index.html    plain page
content.js          shared portfolio content
assets/sections.js  content -> HTML (shared by both pages)
assets/ui.css       shared tokens + dialog-box components
assets/room.js      the 3D scene (procedural geometry + canvas pixel textures)
assets/room.css     room HUD, panel, loader
assets/plain.*      plain page layout + theme switch
vendor/three/       pinned three.js build (see VERSION)
```

No dependencies to install. See [Editing content](#editing-content) for regeneration requirements. Run any static file server in the repo root to preview, for example `python3 -m http.server 8000`.

All models, textures and icons are hand-made for this site. It is an unofficial fan homage and uses no official game art, sprites, logos, fonts or music.

## Preview

![Room tour](docs/preview/room-tour.gif)

More in [`docs/preview/`](docs/preview/): a 19-second [MP4 tour](docs/preview/room-tour.mp4), a [before/after video of Piplup and Gible](docs/preview/pets-before-after.mp4) (idle, walking, tap reactions, tantrums with Water Gun and Bite, lifting both onto the bed; also as [GIF](docs/preview/pets-before-after.gif)), turnaround sheets of [Piplup](docs/preview/pets-turnaround-piplup.png) and [Gible](docs/preview/pets-turnaround-gible.png), close-ups of each creature, and screenshots at desktop, iPad and phone widths.
