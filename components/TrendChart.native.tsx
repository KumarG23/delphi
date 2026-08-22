import { useId, useMemo, useState } from 'react';
import { type GestureResponderEvent, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { buildNativeChartGeometry, findClosestChartPoint } from '@/lib/chart';
import { fmtCurrencyFull, fmtTooltipDate } from '@/lib/format';

export interface TrendChartProps {
  data: { value: number; date: string }[];
  color: string;
  onActiveValueChange?: (value: number | null) => void;
  height?: number;
  markers?: { date: string; label: string }[];
}

export function TrendChart({
  data,
  color,
  onActiveValueChange,
  height = 220,
  markers = [],
}: TrendChartProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '_');
  const geometry = useMemo(
    () => buildNativeChartGeometry(data, width, height),
    [data, width, height],
  );

  const markerXs = useMemo(() => {
    if (!geometry) return [];
    return markers.map(marker => {
      let closest = geometry.points[0];
      let closestDistance = Math.abs(Date.parse(`${marker.date}T12:00:00Z`) - Date.parse(`${closest.date}T12:00:00Z`));
      for (const point of geometry.points) {
        const distance = Math.abs(Date.parse(`${marker.date}T12:00:00Z`) - Date.parse(`${point.date}T12:00:00Z`));
        if (distance < closestDistance) {
          closest = point;
          closestDistance = distance;
        }
      }
      return closest.x;
    });
  }, [geometry, markers]);
  const activePoint = activeIndex === null ? null : geometry?.points[activeIndex] ?? null;

  function updateActivePoint(event: GestureResponderEvent) {
    if (!geometry) return;
    const point = findClosestChartPoint(geometry.points, event.nativeEvent.locationX);
    if (!point) return;
    const index = geometry.points.indexOf(point);
    setActiveIndex(index);
    onActiveValueChange?.(point.value);
  }

  function clearActivePoint() {
    setActiveIndex(null);
    onActiveValueChange?.(null);
  }

  return (
    <View
      testID="native-trend-chart"
      style={{ width: '100%', height }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => Boolean(geometry)}
      onMoveShouldSetResponder={() => Boolean(geometry)}
      onResponderGrant={updateActivePoint}
      onResponderMove={updateActivePoint}
      onResponderRelease={clearActivePoint}
      onResponderTerminate={clearActivePoint}
    >
      {geometry && width > 0 ? (
        <Svg width={width} height={height} accessibilityLabel="Balance trend chart">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.34} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Line x1={16} y1={height / 2} x2={width - 16} y2={height / 2} stroke="#262626" strokeWidth={1} />
          {markerXs.map((x, index) => (
            <G key={`${x}-${index}`}>
              <Line
                x1={x}
                y1={12}
                x2={x}
                y2={height - 16}
                stroke="#555555"
                strokeWidth={1}
                strokeDasharray="3 5"
              />
              <SvgText x={x + 3} y={12} fill="#777777" fontSize={9}>
                {markers[index].label.length > 14
                  ? `${markers[index].label.slice(0, 11)}…`
                  : markers[index].label}
              </SvgText>
            </G>
          ))}
          <Path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <Path
            d={geometry.linePath}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {geometry.points.map((point, index) => (
            <Circle
              key={`${point.date}-${point.x}`}
              cx={point.x}
              cy={point.y}
              r={activeIndex === index ? 6 : 4}
              fill={color}
              stroke="#0A0A0A"
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : null}
      {activePoint && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 12, backgroundColor: '#161616', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }}>
          <Text style={{ color, fontSize: 13, fontWeight: '700' }}>{fmtCurrencyFull(activePoint.value)}</Text>
          <Text style={{ color: '#777777', fontSize: 10, marginTop: 2 }}>{fmtTooltipDate(activePoint.date)}</Text>
        </View>
      )}
    </View>
  );
}
