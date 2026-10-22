# README assets

- `logo.svg` — hand-written SVG wordmark + mark; `prefers-color-scheme` switches ink/emerald for GitHub light and dark. Font stack `Sora, Inter, system-ui` (weight 800); GitHub shows the system fallback.
- `logo-dark.png`, `logo-light.png` — 2x renders (1040×240) of `logo.svg` with the media query forced to `@media all` (dark, on #0b0d12) or `@media not all` (light, on #fff), via headless Chrome.
- `journey.svg` — hand-written diagram (960×250): `/hyperui` door → Design · Spec · Build · Review · Ship · Infra, `.hyperui/` memory bar underneath. Same light/dark handling; edit the SVG directly.
- `demo.webp`, `demo.mp4` — the animated hero of the README: a 9-second loop recorded from `demo/index.html` (below). `demo.webp` is 960×600, 24 fps, libwebp quality 76, infinite loop (GitHub renders animated WebP); `demo.mp4` is the 1280×800 30 fps H.264 master (CRF 20).
- `demo/` — `index.html` + `demo.css` + `demo.js`: a fictional "Acme Notes" landing in the hyperui brand (graphite `#0b0d12`, surfaces `#141822`/`#1c2130`, emerald `#3ecf8e`, Sora 800 from Google Fonts with a system fallback). One deterministic, time-driven timeline (0–9 s): headline words stagger in with y + blur; a 3D card tilts in with `perspective(1200px) rotateX/rotateY` and an emerald glow follows a simulated pointer; a scripted scroll reveals three feature cards (scroll-linked, staggered) while three blurred blobs parallax at different depths; a button hover + tap spring; a tab indicator slides with a shared-layout feel; the `built with hyperui` wordmark fades in at the end. Only `transform`/`opacity`/`filter` animate. After the timeline the page goes live: wheel scroll with parallax, pointer-driven tilt and glow, hover springs, clickable tabs; click the wordmark to replay. `prefers-reduced-motion` jumps to the resting state and disables the tilt. `?record` in the URL loads it paused at t = 0 and exposes `window.__seek(t)` / `window.__duration` for frame-exact rendering. Tuned for a 1280×800 viewport.
- `examples/directions.webp` — 960×600, 24 fps, 9.7 s, ~3.2 MB. The three design directions from a `design` test run (`examples/directions/{ledger,monolith,atelier}.html`, self-contained, Google Fonts), ~3.4 s each with a 0.25 s cross-fade: the page loads with its own entrance animation (`.rise` stagger, Atelier's cards and cursor), a first scroll brings the primary CTA into view, a cursor glyph hovers it (real `mouse.move`, so the page's own `:hover` transition plays), then the scroll completes to ~500 px. A graphite caption bar (54 px, injected at record time, not in the pages) carries the chip — emerald dot, direction name, type pairing (Fraunces + Inter · Syne + IBM Plex · Instrument Serif + Manrope) — and `direction n of 3`. Ledger and Atelier render in light, Monolith in dark (each page's default).
- `examples/dashboard.webp` — 960×600, 24 fps, 8 s, ~1.2 MB, from `examples/dashboard-ventas.html` in dark mode. 0–2.9 s: an injected card over the blurred page with the `viz` what–why–how table (three rows built from the dashboard's own chart titles, staggered in); then a scroll to the KPI row + charts and two real tooltip hovers (August column, "Sur" bar) driven by `mouse.move`. A record-time CSS fix (`.card-head .seg{flex:none}`) keeps the Gráfico/Tabla toggle inside its card at 1120 px; the HTML itself is unchanged.
- `examples/ship.webp` — 960×420, 24 fps, 8 s, ~90 KB, rendered frame-exact from `examples/ship-terminal.html`: a hyperui-styled terminal card where `/hyperui ¿cómo cobro con tarjeta en mi página?` is typed, `ship` "thinks" for 0.6 s, then the real answer excerpt (the one in the README) appears line by line; the final prompt's caret blinks for the last 2 s. Like `demo/`, the page is time-driven: it plays on open and `?record` exposes `window.__seek(t)` / `window.__duration` / `window.__ready`.
- `examples/record/` — the recorders (`rec-directions.cjs`, `rec-dashboard.cjs`, `rec-ship.cjs`) and `encode.sh`. See "Regenerate the example clips" below.
- `examples/dashboard-ventas.png` — 1280×1400 headless-Chrome screenshot of `examples/dashboard-ventas.html` (output of the `viz` skill in a test run, data in `ventas.csv`).
- `examples/directions-strip.png` — 1800×669 composite of `examples/{ledger,monolith,atelier}-1280.png`, each scaled to 568 px wide, 24 px gutters on #0b0d12, built with Python Pillow.
- `examples/*-1280.png`, `*-390.png` — design-direction screenshots (desktop / mobile) from a test run of the `design` skill.
- `examples/hyperui-architecture.png` — 1280×800 headless-Chrome screenshot (`--headless=new --virtual-time-budget=4000 --window-size=1280,800`, light) of `.hyperui/diagrams/hyperui-architecture.html`, the plugin's own architecture delivered by Archify (`scripts/archify.sh run deliver architecture .hyperui/diagrams/hyperui-architecture.json .hyperui/diagrams/hyperui-architecture.html`). Regenerate after any change to the IR or an Archify update that changes the viewer.

Regenerate a PNG: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars --force-device-scale-factor=2 --window-size=520,120 --screenshot=out.png file:///path/to/page.html` (wrap a forced-scheme copy of the SVG in an `<img>` page for the logo; use scale 1 and 1280,1400 for the dashboard).
Rebuild the strip: in a venv with `pillow`, open the three `-1280.png`, `resize((568, 621))`, paste at x = 24 + i·592, y = 24 on an 1800×669 `#0b0d12` canvas.

Regenerate the demo (Playwright drives the installed Chrome, no browser download; ffmpeg comes from `ffmpeg-static`):

```bash
mkdir -p /tmp/demo-rec && cd /tmp/demo-rec && npm init -y >/dev/null && npm i playwright ffmpeg-static
# render 270 frames at 30 fps by seeking the page's timeline (deterministic, identical every run)
node -e '
const { chromium } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await p.goto("file://" + process.env.HOME + "/personal/hyperui/docs/assets/demo/index.html?record");
  await p.evaluate(() => window.__ready); fs.mkdirSync("frames", { recursive: true });
  for (let i = 0; i < 270; i++) {
    await p.evaluate((t) => { window.__seek(t); return new Promise((r) => requestAnimationFrame(r)); }, i / 30);
    await p.screenshot({ path: `frames/f${String(i).padStart(4, "0")}.png` });
  }
  await b.close();
})();'
FF=$(node -p "require('ffmpeg-static')")
$FF -y -framerate 30 -i frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart demo.mp4
$FF -y -framerate 30 -i frames/f%04d.png -vf "fps=24,scale=960:-1:flags=lanczos" -c:v libwebp_anim -quality 76 -compression_level 6 -loop 0 demo.webp
```

Keep `demo.webp` under 4 MB (lower `fps=` or the width first, quality last). Then run `scripts/check.sh`: its company-agnostic grep also scans binaries, and a WebP encode can hit the pattern by chance (quality 75 did) — nudge `-quality` by one and re-encode until it is clean. Adjust the repo path in the `goto` line if the checkout is elsewhere.

Regenerate the example clips (same rig as the demo; `STILLS=1` renders a handful of test frames instead of the full sequence):

```bash
mkdir -p /tmp/ex-rec && cd /tmp/ex-rec && npm init -y >/dev/null && npm i playwright ffmpeg-static
REC=$HOME/personal/hyperui/docs/assets/examples/record       # adjust to your checkout
export NODE_PATH=$PWD/node_modules                           # the scripts live in the repo, the modules here
node $REC/rec-directions.cjs    # 3 × 82 frames at 1040×650 @2x -> frames/{ledger,monolith,atelier}/
node $REC/rec-dashboard.cjs     # 192 frames at 1120×700 @2x   -> frames/dashboard/
node $REC/rec-ship.cjs          # 192 frames at 960×420 @2x    -> frames/ship/
bash $REC/encode.sh $HOME/personal/hyperui/docs/assets/examples
```

How the direction pages are made deterministic: they animate with CSS (`@keyframes rise`, Atelier's `settle`/`pop`/`drift`) and with `setTimeout` typewriters, neither of which a screenshot loop can pace. The recorder installs Playwright's fake clock before `goto` and pauses it (`context.clock.install` + `pauseAt`), then advances it `1000/24` ms per frame (`clock.runFor`), and on every frame pauses each `document.getAnimations()` entry and sets its `currentTime` to the frame's virtual time (animations seen later — the CTA's hover transition — start from the frame they first appear). Scroll, chip, cursor glyph and mouse position are pure functions of `t`, so a re-render produces the same frames. Keep each clip under 4 MB (lower `-quality`, then the width); `scripts/check.sh` skips binaries.
