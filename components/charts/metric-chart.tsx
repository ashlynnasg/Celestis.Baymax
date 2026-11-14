import { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { COLORS, UI } from "@/lib/ui";
import { formatDateTime, formatNumber } from "@/shared/format";

export type ChartPoint = {
  id: string;
  value: number;
  label: string;
  observedAt: string;
  sourceLabel: string;
  context: string | null;
  unit: string;
};

type Props = {
  points: ChartPoint[];
  unit: string;
  color?: string;
  baselineMean?: number | null;
  height?: number;
  emptyHint?: string;
};

export function MetricChart({ points, unit, color = COLORS.rose, baselineMean, height = 150, emptyHint }: Props) {
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const padding = { left: 6, right: 6, top: 12, bottom: 18 };
  const plotWidth = Math.max(1, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const ordered = useMemo(
    () => [...points].sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime()),
    [points],
  );

  const geometry = useMemo(() => {
    if (ordered.length === 0) return null;
    const times = ordered.map((point) => new Date(point.observedAt).getTime());
    const values = ordered.map((point) => point.value);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const spanTime = Math.max(maxTime - minTime, 1);
    const minValue = Math.min(...values, ...(baselineMean !== null && baselineMean !== undefined ? [baselineMean] : []));
    const maxValue = Math.max(...values, ...(baselineMean !== null && baselineMean !== undefined ? [baselineMean] : []));
    const valueSpan = Math.max(maxValue - minValue, Math.max(1, Math.abs(maxValue) * 0.08));
    const low = minValue - valueSpan * 0.15;
    const high = maxValue + valueSpan * 0.15;

    const x = (time: number) => padding.left + ((time - minTime) / spanTime) * plotWidth;
    const y = (value: number) => padding.top + (1 - (value - low) / (high - low)) * plotHeight;

    const intervals = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
    const medianInterval = intervals.length > 0 ? intervals[Math.floor(intervals.length / 2)] : 0;
    const gapThreshold = Math.max(medianInterval * 2.2, 36 * 60 * 60 * 1000);

    const segments: { point: ChartPoint; cx: number; cy: number; time: number }[][] = [];
    let current: { point: ChartPoint; cx: number; cy: number; time: number }[] = [];
    ordered.forEach((point, index) => {
      const time = times[index];
      const entry = { point, cx: x(time), cy: y(point.value), time };
      if (current.length > 0 && time - current[current.length - 1].time > gapThreshold) {
        segments.push(current);
        current = [];
      }
      current.push(entry);
    });
    if (current.length > 0) segments.push(current);

    return {
      segments,
      low,
      high,
      x,
      y,
      minTime,
      maxTime,
      single: ordered.length === 1,
      firstTime: times[0],
      lastTime: times[times.length - 1],
    };
  }, [ordered, plotWidth, plotHeight, baselineMean, padding.left, padding.top]);

  const selected = ordered.find((point) => point.id === selectedId) ?? ordered[ordered.length - 1] ?? null;

  return (
    <View style={{ gap: 8 }}>
      <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ width: "100%" }}>
        {ordered.length === 0 ? (
          <View
            style={{
              height,
              borderRadius: UI.radiusSm,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderStyle: "dashed",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ color: COLORS.textFaint, fontSize: UI.small, textAlign: "center" }}>
              {emptyHint ?? "No observations in this range. Missing days are shown as gaps, never as zero."}
            </Text>
          </View>
        ) : width > 0 && geometry ? (
          <Svg width={width} height={height} accessibilityLabel={`${ordered.length} observations plotted. Use the table view for exact values.`}>
            <Line
              x1={padding.left}
              y1={geometry.y(geometry.high)}
              x2={width - padding.right}
              y2={geometry.y(geometry.high)}
              stroke={COLORS.border}
              strokeWidth={1}
            />
            <Line
              x1={padding.left}
              y1={geometry.y(geometry.low)}
              x2={width - padding.right}
              y2={geometry.y(geometry.low)}
              stroke={COLORS.border}
              strokeWidth={1}
            />
            {baselineMean !== null && baselineMean !== undefined ? (
              <>
                <Line
                  x1={padding.left}
                  y1={geometry.y(baselineMean)}
                  x2={width - padding.right}
                  y2={geometry.y(baselineMean)}
                  stroke={COLORS.textFaint}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <SvgText
                  x={width - padding.right}
                  y={geometry.y(baselineMean) - 4}
                  fill={COLORS.textFaint}
                  fontSize={9}
                  textAnchor="end"
                >
                  {`baseline mean ${formatNumber(baselineMean, 1)} ${unit}`}
                </SvgText>
              </>
            ) : null}
            {geometry.segments.map((segment, index) => {
              const path = segment
                .map((entry, entryIndex) => `${entryIndex === 0 ? "M" : "L"}${entry.cx.toFixed(1)},${entry.cy.toFixed(1)}`)
                .join(" ");
              return (
                <Path
                  key={`segment-${index}`}
                  d={segment.length === 1 ? `${path} L${(segment[0].cx + 0.1).toFixed(1)},${segment[0].cy.toFixed(1)}` : path}
                  stroke={color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
            {geometry.segments.flat().map((entry) => (
              <Circle
                key={entry.point.id}
                cx={entry.cx}
                cy={entry.cy}
                r={selectedId === entry.point.id ? 6 : 4}
                fill={selectedId === entry.point.id ? COLORS.text : COLORS.background}
                stroke={color}
                strokeWidth={2}
              />
            ))}
            <SvgText x={padding.left} y={height - 4} fill={COLORS.textFaint} fontSize={10}>
              {geometry.single ? "single observation" : new Date(geometry.firstTime).toISOString().slice(5, 10)}
            </SvgText>
            {!geometry.single ? (
              <SvgText x={width - padding.right} y={height - 4} fill={COLORS.textFaint} fontSize={9} textAnchor="end">
                {new Date(geometry.lastTime).toISOString().slice(5, 10)}
              </SvgText>
            ) : null}
            <SvgText x={padding.left} y={padding.top - 2} fill={COLORS.textFaint} fontSize={9}>
              {`${formatNumber(geometry.high, 1)} ${unit}`.trim()}
            </SvgText>
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>

      <View style={{ minHeight: 34 }}>
        {selected ? (
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>
            <Text style={{ color: COLORS.text, fontWeight: "700" }}>
              {formatNumber(selected.value, selected.unit === "%" || selected.unit === "bpm" ? 0 : 1)} {selected.unit}
            </Text>
            {` · ${formatDateTime(selected.observedAt)} · ${selected.sourceLabel}`}
            {selected.context ? ` · ${selected.context.replace("_", " ")}` : ""}
          </Text>
        ) : (
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>Newest observation shown. Open the table to pick any recorded point.</Text>
        )}
      </View>

      <Pressable onPress={() => setShowTable((value) => !value)} accessibilityRole="button" style={{ alignSelf: "flex-start" }}>
        <Text style={{ color: COLORS.roseSoft, fontSize: UI.small }}>{showTable ? "Hide table" : "Show as table"}</Text>
      </Pressable>

      {showTable ? (
        <View style={{ gap: 6 }}>
          {ordered
            .slice()
            .reverse()
            .map((point) => (
              <Pressable
                key={`row-${point.id}`}
                onPress={() => setSelectedId(point.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${formatDateTime(point.observedAt)} value ${formatNumber(point.value, 1)} ${point.unit}`}
                style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 2 }}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: UI.tiny, flex: 1 }}>{formatDateTime(point.observedAt)}</Text>
                <Text style={{ color: COLORS.text, fontSize: UI.tiny }}>
                  {formatNumber(point.value, 1)} {point.unit}
                </Text>
                <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, flex: 1, textAlign: "right" }} numberOfLines={1}>
                  {point.sourceLabel}
                </Text>
              </Pressable>
            ))}
        </View>
      ) : null}
    </View>
  );
}
