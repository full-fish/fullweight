import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function ProgressBar({
  label,
  start,
  current,
  target,
  unit,
  color,
}: {
  label: string;
  start: number | undefined;
  current: number | undefined;
  target: number | undefined;
  unit: string;
  color: string;
}) {
  if (start == null || current == null || target == null) return null;
  const total = target - start;
  const progress = total !== 0 ? ((current - start) / total) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, progress));
  const isAchieved = clamped >= 100;

  return (
    <View style={ps.container}>
      <View style={ps.headerRow}>
        <Text style={ps.label}>{label}</Text>
        <Text style={[ps.percent, isAchieved && { color: "#38A169" }]}>
          {Math.round(clamped)}%
        </Text>
      </View>
      <View style={ps.track}>
        <View
          style={[ps.fill, { width: `${clamped}%`, backgroundColor: color }]}
        />
      </View>
      <View style={ps.detailRow}>
        <Text style={ps.detail}>
          시작: {start.toFixed(1)}
          {unit}
        </Text>
        <Text style={[ps.detail, { fontWeight: "600" }]}>
          현재: {current.toFixed(1)}
          {unit}
        </Text>
        <Text style={ps.detail}>
          목표: {target.toFixed(1)}
          {unit}
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
});
