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

/* ──────────── helpers ──────────── */

function fmtLabel(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
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
  if (key === "bodyFat") return r.bodyFat ?? null;
  return null;
}

function getMetricUnit(r: WeightRecord | null, key: MetricKey): string {
  if (key === "bodyFat" && r?.bodyFatUnit === "kg") return "kg";
  if (key === "bodyFat") return "%";
  return METRIC_UNITS[key];
}

/** 데이터가 0개일때 차트 크래시 방지 */
function safeData(arr: number[]) {
  return arr.length > 0 ? arr : [0];
}

/* ──────────── date picker (simple text-based) ──────────── */

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

/* ──────────── MAIN ──────────── */

export default function ChartScreen() {
  const [allRecords, setAllRecords] = useState<WeightRecord[]>([]);

  // 그래프 설정
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
    "weight",
  ]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // 통계 / 활동 시작일
  const [statsMetric, setStatsMetric] = useState<MetricKey>("weight");
  const [statsStart, setStatsStart] = useState("");
  const [activityStart, setActivityStart] = useState("");

  // 날짜 상세 모달
  const [selectedPoint, setSelectedPoint] = useState<WeightRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        setAllRecords([...data].sort((a, b) => a.date.localeCompare(b.date)));
      });
    }, [])
  );

  /* ── 필터된 records (기간별) ── */
  const filteredRecords = useMemo(() => {
    let recs = allRecords;
    if (periodMode === "custom") {
      if (customStart) recs = recs.filter((r) => r.date >= customStart);
      if (customEnd) recs = recs.filter((r) => r.date <= customEnd);
    } else {
      // daily: 최근 60일, weekly: 최근 6개월, monthly: 전체
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

  /* ── 그룹화 (주간/월간 평균) ── */
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
          bodyFat: avg(recs.map((r) => r.bodyFat ?? null)) ?? undefined,
          bodyFatUnit: recs[0]?.bodyFatUnit ?? ("percent" as const),
          exercised: recs.some((r) => r.exercised),
          drank: recs.some((r) => r.drank),
        } as WeightRecord;
      });
  }, [filteredRecords, periodMode]);

  /* ── 차트 라벨 ── */
  const chartLabels = useMemo(() => {
    const recs = chartData.slice(-30); // 최대 30포인트
    const step = recs.length > 10 ? Math.ceil(recs.length / 6) : 1;
    return recs.map((r, i) => {
      if (i % step !== 0) return "";
      if (periodMode === "monthly") return fmtMonthLabel(r.date);
      if (periodMode === "weekly") return fmtWeekLabel(r.date);
      return fmtLabel(r.date);
    });
  }, [chartData, periodMode]);

  /* ── 차트 데이터셋 ── */
  const slicedData = chartData.slice(-30);
  const datasets = selectedMetrics.map((key) => ({
    data: safeData(slicedData.map((r) => getMetricValue(r, key) ?? 0)),
    color: (opacity = 1) => {
      const hex = METRIC_COLORS[key];
      const r2 = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r2},${g},${b},${opacity})`;
    },
    strokeWidth: 2,
  }));

  const hasChartData = slicedData.length >= 2;

  /* ── 통계 계산 ── */
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
    const unit = getMetricUnit(
      statsRecords[statsRecords.length - 1],
      statsMetric
    );
    return { current, max, min, avg, diff, unit };
  }, [statsRecords, statsMetric]);

  /* ── 활동 요약 ── */
  const activityRecords = useMemo(() => {
    let recs = allRecords;
    if (activityStart) recs = recs.filter((r) => r.date >= activityStart);
    return recs;
  }, [allRecords, activityStart]);

  /* ── 메트릭 토글 ── */
  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  /* ── 점 클릭 ── */
  const handleDotPress = (dataIdx: number) => {
    if (periodMode !== "daily" && periodMode !== "custom") return;
    const rec = slicedData[dataIdx];
    if (rec) setSelectedPoint(rec);
  };

  /* ── 렌더 ── */
  const METRICS: MetricKey[] = ["weight", "waist", "muscleMass", "bodyFat"];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>📊 기록 그래프</Text>

      {/* ── 수치 선택 (멀티) ── */}
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

      {/* ── 기간 모드 ── */}
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
                  daily: "일별",
                  weekly: "주별",
                  monthly: "월별",
                  custom: "기간",
                }[m]
              }
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {periodMode === "custom" && (
        <View style={s.customDateCard}>
          <DatePickerRow
            label="시작일"
            value={customStart}
            onChange={setCustomStart}
          />
          <DatePickerRow
            label="종료일"
            value={customEnd}
            onChange={setCustomEnd}
          />
        </View>
      )}

      {/* ── 차트 ── */}
      <View style={s.chartCard}>
        <Text style={s.chartTitle}>
          {selectedMetrics.map((k) => METRIC_LABELS[k]).join(" · ")} 추이
        </Text>
        {hasChartData ? (
          <LineChart
            data={{
              labels: chartLabels,
              datasets,
              legend:
                selectedMetrics.length > 1
                  ? selectedMetrics.map((k) => METRIC_LABELS[k])
                  : undefined,
            }}
            width={CHART_WIDTH}
            height={220}
            chartConfig={{
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              color: (opacity = 1) => `rgba(76,175,80,${opacity})`,
              labelColor: (opacity = 1) => `rgba(113,128,150,${opacity})`,
              strokeWidth: 2,
              propsForDots: {
                r: "3.5",
                strokeWidth: "1.5",
                stroke: "#4CAF50",
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
            onDataPointClick={({ index }) => handleDotPress(index)}
          />
        ) : (
          <View style={s.emptyChart}>
            <Text style={s.emptyIcon}>📈</Text>
            <Text style={s.emptyText}>데이터가 2개 이상 필요합니다.</Text>
          </View>
        )}
        {selectedMetrics.length > 1 && (
          <View style={s.legendRow}>
            {selectedMetrics.map((k) => (
              <View key={k} style={s.legendItem}>
                <View
                  style={[s.legendDot, { backgroundColor: METRIC_COLORS[k] }]}
                />
                <Text style={s.legendText}>{METRIC_LABELS[k]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── 통계 ── */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>통계</Text>
          {statsStart ? (
            <TouchableOpacity onPress={() => setStatsStart("")}>
              <Text style={s.resetBtn}>초기화</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 통계 수치 선택 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.statsMetricScroll}
        >
          {METRICS.map((k) => (
            <TouchableOpacity
              key={k}
              style={[
                s.statsMetricBtn,
                statsMetric === k && s.statsMetricBtnActive,
              ]}
              onPress={() => setStatsMetric(k)}
            >
              <Text
                style={[
                  s.statsMetricText,
                  statsMetric === k && s.statsMetricTextActive,
                ]}
              >
                {METRIC_LABELS[k]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 시작일 입력 */}
        <DatePickerRow
          label="시작일"
          value={statsStart}
          onChange={setStatsStart}
        />

        {stats ? (
          <>
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={s.statLabel}>최근</Text>
                <Text style={s.statValue}>{stats.current.toFixed(1)}</Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>최고</Text>
                <Text style={[s.statValue, { color: "#E53E3E" }]}>
                  {stats.max.toFixed(1)}
                </Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>최저</Text>
                <Text style={[s.statValue, { color: "#38A169" }]}>
                  {stats.min.toFixed(1)}
                </Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
              <View style={s.statItem}>
                <Text style={s.statLabel}>평균</Text>
                <Text style={s.statValue}>{stats.avg.toFixed(1)}</Text>
                <Text style={s.statUnit}>{stats.unit}</Text>
              </View>
            </View>
            {stats.diff !== null && (
              <View style={s.diffRow}>
                <Text style={s.diffLabel}>시작 대비</Text>
                <Text
                  style={[
                    s.diffValue,
                    { color: stats.diff <= 0 ? "#38A169" : "#E53E3E" },
                  ]}
                >
                  {stats.diff > 0 ? "+" : ""}
                  {stats.diff.toFixed(1)} {stats.unit}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={s.noDataText}>해당 수치 데이터가 없습니다.</Text>
        )}
      </View>

      {/* ── 활동 요약 ── */}
      {allRecords.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>활동 요약</Text>
            {activityStart ? (
              <TouchableOpacity onPress={() => setActivityStart("")}>
                <Text style={s.resetBtn}>초기화</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <DatePickerRow
            label="시작일"
            value={activityStart}
            onChange={setActivityStart}
          />
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>📅</Text>
              <Text style={s.summaryCount}>{activityRecords.length}</Text>
              <Text style={s.summaryLabel}>총 기록일</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>🏃</Text>
              <Text style={s.summaryCount}>
                {activityRecords.filter((r) => r.exercised).length}
              </Text>
              <Text style={s.summaryLabel}>운동일</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>🍺</Text>
              <Text style={s.summaryCount}>
                {activityRecords.filter((r) => r.drank).length}
              </Text>
              <Text style={s.summaryLabel}>음주일</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryEmoji}>💪</Text>
              <Text style={s.summaryCount}>
                {activityRecords.length > 0
                  ? Math.round(
                      (activityRecords.filter((r) => r.exercised).length /
                        activityRecords.length) *
                        100
                    )
                  : 0}
                %
              </Text>
              <Text style={s.summaryLabel}>운동율</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── 날짜 상세 모달 ── */}
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
                  <Text style={s.modalLabel}>⚖️ 몸무게</Text>
                  <Text style={s.modalValue}>{selectedPoint.weight} kg</Text>
                </View>
                {selectedPoint.waist != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>📏 허리둘레</Text>
                    <Text style={s.modalValue}>{selectedPoint.waist} cm</Text>
                  </View>
                )}
                {selectedPoint.muscleMass != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>💪 골격근량</Text>
                    <Text style={s.modalValue}>
                      {selectedPoint.muscleMass} kg
                    </Text>
                  </View>
                )}
                {selectedPoint.bodyFat != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>🔥 체지방</Text>
                    <Text style={s.modalValue}>
                      {selectedPoint.bodyFat}
                      {selectedPoint.bodyFatUnit === "kg" ? " kg" : " %"}
                    </Text>
                  </View>
                )}
                <View style={s.modalBadges}>
                  {selectedPoint.exercised && (
                    <View style={[s.badge, s.badgeGreen]}>
                      <Text style={s.badgeText}>🏃 운동</Text>
                    </View>
                  )}
                  {selectedPoint.drank && (
                    <View style={[s.badge, s.badgeOrange]}>
                      <Text style={s.badgeText}>🍺 음주</Text>
                    </View>
                  )}
                  {!selectedPoint.exercised && !selectedPoint.drank && (
                    <Text style={s.noDataText}>활동 기록 없음</Text>
                  )}
                </View>
              </>
            )}
            <TouchableOpacity
              style={s.modalClose}
              onPress={() => setSelectedPoint(null)}
            >
              <Text style={s.modalCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

/* ──────────── styles ──────────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 20,
  },

  /* metric chips */
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
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

  /* period */
  periodRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
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

  /* custom date */
  customDateCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
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

  /* chart */
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
  chartTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 12,
  },
  chart: { borderRadius: 8, marginLeft: -10 },
  emptyChart: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#A0AEC0", textAlign: "center" },

  /* legend */
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 12, color: "#718096" },

  /* card */
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

  /* stats metric selector */
  statsMetricScroll: { marginBottom: 10 },
  statsMetricBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#EDF2F7",
    marginRight: 8,
  },
  statsMetricBtnActive: { backgroundColor: "#4CAF50" },
  statsMetricText: { fontSize: 13, color: "#718096", fontWeight: "500" },
  statsMetricTextActive: { color: "#fff" },

  /* stats grid */
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
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
  noDataText: {
    textAlign: "center",
    color: "#A0AEC0",
    fontSize: 13,
    marginVertical: 10,
  },

  /* summary */
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  summaryItem: { alignItems: "center" },
  summaryEmoji: { fontSize: 26, marginBottom: 6 },
  summaryCount: { fontSize: 20, fontWeight: "700", color: "#2D3748" },
  summaryLabel: { fontSize: 12, color: "#A0AEC0", marginTop: 2 },

  /* modal */
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
  modalDate: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 16,
    textAlign: "center",
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  modalLabel: { fontSize: 15, color: "#4A5568" },
  modalValue: { fontSize: 15, fontWeight: "600", color: "#2D3748" },
  modalBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    justifyContent: "center",
  },
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
