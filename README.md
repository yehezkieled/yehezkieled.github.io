# yehezkieled.github.io

Personal site, served by GitHub Pages from the `main` branch root:
<https://yehezkieled.github.io>

Two versions of the same content:

| Version | URL | What it is |
| --- | --- | --- |
| Room | `/` | A small 3D trainer's bedroom (three.js). Click the PC, badge case, TV, red handheld or phone to open a section. |
| Plain | `/plain/` | Static, text-first page with the same sections. Light/dark theme. |

Phones, data-saver, low-memory devices and browsers without hardware WebGL 2 are sent to the plain version automatically. `?room=1`, `?plain=1` and `?auto=1` force or reset the choice.

## Editing content

All text lives in [`content.js`](content.js). Edit it and push; nothing needs rebuilding.

## Layout

```
index.html          room page (capability router inline in <head>)
plain/index.html    plain page
content.js          ALL site text
assets/sections.js  content -> HTML (shared by both pages)
assets/ui.css       shared tokens + dialog-box components
assets/room.js      the 3D scene (procedural geometry + canvas pixel textures)
assets/room.css     room HUD, panel, loader
assets/plain.*      plain page layout + theme switch
vendor/three/       pinned three.js build (see VERSION)
```

No build step. Run any static file server in the repo root to preview, for example `python3 -m http.server 8000`.

All models, textures and icons are hand-made for this site. It is an unofficial fan homage and uses no official game art, sprites, logos, fonts or music.
