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

The hobbies node (`#n-hobbies`) is a ski skyline plus two team tiles. The five
peaks are hand-drawn SVG, roughly to relative height, not to scale. Hovering,
focusing or clicking a peak or its legend row highlights both (they share a
`data-peak` key); otherwise `js/site.js` tours through them every 2.6s. Snow
and the ball animations are skipped under `prefers-reduced-motion`. Team
colours live in the `--chelsea*` / `--knicks*` tokens in `css/site.css`.

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
