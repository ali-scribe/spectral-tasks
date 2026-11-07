import { useEffect, useState } from 'react';
import { useAppState } from '../../state/AppContext.tsx';
import { getCounts } from '../../domain/selectors.ts';
import { getManorStage } from '../../domain/manor.ts';
import { MANOR_STAGES } from '../../domain/constants.ts';
import type { ManorStageId } from '../../domain/types.ts';
import { subscribeRelease } from '../effects/releaseFx.ts';

/**
 * The haunted manor as one inline SVG (REQ-MANOR-01; resolves OQ-6). The root
 * carries `manor manor--stage-N` and `data-stage`; layers are shown or hidden
 * by stage in manor.css and every color comes from the per-stage tokens in
 * tokens.css, so the scene reads cold and ruined at stage 0 and warms to amber
 * as it is restored. The SVG is decorative to the layout but exposes a text
 * alternative via role="img" and <title> (AC-MANOR-01.4, .10, .11).
 *
 * Geometry (viewBox 400x260): a gothic hall with a steep central gable and
 * chimney, a spired tower on the left, a gabled wing on the right, pointed
 * (lancet) windows, a pointed door, and an iron fence along the front with a
 * gate gap in front of the door. Ground line is y=212.
 */

/** A pointed-arch (lancet) outline: straight sides, two curves meeting at a point. */
function lancet(cx: number, top: number, w: number, h: number): string {
  const l = cx - w / 2;
  const r = cx + w / 2;
  const shoulder = top + w * 0.9;
  const bend = top + w * 0.3;
  return `M${l} ${top + h} V${shoulder} Q${l} ${bend} ${cx} ${top} Q${r} ${bend} ${r} ${shoulder} V${top + h} Z`;
}

interface WindowSpec {
  key: string;
  cx: number;
  top: number;
  w: number;
  h: number;
}

const W_TOWER_LOW: WindowSpec = { key: 'tower-low', cx: 105, top: 150, w: 14, h: 32 };
const W_BELFRY: WindowSpec = { key: 'belfry', cx: 105, top: 110, w: 10, h: 16 };
const W_ATTIC: WindowSpec = { key: 'attic', cx: 200, top: 94, w: 16, h: 30 };
const W_LEFT: WindowSpec = { key: 'left', cx: 156, top: 158, w: 22, h: 40 };
const W_RIGHT: WindowSpec = { key: 'right', cx: 244, top: 158, w: 22, h: 40 };
const W_WING: WindowSpec = { key: 'wing', cx: 303, top: 178, w: 14, h: 26 };

const ALL_WINDOWS = [W_TOWER_LOW, W_BELFRY, W_ATTIC, W_LEFT, W_RIGHT, W_WING];

/** Lit window: warm pane, a pale mullion and transom, and a soft wash on the wall. */
function LitWindow({ spec }: { spec: WindowSpec }): JSX.Element {
  const { cx, top, w, h } = spec;
  return (
    <g>
      <ellipse
        cx={cx}
        cy={top + h * 0.55}
        rx={w * 1.3}
        ry={h * 0.85}
        fill="url(#manor-window-grad)"
      />
      <path d={lancet(cx, top, w, h)} fill="var(--manor-window-lit)" />
      <path
        d={`M${cx} ${top + w * 0.25} V${top + h} M${cx - w / 2} ${top + h * 0.58} H${cx + w / 2}`}
        stroke="var(--manor-window-dark)"
        strokeWidth="1.3"
        opacity="0.55"
        fill="none"
      />
    </g>
  );
}

/** Four-point spark. */
function spark(x: number, y: number, r: number): string {
  const k = r * 0.3;
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
}

// Fence posts: every 12 units, with a gate gap centered on the door.
const FENCE_XS = Array.from({ length: 33 }, (_, i) => 8 + i * 12).filter((x) => Math.abs(x - 200) > 12);

const FENCE_MENDED = FENCE_XS.map((x) => `M${x} 230 V209 M${x - 3} 209.5 L${x} 199 L${x + 3} 209.5 Z`).join(' ');

