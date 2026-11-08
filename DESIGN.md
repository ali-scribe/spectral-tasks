---
name: Spectral Tasks
description: A task app where completed work restores a haunted manor, drawn as a gentle gothic dark UI.
colors:
  night-ground: "#120e1a"
  crypt-surface: "#1d1729"
  raised-surface: "#272036"
  moon-text: "#ece6f5"
  mist-text: "#b0a6c4"
  spirit-lilac: "#c4a8ff"
  lantern-gold: "#ffd479"
  ember-rose: "#ff9a9a"
  iron-border: "#7a6c96"
  ink-on-accent: "#1a1326"
typography:
  display:
    fontFamily: "ui-serif, Georgia, 'Iowan Old Style', 'Times New Roman', serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.01em"
  headline:
    fontFamily: "ui-serif, Georgia, 'Iowan Old Style', 'Times New Roman', serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "ui-serif, Georgia, 'Iowan Old Style', 'Times New Roman', serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
components:
  panel:
    backgroundColor: "{colors.crypt-surface}"
    textColor: "{colors.moon-text}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
  view-nav-button-current:
    backgroundColor: "{colors.spirit-lilac}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0.5rem 1rem"
  empty-state:
    backgroundColor: "{colors.night-ground}"
    textColor: "{colors.mist-text}"
    rounded: "{rounded.md}"
    padding: "1.5rem"
---

# Design System: Spectral Tasks

*Reflects the code after the manor and ghost redesign. All manor and ghost art colors now live in `tokens.css`.*

## Overview

**Creative North Star: "The Lit Window in the Dark"**

Spectral Tasks is a calm, dark, single-theme interface in which small things glow against a deep night ground. Almost everything is quiet: near-black violet surfaces, soft off-white type, one lilac accent, one lantern-gold reserved for focus and light. Warmth comes from the content, not from decoration. The manor and the ghost are the only illustrated elements and carry the personality.

Density is moderate and phone-first. A single column below 768px, two columns above. Tone is gently haunting and warm, never grim. Depth is tonal, not dramatic.

**Key Characteristics:**
- One dark theme only, a violet-black family.
- Serif display headings over a system sans body; no fetched fonts.
- Lilac accent is rare and means "act here" or "current".
- Gold means focus and lit windows only.
- Borders are visible by contract (3:1), not decorative.
- Motion is CSS only, at most 1.2s, and fully disabled under reduced motion.

**Anti-references (owner-named):** generic dark SaaS dashboard, purple gradients, glassmorphism, glowing bordered cards, particle overload.

## Colors

A restrained violet-black palette with one lilac accent and one gold signal. All text pairs are verified at 4.5:1 or better and boundaries at 3:1 by `tokens.contrast.test.ts`.

