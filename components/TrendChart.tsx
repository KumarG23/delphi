import { useId } from 'react';
import { Text, View } from 'react-native';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { ChartErrorBoundary } from '@/components/ChartErrorBoundary';
import {
  fontSize,
  themeDark,
} from '@/constants/tokens';
import { fmtCurrencyFull, fmtTooltipDate } from '@/lib/format';

const T = themeDark;

export interface TrendChartProps {
  data: { value: number; date: string }[];
  color: string;
  onActiveValueChange?: (value: number | null) => void;
  height?: number;
  // OPTIONAL markers for v1 global events (dashboard net-worth chart only).
  // Existing callers (e.g. account detail) pass nothing and must render identically.
  markers?: { date: string; label: string }[];
}

/**
 * Reusable balance trend area chart extracted from the dashboard.
 * - Uses recharts AreaChart with gradient, custom tooltip, activeDot.
 * - Wraps itself in ChartErrorBoundary (both dashboard + detail get it for free).
 * - onActiveValueChange(value) on hover; null on leave (caller drives scrub/hero).
 * - Gradient id is instance-unique via useId() so multiple charts (e.g. dash + detail) coexist safely.
 */
export function TrendChart({
  data,
  color,
  onActiveValueChange,
  height = 220,
  markers = [],
}: TrendChartProps) {
  // Stable unique id per chart instance for the <linearGradient>.
  const gradId = useId().replace(/:/g, '_');

  // Snap marker date to nearest data point date (for ReferenceLine x alignment).
  // Events rarely fall exactly on a snapshot; use the closest in the *provided* data.
  const snapMarkerDate = (target: string): string => {
    if (!data.length) return target;
    let best = data[0].date;
    let bestDiff = Math.abs(new Date(target).getTime() - new Date(best).getTime());
    for (const pt of data) {
      const diff = Math.abs(new Date(target).getTime() - new Date(pt.date).getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        best = pt.date;
      }
    }
    return best;
  };

  return (
    <ChartErrorBoundary
      fallback={
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: T.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: T.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              color: T.textDim,
              fontSize: fontSize.sm,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            Could not render chart
          </Text>
        </View>
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 18, left: 18, bottom: 0 }}
          onMouseMove={(s: any) => {
            if (s?.isTooltipActive && s.activePayload?.length) {
              onActiveValueChange?.(s.activePayload[0].payload.value);
            } else {
              onActiveValueChange?.(null);
            }
          }}
          onMouseLeave={() => {
            onActiveValueChange?.(null);
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Hidden XAxis (categorical on date) so ReferenceLines can key by date string.
              Must not affect layout for callers that don't pass markers (area fills width as before). */}
          <XAxis dataKey="date" hide />

          <Tooltip
            cursor={{
              stroke: T.textDim,
              strokeDasharray: '3 3',
              strokeWidth: 1,
            }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div
                  style={{
                    backgroundColor: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: '6px 10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  }}
                >
                  <div
                    style={{
                      color: color,
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {fmtCurrencyFull(p.value)}
                  </div>
                  <div
                    style={{
                      color: T.textDim,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {fmtTooltipDate(p.date)}
                  </div>
                </div>
              );
            }}
          />

          {/* Subtle dashed milestone markers (snapped to nearest data point date).
              Only rendered when provided; otherwise identical to before. Keep visually subtle. */}
          {markers.map((m, idx) => {
            const snapped = snapMarkerDate(m.date);
            const short = m.label.length > 14 ? m.label.slice(0, 11) + '…' : m.label;
            return (
              <ReferenceLine
                key={idx}
                x={snapped}
                stroke={T.textDim}
                strokeDasharray="2 4"
                label={{
                  value: short,
                  position: 'top',
                  fill: T.textDim,
                  fontSize: 10,
                }}
              />
            );
          })}

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.2}
            fill={`url(#${gradId})`}
            activeDot={{
              r: 5,
              fill: color,
              stroke: T.bg,
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartErrorBoundary>
  );
}
