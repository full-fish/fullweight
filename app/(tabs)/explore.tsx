import {
  METRIC_COLORS,
  METRIC_LABELS,
  METRIC_UNITS,
  MetricKey,
  PeriodMode,
  WeightRecord,
} from "@/types";
import { getLocalDateString, loadRecords } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

/* helpers */

function fmtLabel(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}\ub144 ${parseInt(m)}\uc6d4 ${parseInt(d)}\uc77c`;
}

function weekKey(dateStr: string) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function fmtMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y.slice(2)}/${m}`;
}

function fmtWeekLabel(key: string) {
  const [y, w] = key.split("-W");
  return `${y.slice(2)}W${w}`;
}

function getMetricValue(r: WeightRecord, key: MetricKey): number | null {
  if (key === "weight") return r.weight > 0 ? r.weight : null;
  if (key === "waist") return r.waist ?? null;
  if (key === "muscleMass") return r.muscleMass ?? null;
  if (key === "bodyFatPercent") return r.bodyFatPercent ?? null;
  if (key === "bodyFatMass") return r.bodyFatMass ?? null;
  return null;
}

function safeData(arr: number[]) {
  return arr.length > 0 ? arr : [0];
}

function hexToRGBA(hex: string, opacity: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/* date picker */

function DatePickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.dateRow}>
      <Text style={s.dateLabel}>{label}</Text>
      <TextInput
        style={s.dateInput}
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#aaa"
        maxLength={10}
        keyboardType={
          Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
        }
      />
    </View>
  );
}

/* Single Metric Chart */

function SingleMetricChart({
  metricKey,
  slicedData,
  chartLabels,
  onDotPress,
  compact,
}: {
  metricKey: MetricKey;
  slicedData: WeightRecord[];
  chartLabels: string[];
  onDotPress: (idx: number) => void;
  compact?: boolean;
}) {
  const color = METRIC_COLORS[metricKey];
  const data = safeData(
    slicedData.map((r) => getMetricValue(r, metricKey) ?? 0)
  );
  const hasData = slicedData.length >= 2;

  if (!hasData) {
    return (
      <View style={s.emptyMiniChart}>
        <Text style={s.emptyText}>
          {METRIC_LABELS[metricKey]} \ub370\uc774\ud130\uac00 \ubd80\uc871\ud569\ub2c8\ub2e4.
        </Text>
      </View>
    );
  }

  return (
    <View style={compact ? s.miniChartWrap : undefined}>
      {compact && (
        <View style={s.miniChartHeader}>
          <View style={[s.legendDot, { backgroundColor: color }]} />
          <Text style={s.miniChartTitle}>
            {METRIC_LABELS[metricKey]} ({METRIC_UNITS[metricKey]})
          </Text>
        </View>
      )}
      <LineChart
        data={{
          labels: chartLabels,
          datasets: [
            {
              data,
              color: (opacity = 1) => hexToRGBA(color, opacity),
              strokeWidth: 2,
            },
          ],
        }}
        width={CHART_WIDTH}
        height={compact ? 160 : 220}
        chartConfig={{
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          color: (opacity = 1) => hexToRGBA(color, opacity),
          labelColor: (opacity = 1) => `rgba(113,128,150,${opacity})`,
          strokeWidth: 2,
          propsForDots: {
            r: "3.5",
            strokeWidth: "1.5",
            stroke: color,
            fill: "#fff",
          },
          propsForBackgroundLines: { stroke: "#F0F4F8" },
          decimalPlaces: 1,
        }}
        bezier
        style={s.chart}
        withVerticalLines={false}
        withShadow={false}
        formatYLabel={(v) => parseFloat(v).toFixed(1)}
        onDataPointClick={({ index }) => onDotPress(index)}
      />
    </View>
  );
}

/* MAIN */

