import type { RawPoint } from './types.ts';

/**
 * Lecture GPX minimaliste et sans DOM (fonctionne dans React Native, Deno et Node).
 * Lit les <trkpt> (et à défaut les <rtept>) : lat, lon, ele, time, et l'extension
 * facultative <hdop>/<cr:acc> comme précision.
 */
export function parseGpx(xml: string): RawPoint[] {
  const points: RawPoint[] = [];
  const re = /<(trkpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
  let m: RegExpExecArray | null;
  let fakeT = Date.UTC(2026, 0, 1);
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[2] ?? '';
    const body = m[4] ?? '';
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]);
    const lng = Number(/\blon\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const ele = /<ele>\s*([^<]+?)\s*<\/ele>/.exec(body)?.[1];
    const time = /<time>\s*([^<]+?)\s*<\/time>/.exec(body)?.[1];
    const acc = /<(?:\w+:)?acc>\s*([^<]+?)\s*<\//.exec(body)?.[1];
    const hdop = /<hdop>\s*([^<]+?)\s*<\/hdop>/.exec(body)?.[1];
    const t = time ? Date.parse(time) : (fakeT += 1000);
    points.push({
      t,
      lat,
      lng,
      acc: acc != null ? Number(acc) : hdop != null ? Number(hdop) * 5 : null,
      alt: ele != null ? Number(ele) : null,
      altAcc: null,
      speed: null,
    });
  }
  return points;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Écriture GPX 1.1 (export des données personnelles, partage de sa propre trace). */
export function toGpx(name: string, points: readonly Pick<RawPoint, 't' | 'lat' | 'lng' | 'alt'>[]): string {
  const pts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${
          p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''
        }<time>${new Date(p.t).toISOString()}</time></trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Conquete Run" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