/** The neglected fence: some posts gone, some leaning, some snapped. */
const FENCE_RUINED = FENCE_XS.map((x, i) => {
  if (i % 4 === 2) return null;
  const snapped = i % 3 === 0;
  const d = snapped ? `M${x} 230 V215` : `M${x} 230 V209 M${x - 3} 209.5 L${x} 199 L${x + 3} 209.5 Z`;
  const lean = i % 5 === 1 ? `rotate(13 ${x} 230)` : undefined;
  return { x, d, lean };
}).filter((p): p is { x: number; d: string; lean: string | undefined } => p !== null);

/** Windows that are lit at each stage, in the order the beat lights them. */
function litWindows(stage: number): WindowSpec[] {
  if (stage >= 3) return [W_TOWER_LOW, W_BELFRY, W_LEFT, W_ATTIC, W_RIGHT, W_WING];
  if (stage === 2) return [W_TOWER_LOW, W_LEFT, W_RIGHT];
  return stage === 1 ? [W_TOWER_LOW] : [];
}

/** Safety net for the beat if animationend cannot fire (reduced motion, hidden tab). */
const BEAT_FALLBACK_MS = 1500;

interface ManorViewProps {
  /** A stage to show instead of the real one (read-only preview). */
  previewStage?: ManorStageId | null;
}

