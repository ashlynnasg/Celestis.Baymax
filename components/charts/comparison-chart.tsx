import { useMemo, useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { COLORS, UI } from "@/lib/ui";
import { formatNumber } from "@/shared/format";

export type SeriesPoint = { dayIndex: number; value: number; observedAt: string };

type Props = {
  baseline: SeriesPoint[];
  scenario: SeriesPoint[];
  unit: string;
  height?: number;
  selectedDay: number;
};

/**
 * Overlay of the recorded baseline and a simulated run, aligned by relative day so the two series
 * are comparable even though their calendar dates differ. Missing days stay missing.
 */
export function ComparisonChart({ baseline, scenario, unit, height = 170, selectedDay }: Props) {
  const [width, setWidth] = useState(0);
  const padding = { left: 8, right: 8, top: 14, bottom: 20 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const geometry = useMemo(() => {
    const values = [...baseline, ...scenario].map((point) => point.value);
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, Math.abs(max) * 0.1, 1);
    const low = min - span * 0.15;
    const high = max + span * 0.15;
    const maxDay = Math.max(
      1,
      ...[...baseline, ...scenario].map((point) => point.dayIndex),
    );
    const x = (dayIndex: number) => padding.left + (dayIndex / maxDay) * plotWidth;
    const y = (value: number) => padding.top + (1 - (value - low) / (high - low)) * plotHeight;
    return { x, y, low, high, maxDay };
  }, [baseline, scenario, plotWidth, plotHeight, padding.left, padding.top]);

  const pathFor = (points: SeriesPoint[]) => {
    if (!geometry) return "";
    const ordered = [...points].sort((left, right) => left.dayIndex - right.dayIndex);
    return ordered
      .map((point, index) => `${index === 0 ? "M" : "L"}${geometry.x(point.dayIndex).toFixed(1)},${geometry.y(point.value).toFixed(1)}`)
      .join(" ");
  };

  return (
    <View style={{ gap: 8 }}>
      <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ width: "100%" }}>
        {width > 0 && geometry ? (
          <Svg width={width} height={height} accessibilityLabel="Baseline and simulated values aligned by relative day. Table values below.">
            <Line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} stroke={COLORS.border} strokeWidth={1} />
            <Line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke={COLORS.border}
              strokeWidth={1}
            />
            <Line
              x1={geometry.x(selectedDay - 1)}
              y1={padding.top}
              x2={geometry.x(selectedDay - 1)}
              y2={height - padding.bottom}
              stroke={`${COLORS.rose}66`}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <Path d={pathFor(baseline)} stroke={COLORS.textFaint} strokeWidth={2} fill="none" strokeDasharray="5 4" />
            <Path d={pathFor(scenario)} stroke={COLORS.rose} strokeWidth={2.4} fill="none" />
            {scenario.map((point) => (
              <Circle
                key={`s-${point.dayIndex}`}
                cx={geometry.x(point.dayIndex)}
                cy={geometry.y(point.value)}
                r={point.dayIndex === selectedDay - 1 ? 5 : 3}
                fill={point.dayIndex === selectedDay - 1 ? COLORS.text : COLORS.background}
                stroke={COLORS.rose}
                strokeWidth={2}
              />
            ))}
            <SvgText x={padding.left} y={padding.top - 3} fill={COLORS.textFaint} fontSize={9}>
              {`${formatNumber(geometry.high, 1)} ${unit}`.trim()}
            </SvgText>
            <SvgText x={width - padding.right} y={height - 6} fill={COLORS.textFaint} fontSize={9} textAnchor="end">
              {`day ${geometry.maxDay}`}
            </SvgText>
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 14, height: 2, backgroundColor: COLORS.textFaint }} />
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>Recorded baseline (relative day)</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 14, height: 2, backgroundColor: COLORS.rose }} />
          <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}>Simulated run</Text>
        </View>
      </View>
    </View>
  );
}
