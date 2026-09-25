# matthewginz.github.io

Personal site for Matthew Ginzburg. Quantitative Finance @ Stevens, class of 2028.

One page, laid out as a node graph: the intro, an "off the clock" hobbies
panel, each project, awards, skills, and contact are nodes on a dot-grid canvas, wired together with jagged zigzag connectors that
carry a travelling current. No framework, no build step, no dependencies.

## Run it

```
python3 -m http.server 4321
```

Then open `http://127.0.0.1:4321`. Any static server works: `npx serve`,
`php -S`, etc. Opening `index.html` straight off the filesystem mostly works,
but `file://` is not a secure context, so the copy-email button falls back
silently if the Clipboard API is unavailable. Use a server.

## Files

| Path | What it is |
|---|---|
| `index.html` | All content. Each node is a `<section class="node" data-node>`. |
| `css/site.css` | Design tokens (light + dark, both token sets on `:root` / `[data-theme]`) and layout. |
| `js/site.js` | Wire routing, scroll reveal, the left-hand rail, keyboard nav, theme persistence. |
| `js/hobbies.js` | The hobbies panel: ski skyline, Chelsea / Knicks plays, poker table. |
| `assets/resume.pdf` | Résumé, linked from the header and the contact node. |

## How the wires work

`js/site.js` walks `[data-node]` in document order and draws one jagged
zigzag connector per consecutive pair, measuring real
`getBoundingClientRect()` geometry rather than hardcoded coordinates — so the
graph re-routes correctly on resize. A short bright segment animates along
each connector's path on a continuous loop (an SVG `<animate>` on
`stroke-dashoffset`); the underlying wire lights up once on reveal and
settles to a dim resting glow rather than flickering forever.

Below 900px the left-hand rail hides and cards stop alternating left/right,
since everything stacks into one column.

## Editing content

Add or reorder a node by moving its `<section class="node" data-node>` in
`index.html`. Wires and the left-hand rail redraw from DOM order on every
resize, so nothing else needs updating. Give a project card `side-l` or
`side-r` to alternate which side of the canvas it sits on.

## Off the clock

The hobbies node (`#n-hobbies`) lives in `js/hobbies.js`, kept apart from the
page wiring in `js/site.js`:

- **Ski skyline.** Five hand-drawn SVG peaks, roughly to relative height, not
  to scale. Hovering, focusing or clicking a peak or its legend row highlights
  both (they share a `data-peak` key); otherwise it tours through them.
- **Chelsea / Knicks plays.** Players are `<g class="player" data-name>` in
  the SVG. They pass 3–10 times at random, then shoot and always score, and
  the scorer's name flashes. Hover or tap a player to see who it is.
- **Poker table.** A Hold'em hand dealt by the rules: riffle, hole cards
  starting left of the button, bet/fold rounds, burn + flop/turn/river,
  showdown. No winner is declared. Idle players do chip tricks.

Every animation only runs while it's on screen and the tab is visible, and
everything is static under `prefers-reduced-motion`. Team and table colours
are the `--chelsea*`, `--knicks*`, `--felt` and `--rail` tokens in
`css/site.css`.

## Keyboard

| Key | Action |
|---|---|
| `J` / `K` | Step to next / previous node |
| `T` | Toggle theme |
| `C` | Copy email |

## Notes

Respects `prefers-color-scheme` on first visit, then remembers the choice via
`localStorage`. Honors `prefers-reduced-motion` (no travelling current, no
reveal animation, no connector draw-in).