export function ManorView({ previewStage = null }: ManorViewProps): JSX.Element {
  const { tasks } = useAppState();
  const realStage = getManorStage(getCounts(tasks).completed);
  const stage = previewStage ?? realStage;
  const description = MANOR_STAGES[stage]!.description;

  // A release that lifts the manor a stage plays a one-shot beat: the lit
  // windows brighten in sequence. Presentational only.
  const [beat, setBeat] = useState<number | null>(null);
  useEffect(() => subscribeRelease((event) => event.stageUp && setBeat(event.id)), []);
  // No beat while previewing: the windows shown are not the real ones.
  useEffect(() => {
    if (beat === null) return;
    const timer = setTimeout(() => setBeat(null), BEAT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [beat]);
  const beatWindows = beat === null || previewStage !== null ? [] : litWindows(stage);

  return (
    <svg
      className={`manor manor--stage-${stage}`}
      data-stage={stage}
      viewBox="0 0 400 260"
      role="img"
      aria-label={description}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{description}</title>

      <defs>
        <linearGradient id="manor-sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--manor-sky-top)" />
          <stop offset="0.815" stopColor="var(--manor-sky-bottom)" />
        </linearGradient>
        <radialGradient id="manor-horizon-grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--manor-horizon-glow)" />
          <stop offset="1" stopColor="var(--manor-horizon-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="manor-moon-grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--manor-moon)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--manor-moon)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="manor-lantern-grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--manor-lantern)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--manor-lantern)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="manor-window-grad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--manor-window-glow)" stopOpacity="0.4" />
          <stop offset="1" stopColor="var(--manor-window-glow)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="manor-spill-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--manor-window-glow)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--manor-window-glow)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sky: top-to-horizon gradient; the horizon glow only appears from stage 3. */}
      <g className="layer layer--sky">
        <rect x="0" y="0" width="400" height="260" fill="url(#manor-sky-grad)" />
        <ellipse cx="200" cy="205" rx="260" ry="120" fill="url(#manor-horizon-grad)" />
      </g>
      <g className="layer layer--clouds">
        <ellipse cx="300" cy="40" rx="62" ry="6" fill="var(--manor-cloud)" />
        <ellipse cx="356" cy="56" rx="42" ry="5" fill="var(--manor-cloud)" />
        <ellipse cx="86" cy="26" rx="50" ry="5" fill="var(--manor-cloud)" />
        <ellipse cx="150" cy="78" rx="40" ry="4" fill="var(--manor-cloud)" />
      </g>
      <g className="layer layer--stars layer--minStage-2">
        <g fill="var(--manor-moon)" opacity="0.75">
          <circle cx="30" cy="62" r="1.1" />
          <circle cx="158" cy="26" r="1.1" />
          <circle cx="236" cy="22" r="1.2" />
          <circle cx="284" cy="64" r="1" />
          <circle cx="188" cy="12" r="1" />
          <circle cx="380" cy="100" r="1" />
        </g>
      </g>

      {/* Moon: appears at stage 1 and warms from silver to cream. */}
      <g className="layer layer--moon layer--minStage-1">
        <circle cx="338" cy="50" r="46" fill="url(#manor-moon-grad)" style={{ opacity: 'var(--manor-moon-glow)' }} />
        <circle cx="338" cy="50" r="17" fill="var(--manor-moon)" />
        <circle cx="332" cy="46" r="3.4" fill="var(--manor-sky-top)" opacity="0.18" />
        <circle cx="344" cy="57" r="2.4" fill="var(--manor-sky-top)" opacity="0.18" />
      </g>

      {/* Bare tree and headstones: always there, they give the grounds their mood. */}
      <g className="layer layer--tree">
        <g
          stroke="var(--manor-tree)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M52 214 C51 192 50 172 54 150" strokeWidth="5" />
          <path d="M54 152 C48 140 40 132 28 126" />
          <path d="M54 152 C60 140 66 130 78 124" />
          <path d="M52 174 C44 168 36 166 26 152" strokeWidth="2.4" />
          <path d="M53 166 C60 160 68 158 76 148" strokeWidth="2.4" />
          <path d="M40 133 C38 126 36 122 34 116" strokeWidth="2" />
        </g>
      </g>
      <g className="layer layer--tree-leaves layer--minStage-4">
        <g fill="var(--manor-garden)">
          <circle cx="38" cy="126" r="14" />
          <circle cx="62" cy="120" r="15" />
          <circle cx="50" cy="106" r="12" />
          <circle cx="28" cy="146" r="10" />
          <circle cx="76" cy="138" r="11" />
        </g>
      </g>
      <g className="layer layer--stones">
        <g fill="var(--manor-wall-shade)" stroke="var(--manor-roof-edge)" strokeWidth="1">
          <path d="M340 212 V198 Q340 190 347 190 Q354 190 354 198 V212 Z" />
          <path d="M362 212 V203 Q362 197 367 197 Q372 197 372 203 V212 Z" />
        </g>
      </g>

      {/* ---- Ruined manor (stages 0-1) ---- */}
      <g className="layer layer--ruined">
        {/* chimney stub, then the broken tower, main walls, roof and wing */}
        <polygon points="244,146 244,114 248,108 252,114 257,106 257,146" fill="var(--manor-wall-shade)" />
        <polygon
          points="86,214 86,100 92,92 98,102 105,90 112,100 119,94 124,102 124,214"
          fill="var(--manor-wall-shade)"
        />
        <polygon points="90,100 102,56 106,64 109,60 112,74 116,100" fill="var(--manor-roof)" />
        <polygon
          points="124,214 124,142 240,142 246,150 256,146 262,156 276,152 276,214"
          fill="var(--manor-wall)"
        />
        <polygon
          points="276,214 276,176 288,168 296,178 312,170 330,180 330,214"
          fill="var(--manor-wall-shade)"
        />
        <polygon points="270,176 303,128 308,138 286,176" fill="var(--manor-roof)" />
        <polygon
          points="114,144 200,66 216,82 207,90 225,102 216,110 238,122 229,130 252,140 252,144"
          fill="var(--manor-roof)"
          stroke="var(--manor-roof-edge)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* bare rafters where the slate has fallen */}
        <path
          d="M216 82 L262 128 M207 90 L246 134"
          stroke="var(--manor-roof)"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        {/* ivy-dark cracks */}
        <path
          d="M140 150 L146 168 L140 182 M262 164 L258 182 L264 200"
          stroke="var(--manor-window-dark)"
          strokeWidth="1.2"
          opacity="0.7"
          fill="none"
        />
      </g>

      {/* ---- Restored manor (stage 2+) ---- */}
      <g className="layer layer--walls layer--minStage-2">
        <g stroke="var(--manor-roof-edge)" strokeWidth="1.1" strokeLinejoin="round">
          {/* chimney with cap, behind the roof */}
          <rect x="243" y="78" width="14" height="48" fill="var(--manor-wall-shade)" />
          <rect x="241" y="73" width="18" height="6" fill="var(--manor-roof)" />
          {/* tower and spire */}
          <rect x="86" y="102" width="38" height="112" fill="var(--manor-wall-shade)" />
          <polygon points="78,106 105,34 132,106" fill="var(--manor-roof)" />
          {/* wing */}
          <rect x="276" y="172" width="54" height="42" fill="var(--manor-wall-shade)" />
          <polygon points="268,176 303,124 338,176" fill="var(--manor-roof)" />
          {/* main hall and its steep gable */}
          <rect x="124" y="140" width="152" height="74" fill="var(--manor-wall)" />
          <polygon points="112,144 200,64 288,144" fill="var(--manor-roof)" />
        </g>
        {/* slate courses, finials, and the stone course under the eaves */}
        <g stroke="var(--manor-roof-edge)" strokeWidth="1" opacity="0.4" fill="none">
          <path d="M165 96 H235 M145 114 H255 M127 130 H273" />
          <path d="M94 62 H116 M88 80 H122 M84 94 H126" />
          <path d="M290 146 H316 M282 160 H324" />
        </g>
        <g stroke="var(--manor-roof-edge)" strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M105 34 V22 M200 64 V52 M303 124 V114" />
          <path d="M124 142 H276" strokeWidth="1.2" opacity="0.6" />
        </g>
        <g fill="var(--manor-roof-edge)">
          <circle cx="105" cy="21" r="2" />
          <circle cx="200" cy="51" r="2" />
          <circle cx="303" cy="113" r="1.8" />
        </g>
      </g>

      {/* Smoke from the chimney, from stage 3. */}
      <g className="layer layer--smoke layer--minStage-3">
        <path
          className="smoke"
          d="M250 70 C245 60 256 52 250 42 C246 34 254 28 252 18"
          stroke="var(--manor-smoke)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Dark window sockets (every stage). */}
      <g className="layer layer--windows">
        <g fill="var(--manor-window-dark)" stroke="var(--manor-roof-edge)" strokeWidth="1">
          {ALL_WINDOWS.map((spec) => (
            <path key={spec.key} d={lancet(spec.cx, spec.top, spec.w, spec.h)} />
          ))}
          {/* the doorway */}
          <path d={lancet(200, 166, 30, 46)} />
        </g>
      </g>

      {/* Planks nailed over the openings of the abandoned house (stages 0-1). */}
      <g className="layer layer--boards">
        <g fill="var(--manor-iron)" opacity="0.85">
          <rect x="230" y="172" width="28" height="4" transform="rotate(-14 244 174)" />
          <rect x="230" y="184" width="28" height="4" transform="rotate(11 244 186)" />
          <rect x="185" y="184" width="30" height="4.5" transform="rotate(8 200 186)" />
          <rect x="185" y="196" width="30" height="4.5" transform="rotate(-6 200 198)" />
        </g>
      </g>

      {/* One faint candle in the tower at stage 1. */}
      <g className="layer layer--windows-faint layer--minStage-1">
        <path d={lancet(W_TOWER_LOW.cx, W_TOWER_LOW.top, W_TOWER_LOW.w, W_TOWER_LOW.h)} fill="var(--manor-window-lit)" opacity="0.5" />
      </g>

      {/* Lit windows: three at stage 2, all six from stage 3. */}
      <g className="layer layer--windows-lit layer--minStage-2">
        <LitWindow spec={W_TOWER_LOW} />
        <LitWindow spec={W_LEFT} />
        <LitWindow spec={W_RIGHT} />
      </g>
      <g className="layer layer--windows-lit-more layer--minStage-3">
        <LitWindow spec={W_ATTIC} />
        <LitWindow spec={W_BELFRY} />
        <LitWindow spec={W_WING} />
      </g>

      {/* Stage-up beat: the lit windows brighten one after another. */}
      {beatWindows.length > 0 && (
        <g key={beat} className="manor-beat">
          {beatWindows.map((spec, i) => (
            <path
              key={spec.key}
              className="manor-beat__pane"
              d={lancet(spec.cx, spec.top, spec.w, spec.h)}
              style={{ animationDelay: `ms` }}
              onAnimationEnd={
                i === beatWindows.length - 1 ? () => setBeat(null) : undefined
              }
            />
          ))}
        </g>
      )}

      {/* Front door, restored from stage 2. */}
      <g className="layer layer--door layer--minStage-2">
        <path
          d={lancet(200, 166, 30, 46)}
          fill="var(--manor-door)"
          stroke="var(--manor-roof-edge)"
          strokeWidth="1.5"
        />
        <path
          d="M200 172 V212 M193 192 H207"
          stroke="var(--manor-window-dark)"
          strokeWidth="1.2"
          opacity="0.5"
          fill="none"
        />
        <circle cx="206" cy="196" r="1.6" fill="var(--manor-iron)" />
      </g>

      {/* Ground, path and low mist in front of the house. */}
      <g className="layer layer--ground">
        <path d="M0 212 Q70 208 140 212 T280 212 T400 211 V260 H0 Z" fill="var(--manor-ground)" />
      </g>
      <g className="layer layer--path layer--minStage-2">
        <polygon points="190,212 210,212 232,260 168,260" fill="var(--manor-wall)" opacity="0.9" />
      </g>
      <g className="layer layer--spill layer--minStage-3">
        <polygon points="188,212 212,212 244,246 156,246" fill="url(#manor-spill-grad)" />
      </g>

      {/* Lanterns beside the door, lit from stage 4. */}
      <g className="layer layer--lanterns layer--minStage-4">
        {[175, 225].map((x) => (
          <g key={x}>
            <circle cx={x} cy="184" r="15" fill="url(#manor-lantern-grad)" />
            <path
              d={`M${x} 170 V175 M${x - 5} 178 L${x} 174 L${x + 5} 178`}
              stroke="var(--manor-iron)"
              strokeWidth="1.4"
              fill="none"
              strokeLinejoin="round"
            />
            <rect
              x={x - 4}
              y="178"
              width="8"
              height="11"
              rx="1"
              fill="var(--manor-lantern)"
              stroke="var(--manor-iron)"
              strokeWidth="1"
            />
          </g>
        ))}
      </g>

      {/* Iron fence: neglected at stages 0-1, mended from stage 2. */}
      <g className="layer layer--fence-ruined">
        <g stroke="var(--manor-iron)" fill="var(--manor-iron)" strokeWidth="2.4" strokeLinejoin="round">
          {FENCE_RUINED.map((p) => (
            <path key={p.x} d={p.d} transform={p.lean} />
          ))}
          <path d="M0 212 H46 M98 213 H130 M236 212 H284 M330 213 H356" fill="none" strokeWidth="1.8" />
        </g>
      </g>
      <g className="layer layer--fence layer--minStage-2">
        <g stroke="var(--manor-iron)" fill="var(--manor-iron)" strokeWidth="2.4" strokeLinejoin="round">
          <path d={FENCE_MENDED} />
          <path d="M0 212 H176 M224 212 H400 M0 224 H176 M224 224 H400" fill="none" strokeWidth="1.8" />
        </g>
      </g>
      <g className="layer layer--gate layer--minStage-4">
        <g fill="var(--manor-iron)">
          <circle cx="176" cy="195" r="3.4" />
          <circle cx="224" cy="195" r="3.4" />
        </g>
      </g>

      {/* Garden and, at the top stage, a few blooms. */}
      <g className="layer layer--garden layer--minStage-4">
        <g fill="var(--manor-garden)">
          <circle cx="26" cy="224" r="10" />
          <circle cx="42" cy="228" r="8" />
          <circle cx="374" cy="224" r="10" />
          <circle cx="358" cy="228" r="8" />
          <circle cx="146" cy="218" r="7" />
          <circle cx="254" cy="218" r="7" />
        </g>
      </g>
      <g className="layer layer--blooms layer--minStage-5">
        <g fill="var(--manor-sparkle)">
          <circle cx="24" cy="219" r="1.8" />
          <circle cx="44" cy="224" r="1.6" />
          <circle cx="372" cy="219" r="1.8" />
          <circle cx="356" cy="224" r="1.6" />
          <circle cx="146" cy="214" r="1.5" />
          <circle cx="254" cy="214" r="1.5" />
        </g>
      </g>

      {/* Low drifting mist across the whole scene. */}
      <g className="layer layer--fog fog">
        <ellipse cx="80" cy="226" rx="150" ry="14" fill="var(--manor-fog)" />
        <ellipse cx="320" cy="234" rx="160" ry="14" fill="var(--manor-fog)" />
      </g>

      {/* Spectral lights at the top stage. */}
      <g className="layer layer--sparkles layer--minStage-5">
        <g fill="var(--manor-sparkle)">
          <path className="spark spark--1" d={spark(160, 70, 4.5)} />
          <path className="spark spark--2" d={spark(250, 50, 4)} />
          <path className="spark spark--3" d={spark(118, 52, 3.4)} />
          <path className="spark spark--4" d={spark(304, 98, 3.6)} />
          <path className="spark spark--5" d={spark(204, 36, 3)} />
        </g>
      </g>
    </svg>
  );
}
