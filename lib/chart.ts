export interface DatedChartPoint {
  date: string;
  value: number;
}

export interface NativeChartGeometry {
  linePath: string;
  areaPath: string;
  points: Array<{ x: number; y: number; value: number; date: string }>;
}

export function findClosestChartPoint<T extends { x: number }>(points: T[], x: number): T | null {
  if (!points.length || !Number.isFinite(x)) return null;
  return points.reduce((closest, point) => (
    Math.abs(point.x - x) < Math.abs(closest.x - x) ? point : closest
  ));
}

function finitePoints<T extends DatedChartPoint>(points: T[]): T[] {
  return points
    .filter(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(`${point.date}T12:00:00Z`)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function filterChartPointsWithBaseline<T extends DatedChartPoint>(
  points: T[],
  cutoffMs: number | null,
): T[] {
  const sorted = finitePoints(points);
  if (cutoffMs === null) return sorted;

  const inside = sorted.filter(point => Date.parse(`${point.date}T12:00:00Z`) >= cutoffMs);
  const preceding = [...sorted]
    .reverse()
    .find(point => Date.parse(`${point.date}T12:00:00Z`) < cutoffMs);

  return preceding ? [preceding, ...inside] : inside;
}

export function buildNativeChartGeometry(
  data: DatedChartPoint[],
  width: number,
  height: number,
  padding = 16,
): NativeChartGeometry | null {
  const sorted = finitePoints(data);
  if (
    sorted.length < 2
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || !Number.isFinite(padding)
    || padding < 0
    || width <= padding * 2
    || height <= padding * 2
  ) return null;

  const values = sorted.map(point => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const cushion = Math.max(Math.abs(min) * 0.02, 1);
    min -= cushion;
    max += cushion;
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const points = sorted.map((point, index) => ({
    x: padding + (index / (sorted.length - 1)) * innerWidth,
    y: padding + ((max - point.value) / (max - min)) * innerHeight,
    value: point.value,
    date: point.date,
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1)!.x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  return { linePath, areaPath, points };
}
