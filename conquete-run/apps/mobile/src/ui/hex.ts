/** Hexagone « pointe en haut » aux coins arrondis, dans un carré size × size (chemin SVG). */
export function hexPath(size: number, rounding = 0.12, inset = 0): string {
  const c = size / 2;
  const r = size / 2 - inset;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
  });
  const k = Math.max(0, Math.min(0.45, rounding));
  const lerp = (p: readonly [number, number], q: readonly [number, number], t: number) =>
    [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] as const;
  let d = '';
  for (let i = 0; i < 6; i++) {
    const prev = pts[(i + 5) % 6]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % 6]!;
    const a = lerp(cur, prev, k);
    const b = lerp(cur, next, k);
    d += `${i === 0 ? 'M' : 'L'}${a[0].toFixed(2)},${a[1].toFixed(2)} Q${cur[0].toFixed(2)},${cur[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)} `;
  }
  return `${d}Z`;
}
