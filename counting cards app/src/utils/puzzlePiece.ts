export const PUZZLE_ROWS = 3;
export const PUZZLE_COLS = 2;
export const PUZZLE_PIECE_COUNT = PUZZLE_ROWS * PUZZLE_COLS;

const TAB_DEPTH = 6; // percentage points

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// A jagged (straight-segment, not curved) tab: flat run, angle out to a point, angle
// back in, flat run — reads as an angular puzzle knob rather than a smooth jigsaw curve.
const TAB_T = [0, 0.32, 0.42, 0.5, 0.58, 0.68, 1];
const TAB_PROFILE = [0, 0, 1.6, 2, 1.6, 0, 0];

/** Points for a horizontal internal edge from (x0,y) to (x1,y), left to right, bulging
    by sign*TAB_DEPTH in y. The piece on the other side of this edge must trace these
    exact points in reverse, so the two pieces share one boundary with no gap/overlap. */
function hEdgePoints(x0: number, x1: number, y: number, sign: number): [number, number][] {
  const d = TAB_DEPTH * sign;
  return TAB_T.map((t, i) => [lerp(x0, x1, t), y + d * TAB_PROFILE[i]] as [number, number]);
}

/** Same idea for a vertical internal edge from (x,y0) to (x,y1), top to bottom, bulging
    by sign*TAB_DEPTH in x. */
function vEdgePoints(y0: number, y1: number, x: number, sign: number): [number, number][] {
  const d = TAB_DEPTH * sign;
  return TAB_T.map((t, i) => [x + d * TAB_PROFILE[i], lerp(y0, y1, t)] as [number, number]);
}

const X = [0, 50, 100];
const Y = [0, 100 / 3, 200 / 3, 100];

// One fixed sign per internal edge (hand-picked for variety, not random) -- shared by
// both pieces on either side of it, which is what makes their tabs/notches match up.
const V_SIGN = [1, -1, 1]; // the one vertical line's 3 row-segments
const H_SIGN = [
[-1, 1], // the y=33% line's 2 col-segments
[1, -1]]; // the y=67% line's 2 col-segments


function buildPiecePoints(r: number, c: number): [number, number][] {
  const x0 = X[c], x1 = X[c + 1];
  const y0 = Y[r], y1 = Y[r + 1];

  const top: [number, number][] =
  r === 0 ?
  [[x0, y0], [x1, y0]] :
  hEdgePoints(x0, x1, y0, H_SIGN[r - 1][c]);

  const right: [number, number][] =
  c === PUZZLE_COLS - 1 ?
  [[x1, y0], [x1, y1]] :
  vEdgePoints(y0, y1, x1, V_SIGN[r]);

  const bottom: [number, number][] =
  r === PUZZLE_ROWS - 1 ?
  [[x1, y1], [x0, y1]] :
  [...hEdgePoints(x0, x1, y1, H_SIGN[r][c])].reverse();

  const left: [number, number][] =
  c === 0 ?
  [[x0, y1], [x0, y0]] :
  [...vEdgePoints(y0, y1, x0, V_SIGN[r])].reverse();

  return [...top, ...right, ...bottom, ...left];
}

const PIECE_POLYGONS: string[] = Array.from({ length: PUZZLE_PIECE_COUNT }, (_, i) => {
  const r = Math.floor(i / PUZZLE_COLS);
  const c = i % PUZZLE_COLS;
  const points = buildPiecePoints(r, c);
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
});

/** CSS clip-path polygon() for grid piece `index` (0..PUZZLE_PIECE_COUNT-1, row-major) --
    these 6 pieces tile the full card with matching interlocking tabs/notches. */
export function puzzlePieceClipPath(index: number): string {
  return PIECE_POLYGONS[index % PUZZLE_PIECE_COUNT];
}

// An irregular, angular "broken shard" outline -- built by walking around a center
// point at increasing angles with a hand-varied radius per step, so it reads as a
// jagged chunk of glass/stone rather than a symmetric jigsaw tab. The x values are
// pre-stretched (radius scaled ~1.3x horizontally) because every caller clips this
// inside a 5:7 (taller-than-wide) card box, where identical x/y percentages would
// otherwise land a shape drawn for a square box looking squashed and undersized.
// Points intentionally run slightly outside 0-100 in a couple of spots -- the box's
// own overflow-hidden trims them into a flat jagged edge right at the frame, which
// reads as the shard being cut off rather than as a bug.
export const FRAGMENT_ICON_CLIP_PATH = 'polygon(50% 4%, 72% 25%, 103% 35%, 83% 54%, 85% 82%, 55% 70%, 29% 84%, -1% 78%, 19% 50%, 5% 30%, 32% 26%)';
