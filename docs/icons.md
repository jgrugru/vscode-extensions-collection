# Activity bar icons

- Single-colour SVG, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, round caps and joins. VS Code recolours it for active/inactive and themes; never hard-code colours.
- Stroke width 1.8 to 2. Keep the drawing inside roughly x/y 3 to 21.
- No `<text>` elements: fonts are not available, so text must be drawn as paths.
- Referenced from `package.json` at `contributes.viewsContainers.activitybar[].icon`, relative to the extension folder.

## Current icons

- `dlt/resources/dlt.svg` - the letters "dlt" drawn as strokes: circle bowl plus stem for `d`, a line for `l`, stem with foot and crossbar for `t`. Stroke width 2.
- `motherduck/resources/motherduck.svg` - a duck in profile: head circle, beak, body curve, eye dot. Stroke width 1.8.

## Previewing

`rsvg-convert` and ImageMagick are not installed on this machine. `qlmanage` is:

```
sed 's/currentColor/black/g; s/width="24" height="24"/width="240" height="240"/' icon.svg > /tmp/preview.svg
qlmanage -t -s 240 -o /tmp /tmp/preview.svg   # writes /tmp/preview.svg.png
```

Scaling the width/height matters: at 24px the render is nearly invisible. Check final look at 24px in the real activity bar (reload the window after edits).
