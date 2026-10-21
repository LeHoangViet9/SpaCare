export type Signature = { version: 1; strokes: [number, number][][] };

// Normalized vector data only: no uploaded SVG/HTML, URLs or executable content.
export function isValidSignature(value: unknown): value is Signature {
  if (!value || typeof value !== 'object') return false;
  const signature = value as Signature;
  if (Object.keys(signature).some(key => !['version', 'strokes'].includes(key))) return false;
  if (signature.version !== 1 || !Array.isArray(signature.strokes) || !signature.strokes.length || signature.strokes.length > 30) return false;
  let count = 0, distance = 0;
  for (const stroke of signature.strokes) {
    if (!Array.isArray(stroke) || !stroke.length || stroke.length > 1000) return false;
    for (let i = 0; i < stroke.length; i++) {
      const point = stroke[i];
      if (!Array.isArray(point) || point.length !== 2 || !point.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)) return false;
      if (i) distance += Math.hypot(point[0] - stroke[i - 1][0], point[1] - stroke[i - 1][1]);
      if (++count > 1000) return false;
    }
  }
  return count >= 3 && distance >= 0.02;
}