export default function ChartScreen() {
  const [allRecords, setAllRecords] = useState<WeightRecord[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(["weight"]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statsMetric, setStatsMetric] = useState<MetricKey>("weight");
  const [statsStart, setStatsStart] = useState("");
  const [activityStart, setActivityStart] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<WeightRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        setAllRecords([...data].sort((a, b) => a.date.localeCompare(b.date)));
      });
    }, [])
  );

  const filteredRecords = useMemo(() => {
    let recs = allRecords;
    if (periodMode === "custom") {
      if (customStart) recs = recs.filter((r) => r.date >= customStart);
      if (customEnd) recs = recs.filter((r) => r.date <= customEnd);
    } else {
      const today = getLocalDateString();
      if (periodMode === "daily") {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        const start = getLocalDateString(d);
        recs = recs.filter((r) => r.date >= start && r.date <= today);
      } else if (periodMode === "weekly") {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        const start = getLocalDateString(d);
        recs = recs.filter((r) => r.date >= start && r.date <= today);
      }
    }
    return recs;
  }, [allRecords, periodMode, customStart, customEnd]);

  const chartData = useMemo(() => {
    if (periodMode === "daily" || periodMode === "custom") {
      return filteredRecords;
    }
    const keyFn = periodMode === "weekly" ? weekKey : monthKey;
    const groups: Record<string, WeightRecord[]> = {};
    filteredRecords.forEach((r) => {
      const k = keyFn(r.date);
      (groups[k] ??= []).push(r);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, recs]) => {
        const avg = (vals: (number | null)[]) => {
          const valid = vals.filter((v): v is number => v !== null);
          return valid.length > 0
            ? valid.reduce((a, b) => a + b, 0) / valid.length
            : null;
        };
        return {
          id: key,
          date: key,
          weight: avg(recs.map((r) => r.weight)) ?? 0,
          waist: avg(recs.map((r) => r.waist ?? null)) ?? undefined,
          muscleMass: avg(recs.map((r) => r.muscleMass ?? null)) ?? undefined,
          bodyFatPercent: avg(recs.map((r) => r.bodyFatPercent ?? null)) ?? undefined,
          bodyFatMass: avg(recs.map((r) => r.bodyFatMass ?? null)) ?? undefined,
          exercised: recs.some((r) => r.exercised),
          drank: recs.some((r) => r.drank),
        } as WeightRecord;
      });
  }, [filteredRecords, periodMode]);

  const chartLabels = useMemo(() => {
    const recs = chartData.slice(-30);
    const step = recs.length > 10 ? Math.ceil(recs.length / 6) : 1;
    return recs.map((r, i) => {
      if (i % step !== 0) return "";
      if (periodMode === "monthly") return fmtMonthLabel(r.date);
      if (periodMode === "weekly") return fmtWeekLabel(r.date);
      return fmtLabel(r.date);
    });
  }, [chartData, periodMode]);

  const slicedData = chartData.slice(-30);

  const statsRecords = useMemo(() => {
    let recs = allRecords;
    if (statsStart) recs = recs.filter((r) => r.date >= statsStart);
    return recs.filter((r) => getMetricValue(r, statsMetric) !== null);
  }, [allRecords, statsStart, statsMetric]);

  const stats = useMemo(() => {
    if (statsRecords.length === 0) return null;
    const vals = statsRecords.map((r) => getMetricValue(r, statsMetric)!);
    const current = vals[vals.length - 1];
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const diff = vals.length >= 2 ? current - vals[0] : null;
    const unit = METRIC_UNITS[statsMetric];
    return { current, max, min, avg, diff, unit };
  }, [statsRecords, statsMetric]);

  const activityRecords = useMemo(() => {
    let recs = allRecords;
    if (activityStart) recs = recs.filter((r) => r.date >= activityStart);
    return recs;
  }, [allRecords, activityStart]);

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  const handleDotPress = (dataIdx: number) => {
    if (periodMode !== "daily" && periodMode !== "custom") return;
    const rec = slicedData[dataIdx];
    if (rec) setSelectedPoint(rec);
  };

  const METRICS: MetricKey[] = ["weight", "waist", "muscleMass", "bodyFatPercent", "bodyFatMass"];
  const isSingleMetric = selectedMetrics.length === 1;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>{"\ud83d\udcca"} \uae30\ub85d \uadf8\ub798\ud504</Text>

      <View style={s.metricRow}>
        {METRICS.map((key) => {
          const active = selectedMetrics.includes(key);
          return (
            <TouchableOpacity
              key={key}
              style={[
                s.metricChip,
                active && {
                  backgroundColor: METRIC_COLORS[key] + "22",
                  borderColor: METRIC_COLORS[key],
                },
              ]}
              onPress={() => toggleMetric(key)}
            >
              <View
                style={[
                  s.metricDot,
                  { backgroundColor: active ? METRIC_COLORS[key] : "#CBD5E0" },
                ]}
              />
              <Text
                style={[
                  s.metricChipText,
                  active && { color: METRIC_COLORS[key] },
                ]}
              >
                {METRIC_LABELS[key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.periodRow}>
        {(["daily", "weekly", "monthly", "custom"] as PeriodMode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[s.periodBtn, periodMode === m && s.periodBtnActive]}
            onPress={() => setPeriodMode(m)}
          >
            <Text
              style={[s.periodText, periodMode === m && s.periodTextActive]}
            >
              {
                {
                  daily: "\uc77c\ubcc4",
                  weekly: "\uc8fc\ubcc4",
                  monthly: "\uc6d4\ubcc4",
                  custom: "\uae30\uac04",
                }[m]
              }
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {periodMode === "custom" && (
        <View style={s.customDateCard}>
          <DatePickerRow label={"\uc2dc\uc791\uc77c"} value={customStart} onChange={setCustomStart} />
          <DatePickerRow label={"\uc885\ub8cc\uc77c"} value={customEnd} onChange={setCustomEnd} />
        </View>
      )}

      <View style={s.chartCard}>
        <Text style={s.chartTitle}>
          {selectedMetrics.map((k) => METRIC_LABELS[k]).join(" \u00b7 ")} \ucd94\uc774
        </Text>

        {isSingleMetric ? (
          <SingleMetricChart
            metricKey={selectedMetrics[0]}
            slicedData={slicedData}
            chartLabels={chartLabels}
            onDotPress={handleDotPress}
          />
        ) : (
          <>
            <Text style={s.multiAxisNote}>
              {"\ud83d\udcd0"} \uac01 \uc218\uce58\ubcc4 \ub3c5\ub9bd Y\ucd95\uc73c\ub85c \ud45c\uc2dc\ub429\ub2c8\ub2e4
            </Text>
            {selectedMetrics.map((key) => (
              <SingleMetricChart
                key={key}
                metricKey={key}
                slicedData={slicedData}
                chartLabels={chartLabels}
                onDotPress={handleDotPress}
                compact
              />
            ))}
          </>
        )}
      </View>

      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>{"\ud1b5\uacc4"}</Text>
          {statsStart ? (
            <TouchableOpacity onPress={() => setStatsStart("")}>
              <Text style={s.resetBtn}>{"\ucd08\uae30\ud654"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statsMetricScroll}>
          {METRICS.map((k) => (
            <TouchableOpacity
              key={k}
              style={[s.statsMetricBtn, statsMetric === k && { backgroundColor: METRIC_COLORS[k] }]}
              onPress={() => setStatsMetric(k)}
            >
              <Text style={[s.statsMetricText, statsMetric === k && s.statsMetricTextActive]}>
                {METRIC_LABELS[k]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <DatePickerRow label={"\uc2dc\uc791\uc77c"} value={statsStart} onChange={setStatsStart} />

        {stats ? (
          <>
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>{"\ucd5c\uadfc"}</Text>
                <Text style={s.statValue}>{stats.current.toFixed(1)}</Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>{"\ucd5c\uace0"}</Text>
                <Text style={[s.statValue, { color: "#E53E3E" }]}>{stats.max.toFixed(1)}</Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>{"\ucd5c\uc800"}</Text>
                <Text style={[s.statValue, { color: "#38A169" }]}>{stats.min.toFixed(1)}</Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>{"\ud3c9\uade0"}</Text>
                <Text style={s.statValue}>{stats.avg.toFixed(1)}</Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
            </View>
            {stats.diff !== null && (
              <View style={s.diffRow}>
                <Text style={s.diffLabel}>{"\uc2dc\uc791 \ub300\ube44"}</Text>
                <Text
                  style={[s.diffValue, { color: stats.diff <= 0 ? "#38A169" : "#E53E3E" }]}
                >
                  {stats.diff > 0 ? "+" : ""}{stats.diff.toFixed(1)} {stats.unit}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.noDataText}>{"\ud574\ub2f9 \uc218\uce58 \ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."}</Text>
        )}
      </View>

      {allRecords.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{"\ud65c\ub3d9 \uc694\uc57d"}</Text>
            {activityStart ? (
              <TouchableOpacity onPress={() => setActivityStart("")}>
                <Text style={s.resetBtn}>{"\ucd08\uae30\ud654"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <DatePickerRow label={"\uc2dc\uc791\uc77c"} value={activityStart} onChange={setActivityStart} />
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>{"\ud83d\udcc5"}</Text>
              <Text style={s.summaryCount}>{activityRecords.length}</Text>
              <Text style={s.summaryLabel}>{"\ucd1d \uae30\ub85d\uc77c"}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>{"\ud83c\udfc3"}</Text>
              <Text style={s.summaryCount}>{activityRecords.filter((r) => r.exercised).length}</Text>
              <Text style={s.summaryLabel}>{"\uc6b4\ub3d9\uc77c"}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>{"\ud83c\udf7a"}</Text>
              <Text style={s.summaryCount}>{activityRecords.filter((r) => r.drank).length}</Text>
              <Text style={s.summaryLabel}>{"\uc74c\uc8fc\uc77c"}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>{"\ud83d\udcaa"}</Text>
              <Text style={s.summaryCount}>
                {activityRecords.length > 0
                  ? Math.round(
                      (activityRecords.filter((r) => r.exercised).length /
                        activityRecords.length) *
                        100
                    )
                  : 0}%
              </Text>
              <Text style={s.summaryLabel}>{"\uc6b4\ub3d9\uc728"}</Text>
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={!!selectedPoint}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPoint(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPoint(null)}
        >
          <View style={s.modalCard}>
            {selectedPoint && (
              <>
                <Text style={s.modalDate}>{fmtDate(selectedPoint.date)}</Text>
                <View style={s.modalRow}>
                  <Text style={s.modalLabel}>{"\u2696\ufe0f \ubab8\ubb34\uac8c"}</Text>
                  <Text style={s.modalValue}>{selectedPoint.weight} kg</Text>
                </View>
                {selectedPoint.waist != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>{"\ud83d\udccf \ud5c8\ub9ac\ub458\ub808"}</Text>
                    <Text style={s.modalValue}>{selectedPoint.waist} cm</Text>
                  </View>
                )}
                {selectedPoint.muscleMass != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>{"\ud83d\udcaa \uace8\uaca9\uadfc\ub7c9"}</Text>
                    <Text style={s.modalValue}>{selectedPoint.muscleMass} kg</Text>
                  </View>
                )}
                {selectedPoint.bodyFatPercent != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>{"\ud83d\udd25 \uccb4\uc9c0\ubc29\ub960"}</Text>
                    <Text style={s.modalValue}>{selectedPoint.bodyFatPercent} %</Text>
                  </View>
                )}
                {selectedPoint.bodyFatMass != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>{"\ud83d\udfe3 \uccb4\uc9c0\ubc29\ub7c9"}</Text>
                    <Text style={s.modalValue}>{selectedPoint.bodyFatMass} kg</Text>
                  </View>
                )}
                {selectedPoint.photoUri && (
                  <Image source={{ uri: selectedPoint.photoUri }} style={s.modalPhoto} />
                )}
                <View style={s.modalBadges}>
                  {selectedPoint.exercised && (
                    <View style={[s.badge, s.badgeGreen]}>
                      <Text style={s.badgeText}>{"\ud83c\udfc3 \uc6b4\ub3d9"}</Text>
                    </View>
                  )}
                  {selectedPoint.drank && (
                    <View style={[s.badge, s.badgeOrange]}>
                      <Text style={s.badgeText}>{"\ud83c\udf7a \uc74c\uc8fc"}</Text>
                    </View>
                  )}
                  {!selectedPoint.exercised && !selectedPoint.drank && (
                    <Text style={s.noDataText}>{"\ud65c\ub3d9 \uae30\ub85d \uc5c6\uc74c"}</Text>
                  )}
                </View>
              </>
            )}
            <TouchableOpacity style={s.modalClose} onPress={() => setSelectedPoint(null)}>
              <Text style={s.modalCloseText}>{"\ub2eb\uae30"}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

/* styles */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: "#1A202C", marginBottom: 20 },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  metricDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  metricChipText: { fontSize: 13, fontWeight: "500", color: "#718096" },
  periodRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  periodBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  periodBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodText: { fontSize: 13, color: "#718096", fontWeight: "500" },
  periodTextActive: { color: "#2D3748", fontWeight: "600" },
  customDateCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dateLabel: { fontSize: 13, color: "#4A5568", width: 50 },
  dateInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: { fontSize: 15, fontWeight: "600", color: "#2D3748", marginBottom: 12 },
  chart: { borderRadius: 8, marginLeft: -10 },
  emptyChart: { alignItems: "center", paddingVertical: 48 },
  emptyMiniChart: { alignItems: "center", paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#A0AEC0", textAlign: "center" },
  multiAxisNote: { fontSize: 12, color: "#A0AEC0", textAlign: "center", marginBottom: 8 },
  miniChartWrap: { marginBottom: 12, borderTopWidth: 1, borderTopColor: "#F0F4F8", paddingTop: 10 },
  miniChartHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4, paddingLeft: 4 },
  miniChartTitle: { fontSize: 13, fontWeight: "600", color: "#4A5568", marginLeft: 6 },
  legendRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 12, color: "#718096" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#2D3748" },
  resetBtn: { fontSize: 13, color: "#E53E3E", fontWeight: "500" },
  statsMetricScroll: { marginBottom: 10 },
  statsMetricBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#EDF2F7",
    marginRight: 8,
  },
  statsMetricText: { fontSize: 13, color: "#718096", fontWeight: "500" },
  statsMetricTextActive: { color: "#fff" },
  statsGrid: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  statItem: { alignItems: "center" },
  statLabel: { fontSize: 12, color: "#A0AEC0", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#2D3748" },
  statUnit: { fontSize: 11, color: "#A0AEC0", marginTop: 2 },
  diffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
  },
  diffLabel: { fontSize: 14, color: "#718096" },
  diffValue: { fontSize: 18, fontWeight: "700" },
  noDataText: { textAlign: "center", color: "#A0AEC0", fontSize: 13, marginVertical: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 8 },
  summaryItem: { alignItems: "center" },
  summaryEmoji: { fontSize: 26, marginBottom: 6 },
  summaryCount: { fontSize: 20, fontWeight: "700", color: "#2D3748" },
  summaryLabel: { fontSize: 12, color: "#A0AEC0", marginTop: 2 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    width: width * 0.82,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  modalDate: { fontSize: 18, fontWeight: "700", color: "#2D3748", marginBottom: 16, textAlign: "center" },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  modalLabel: { fontSize: 15, color: "#4A5568" },
  modalValue: { fontSize: 15, fontWeight: "600", color: "#2D3748" },
  modalPhoto: { width: "100%", height: 200, borderRadius: 12, marginTop: 14 },
  modalBadges: { flexDirection: "row", gap: 8, marginTop: 14, justifyContent: "center" },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#E8F5E9" },
  badgeOrange: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 13, fontWeight: "500", color: "#4A5568" },
  modalClose: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#F0F4F8",
    borderRadius: 10,
  },
  modalCloseText: { fontSize: 15, fontWeight: "600", color: "#4A5568" },
});