### Primary
- **Spirit Lilac** (#c4a8ff): links, the current view button, progress fill, the ghost's tint. Filled controls use Ink on Accent text.

### Secondary
- **Lantern Gold** (#ffd479): the focus ring only in the interface, and lit windows in the manor (also the ghost's daily-goal glow and sparks).

### Tertiary
- **Ember Rose** (#ff9a9a): overdue labels and destructive actions. Always paired with text or an icon.

### Neutral
- **Night Ground** (#120e1a): page background, also the base for the ghost card and empty state. A faint lilac radial glow (6% opacity) sits behind the page top.
- **Crypt Surface** (#1d1729): panels and the form.
- **Raised Surface** (#272036): hover states.
- **Moon Text** (#ece6f5): body text, about 15:1 on the ground.
- **Mist Text** (#b0a6c4): secondary text, about 8:1.
- **Iron Border** (#7a6c96): input and component boundaries.
- **Ink on Accent** (#1a1326): dark text on lilac, rose and gold fills.

### Named Rules
**The Rare Lilac Rule.** Lilac marks the one current or actionable thing in a region. If a screen has lilac in five places, four are wrong.

**The Lantern Rule.** Gold belongs to focus and to light in the scene. It is never a button color.

**The Not By Color Alone Rule.** Overdue, completed and current states always carry a word or icon in addition to color.

## Typography

**Display Font:** system serif stack (`ui-serif`, Georgia, Iowan Old Style)
**Body Font:** system sans stack (`system-ui`, Segoe UI, Roboto)

**Character:** A gothic-leaning serif for headings against a plain, readable sans. No font files are loaded; hierarchy comes from size and weight.

### Hierarchy
- **Display** (600, 2rem, 1.2): the app title in the header.
- **Headline** (600, 1.5rem, 1.2): section headings.
- **Title** (600, 1.25rem, 1.2): stage name, panel titles.
- **Body** (400, 1rem, 1.55): task text, prose capped at 65ch.
- **Label** (400, 0.875rem): counts, metadata, ghost message, helper text.

Scale: 0.75, 0.875, 1, 1.25, 1.5, 2rem, in rem so 200% zoom reflows.

### Named Rules
**The System Stack Rule.** No runtime font fetching. Character comes from the serif/sans pairing, not a download.

## Layout

Mobile first. A single column below 768px (dashboard, then the create form, then the view nav, filters and list); the DOM order is always this order. The header and notices align with the centered main column on wide screens. Content width is capped at 1200px with 1rem page padding.

- **Phone dashboard (below 768px):** a compact manor (160px), the two counts on one line, the daily goal as one line with its bar, and a smaller ghost card (74px, fixed height so messages never resize it). All words stay visible.
- **768 to 1023px:** two columns, the dashboard on the left (sticky when it fits the viewport) and the task browser on the right. On a first visit the create form moves to the top of the right column so the main action is visible.
- **Hero band (1024px and up):** the dashboard becomes a full-width band. The manor spans it edge to edge (height 25vh, 168 to 300px) and its sides dissolve into the sky and ground. Under it, one strip holds the stage and the preview link, the counts and daily goal, and the ghost. The welcome text and the demo button sit over the quiet sky at the left of the manor. Below the band the create form is the left column and the view nav, filters and list are the right column. At 1024x768 the nav and the first task or empty-state message stay in view.


Spacing scale is 0.25, 0.5, 0.75, 1, 1.5, 2rem. Touch targets are 44px minimum. Outside the hero band the manor is capped at 220px high (160px below 768px). Usable from 320px to 1920px and at 200% zoom.

## Elevation & Depth

Tonal layering, almost flat. Depth comes from surface steps (ground, surface, raised surface) and 1px iron borders, not from shadow. A single soft shadow (`0 2px 10px rgba(0,0,0,0.45)`) exists for modal and floating use.

### Named Rules
**The Flat Rest Rule.** Surfaces are flat at rest. Hover raises the surface tone one step; it never adds a glow.

## Shapes

Gently rounded: 6px on controls and focus rings, 10px on panels, the manor frame and the ghost card, 14px reserved for larger containers. The progress bar and small motes use the pill radius (999px, --radius-pill). Overdue rows are marked by a 1px danger border plus the icon and the word Overdue, never a side stripe. Empty states use a dashed iron border. Overdue task rows carry a rose left border.

## Components

### Buttons and view navigation
- **Shape:** 6px radius, 44px minimum height, 0.5rem x 1rem padding.
- **Current:** lilac fill with Ink on Accent text.
- **Hover / Focus:** hover steps to Raised Surface; focus is a 3px gold outline with 2px offset, never removed. Disabled is 55% opacity with a not-allowed cursor.

### Panels and containers
- **Corner Style:** 10px.
- **Background:** Crypt Surface, or Night Ground for inset cards (ghost, empty state).
- **Border:** 1px Iron Border.
- **Padding:** 1.5rem.

### Inputs and filters
- Iron Border outline, ground fill, same focus ring. Search carries a leading icon. Errors are rose text under the field.

### Daily progress
- A 12px pill bar, ground fill with a lilac value, with a numeric "n of 3" label beside it.

### Manor (signature)
- One inline SVG, 400x260, with role="img", a title and a text description per stage; layers appear by `layer--minStage-N`. Frame is 10px radius with an Iron Border, and the frame background continues the sky and ground so a height cap never shows a seam.
- Gothic silhouette: steep central gable with chimney, spired tower on the left, gabled wing on the right, lancet (pointed-arch) windows and door, an iron fence with a gate gap, a bare tree and two headstones.
- Palette is per stage in `tokens.css` (`.manor` is stage 0, `.manor--stage-N` overrides): cold desaturated blue-grey at 0, neutral grey at 2, dusty rose at 3, amber at 4 to 5. Walls and roofs stay darker than the horizon sky so the outline reads at every stage.
- Stage 0 ruin: broken roof, snapped spire, boarded openings, neglected fence, clouds. Stage 1 adds the moon and one faint candle. Stage 2 mends the house and lights three windows. Stage 3 lights all six, adds smoke and a door light spill. Stage 4 adds lanterns beside the door, foliage, shrubs. Stage 5 adds sparks, blooms and the strongest horizon glow.
- Motion: slow mist drift, chimney smoke (stage 3+), sparks twinkle (stage 5). All stop under reduced motion; the scene stays complete as a still.

- **Stage preview:** a quiet "Preview manor stages" link under the stage label opens six buttons (0 to 5, ria-pressed). The chosen stage is shown with "Preview: your real progress is stage N" and a "Back to my manor" link, and "Previewing stage N" is announced politely. It is local, never saved, and never changes counts, the goal or storage.
- **Spirit released:** completing a task lifts a lilac wisp (about 1s) from where the row was toward the manor, with two faint motes behind it and a soft ring on the row's footprint. If the release raises the manor a stage, its lit windows flare once, left to right. The daily-goal release is a touch bigger and gold. The overlay is fixed, click-through and aria-hidden, and unmounts on animationend. Under reduced motion nothing moves: a still ring marks the row's place for 0.9s and the live-region message remains.

**The Silhouette Rule.** Building shapes are always darker than the sky behind them; light comes only from windows, lanterns and the horizon.

### Ghost companion (signature)
- A custom inline SVG shroud with a tattered hem and two stubby arms, in `--ghost-*` tokens (pale body, cool shade, ink features). Lilac appears only as the summoned wisp.
- Poses are static CSS states on `.ghost--{kind}`, so they read without motion: idle (arms down, open eyes, small mouth), summon (arms out, round mouth, wisp), celebrate (arms in a V, happy eyes, smile), goal (arms up, grin, three gold sparks, soft gold glow).
- Idle motion is a 3px bob and a slow blink. Reactions play once within 1.1s. A visible message line sits beneath; the pose name is visually hidden text.

**The Still Pose Rule.** Every pose must be recognizable with animation off.

## Do's and Don'ts

### Do:
- **Do** keep every color a token in `tokens.css` and re-check `tokens.contrast.test.ts` if a value changes.
- **Do** keep reactions at 1.2s or less, with a reduced-motion fallback that leaves text intact.
- **Do** let the manor stage come from real completed-task count only.
- **Do** keep tone warm: regression is honest, never scolding.

### Don't:
- **Don't** use purple gradients, glassmorphism, glowing bordered cards or particle effects.
- **Don't** use gold for anything but focus and light.
- **Don't** add a second theme, a logo, or fetched fonts.
- **Don't** carry meaning in color alone.
