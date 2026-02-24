import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function ProgressBar({
  label,
  start,
  current,
  target,
  unit,
  color,
  pctStart,
  pctCurrent,
  pctTarget,
}: {
  label: string;
  start: number | undefined;
  current: number | undefined;
  target: number | undefined;
  unit: string;
  color: string;
  /** 시작/현재/목표 옆에 (%)로 표시할 값 (체지방량 등) */
  pctStart?: string;
  pctCurrent?: string;
  pctTarget?: string;
}) {
  if (target == null) return null;
  const hasData = start != null && current != null;
  const total = hasData ? target - start : 0;
  const progress =
    hasData && total !== 0 ? ((current - start) / total) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, progress));
  const isAchieved = hasData && clamped >= 100;

  return (
    <View style={ps.container}>
      <View style={ps.headerRow}>
        <Text style={ps.label}>{label}</Text>
        <Text style={[ps.percent, isAchieved && { color: "#38A169" }]}>
          {hasData ? `${Math.round(clamped)}%` : "—"}
        </Text>
      </View>
      <View style={ps.track}>
        {hasData && (
          <View
            style={[ps.fill, { width: `${clamped}%`, backgroundColor: color }]}
          />
        )}
      </View>
      <View style={ps.detailRow}>
        <Text style={ps.detail}>
          시작: {start != null ? `${start.toFixed(1)}${unit}` : "—"}
          {pctStart ? <Text style={ps.pctHint}>{` (${pctStart}%)`}</Text> : ""}
        </Text>
        <Text style={[ps.detail, { fontWeight: "600" }]}>
          현재: {current != null ? `${current.toFixed(1)}${unit}` : "—"}
          {pctCurrent ? (
            <Text style={ps.pctHint}>{` (${pctCurrent}%)`}</Text>
          ) : (
            ""
          )}
        </Text>
        <Text style={ps.detail}>
          목표: {target.toFixed(1)}
          {unit}
          {pctTarget ? (
            <Text style={ps.pctHint}>{` (${pctTarget}%)`}</Text>
          ) : (
            ""
          )}
        </Text>
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  container: { marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#4A5568" },
  percent: { fontSize: 14, fontWeight: "700", color: "#2D3748" },
  track: {
    height: 10,
    backgroundColor: "#EDF2F7",
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 5 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  detail: { fontSize: 11, color: "#A0AEC0" },
  pctHint: { fontSize: 10, color: "#A0AEC0" },
});
