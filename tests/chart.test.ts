import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNativeChartGeometry,
  filterChartPointsWithBaseline,
  findClosestChartPoint,
} from '../lib/chart';

const points = [
  { date: '2026-06-08', value: 100 },
  { date: '2026-07-26', value: 80 },
  { date: '2026-08-20', value: 60 },
];

test('range filtering includes the nearest pre-period baseline point', () => {
  const cutoff = Date.parse('2026-07-22T12:00:00Z');

  assert.deepEqual(filterChartPointsWithBaseline(points, cutoff), points);
});

test('range filtering does not duplicate a point when none precedes the cutoff', () => {
  const cutoff = Date.parse('2026-06-01T12:00:00Z');

  assert.deepEqual(filterChartPointsWithBaseline(points, cutoff), points);
});

test('native chart geometry produces finite line and area paths', () => {
  const geometry = buildNativeChartGeometry(points, 320, 220);

  assert.ok(geometry);
  assert.equal(geometry.points.length, 3);
  assert.match(geometry.linePath, /^M /);
  assert.match(geometry.areaPath, / Z$/);
  assert.equal(geometry.linePath.includes('NaN'), false);
});

test('native chart geometry safely expands a flat series', () => {
  const geometry = buildNativeChartGeometry([
    { date: '2026-08-01', value: 25 },
    { date: '2026-08-02', value: 25 },
  ], 320, 220);

  assert.ok(geometry);
  assert.equal(geometry.points.every(point => Number.isFinite(point.y)), true);
});

test('native chart geometry rejects non-finite dimensions', () => {
  assert.equal(buildNativeChartGeometry(points, Number.POSITIVE_INFINITY, 220), null);
  assert.equal(buildNativeChartGeometry(points, 320, Number.NaN), null);
  assert.equal(buildNativeChartGeometry(points, 320, 220, Number.NEGATIVE_INFINITY), null);
});

test('native scrub selects the closest point and rejects invalid coordinates', () => {
  const geometry = buildNativeChartGeometry(points, 320, 220);
  assert.ok(geometry);

  assert.equal(findClosestChartPoint(geometry.points, geometry.points[1].x + 2)?.date, '2026-07-26');
  assert.equal(findClosestChartPoint(geometry.points, Number.NaN), null);
});
