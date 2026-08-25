export const PUZZLE_ROWS = 3;
export const PUZZLE_COLS = 2;
export const PUZZLE_PIECE_COUNT = PUZZLE_ROWS * PUZZLE_COLS;

const TAB_DEPTH = 6; // percentage points

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// A jagged fracture line: flat run, then a zigzag of alternating in/out kinks building
// to a sharp central point and back down -- reads as a broken/cracked edge rather than
// a smooth, symmetric jigsaw knob.
const TAB_T = [0, 0.18, 0.3, 0.4, 0.5, 0.6, 0.7, 0.82, 1];
const TAB_PROFILE = [0, 0.5, -0.4, 1.1, 2.1, 1.1, -0.4, 0.5, 0];

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

/** Which grid piece a given fragment count represents, for the "you got a fragment"
    reveal icon -- cycles through the real 6 card-grid positions (1st fragment = piece
    0, 2nd = piece 1, ... 7th wraps back to piece 0) so every reveal actually shows a
    slice of that back's real artwork at a real position, not a generic placeholder
    shape. This is what makes the reveal read as "a piece of the card" that visibly
    belongs with the others once they all land on the Card Backs grid. */
export function fragmentIconClipPath(have: number): string {
  return puzzlePieceClipPath(Math.max(0, have - 1));
}
