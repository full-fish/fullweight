import { SwipeableTab } from "@/components/swipeable-tab";
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
const CP_DAY = Math.floor((width * 0.82 - 56) / 7);

/* ───── helpers ───── */

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
  if (key === "bodyFatPercent") return r.bodyFatPercent ?? null;
  if (key === "bodyFatMass") return r.bodyFatMass ?? null;
  return null;
}

function hexToRGBA(hex: string, opacity: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/* \u2500\u2500\u2500\u2500\u2500 DatePickerRow (\uce98\ub9b0\ub354 \ud31d\uc5c5 \ud3ec\ud568) \u2500\u2500\u2500\u2500\u2500 */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function DatePickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showCal, setShowCal] = useState(false);
  const now = new Date();
  const parsed = value ? new Date(value) : now;
  const initY = !isNaN(parsed.getTime())
    ? parsed.getFullYear()
    : now.getFullYear();
  const initM = !isNaN(parsed.getTime()) ? parsed.getMonth() : now.getMonth();
  const [cYear, setCYear] = useState(initY);
  const [cMonth, setCMonth] = useState(initM);

  const openCal = () => {
    const p = value ? new Date(value) : new Date();
    if (!isNaN(p.getTime())) {
      setCYear(p.getFullYear());
      setCMonth(p.getMonth());
    }
    setShowCal(true);
  };

  const WKDAYS = [
    "\uc77c",
    "\uc6d4",
    "\ud654",
    "\uc218",
    "\ubaa9",
    "\uae08",
    "\ud1a0",
  ];
  const daysInMonth = getDaysInMonth(cYear, cMonth);
  const firstDay = getFirstDayOfWeek(cYear, cMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevM = () => {
    if (cMonth === 0) {
      setCYear(cYear - 1);
      setCMonth(11);
    } else {
      setCMonth(cMonth - 1);
    }
  };
  const nextM = () => {
    if (cMonth === 11) {
      setCYear(cYear + 1);
      setCMonth(0);
    } else {
      setCMonth(cMonth + 1);
    }
  };

  return (
    <>
      <View style={s.dateRow}>
        <Text style={s.dateLabel}>{label}</Text>
        <TouchableOpacity style={s.dateInputWrap} onPress={openCal}>
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
          <Text style={s.dateCalIcon}>{"\uD83D\uDCC5"}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCal(false)}
      >
        <TouchableOpacity
          style={cpS.overlay}
          activeOpacity={1}
          onPress={() => setShowCal(false)}
        >
          <View style={cpS.card} onStartShouldSetResponder={() => true}>
            <View style={cpS.navRow}>
              <TouchableOpacity onPress={prevM} style={cpS.navBtn}>
                <Text style={cpS.navBtnText}>\u25C0</Text>
              </TouchableOpacity>
              <Text style={cpS.navTitle}>
                {cYear}\ub144 {cMonth + 1}\uc6d4
              </Text>
              <TouchableOpacity onPress={nextM} style={cpS.navBtn}>
                <Text style={cpS.navBtnText}>\u25B6</Text>
              </TouchableOpacity>
            </View>
            <View style={cpS.weekRow}>
              {WKDAYS.map((d, i) => (
                <View key={i} style={cpS.weekCell}>
                  <Text
                    style={[
                      cpS.weekText,
                      i === 0 && { color: "#E53E3E" },
                      i === 6 && { color: "#3182CE" },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>
            {Array.from({ length: cells.length / 7 }, (_, wi) => (
              <View key={wi} style={cpS.weekRow}>
                {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                  if (day === null)
                    return <View key={di} style={cpS.dayCell} />;
                  const dateStr = `${cYear}-${pad2(cMonth + 1)}-${pad2(day)}`;
                  const isSelected = dateStr === value;
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[cpS.dayCell, isSelected && cpS.dayCellSelected]}
                      onPress={() => {
                        onChange(dateStr);
                        setShowCal(false);
                      }}
                    >
                      <Text
                        style={[cpS.dayText, isSelected && { color: "#fff" }]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity
              style={cpS.clearBtn}
              onPress={() => {
                onChange("");
                setShowCal(false);
              }}
            >
              <Text style={cpS.clearBtnText}>\uCD08\uAE30\uD654</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const cpS = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: width * 0.82,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 15, color: "#4A5568" },
  navTitle: { fontSize: 16, fontWeight: "700", color: "#2D3748" },
  weekRow: { flexDirection: "row", justifyContent: "space-around" },
  weekCell: {
    width: CP_DAY,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  weekText: { fontSize: 11, fontWeight: "600", color: "#718096" },
  dayCell: {
    width: CP_DAY,
    height: CP_DAY,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CP_DAY / 2,
  },
  dayCellSelected: { backgroundColor: "#4CAF50" },
  dayText: { fontSize: 13, fontWeight: "500", color: "#2D3748" },
  clearBtn: {
    marginTop: 10,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#F0F4F8",
    borderRadius: 8,
  },
  clearBtnText: { fontSize: 13, fontWeight: "600", color: "#E53E3E" },
});

/* ───── MAIN ───── */

export default function ChartScreen() {
  const [allRecords, setAllRecords] = useState<WeightRecord[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
    "weight",
  ]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statsMetric, setStatsMetric] = useState<MetricKey>("weight");
  const [statsStart, setStatsStart] = useState("");
  const [activityStart, setActivityStart] = useState("");
  const [selectedPoint, setSelectedPoint] = useState<WeightRecord | null>(null);
  const [overlayMode, setOverlayMode] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        setAllRecords([...data].sort((a, b) => a.date.localeCompare(b.date)));
      });
    }, [])
  );

  /* ── 기간 필터 ── */
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

  /* ── 주/월별 집계 ── */
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
          bodyFatPercent:
            avg(recs.map((r) => r.bodyFatPercent ?? null)) ?? undefined,
          bodyFatMass: avg(recs.map((r) => r.bodyFatMass ?? null)) ?? undefined,
          exercised: recs.some((r) => r.exercised),
          drank: recs.some((r) => r.drank),
        } as WeightRecord;
      });
  }, [filteredRecords, periodMode]);

  const slicedData = chartData.slice(-30);

  /* ── 차트 라벨 생성 ── */
  const makeLabels = useCallback(
    (recs: WeightRecord[]) => {
      const step = recs.length > 10 ? Math.ceil(recs.length / 6) : 1;
      return recs.map((r, i) => {
        if (i % step !== 0) return "";
        if (periodMode === "monthly") return fmtMonthLabel(r.date);
        if (periodMode === "weekly") return fmtWeekLabel(r.date);
        return fmtLabel(r.date);
      });
    },
    [periodMode]
  );

  /* ── 단일 수치 차트 데이터 (null 제외) ── */
  const singleChartInfo = useMemo(() => {
    if (selectedMetrics.length !== 1) return null;
    const key = selectedMetrics[0];
    const filtered = slicedData.filter((r) => getMetricValue(r, key) !== null);
    const values = filtered.map((r) => getMetricValue(r, key)!);
    const labels = makeLabels(filtered);
    return { key, filtered, values: values.length > 0 ? values : [0], labels };
  }, [slicedData, selectedMetrics, makeLabels]);

  /* ── 오버레이 차트 데이터 (정규화) ── */
  const overlayInfo = useMemo(() => {
    if (selectedMetrics.length <= 1 || !overlayMode) return null;
    const filtered = slicedData.filter((r) =>
      selectedMetrics.every((key) => getMetricValue(r, key) !== null)
    );
    if (filtered.length < 2) return null;
    const labels = makeLabels(filtered);
    const ranges: Record<string, { min: number; max: number }> = {};
    const datasets = selectedMetrics.map((key) => {
      const vals = filtered.map((r) => getMetricValue(r, key)!);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      ranges[key] = { min, max };
      const span = max - min || 1;
      const normalized = vals.map(
        (v) => Math.round(((v - min) / span) * 100 * 10) / 10
      );
      return {
        data: normalized,
        color: (opacity = 1) => hexToRGBA(METRIC_COLORS[key], opacity),
        strokeWidth: 2,
      };
    });
    return { filtered, labels, datasets, ranges };
  }, [slicedData, selectedMetrics, overlayMode, makeLabels]);

  /* ── 개별 차트 데이터 (null 제외) ── */
  const separateCharts = useMemo(() => {
    if (selectedMetrics.length <= 1) return null;
    return selectedMetrics.map((key) => {
      const filtered = slicedData.filter(
        (r) => getMetricValue(r, key) !== null
      );
      const values = filtered.map((r) => getMetricValue(r, key)!);
      const labels = makeLabels(filtered);
      return {
        key,
        filtered,
        values: values.length > 0 ? values : [0],
        labels,
      };
    });
  }, [slicedData, selectedMetrics, makeLabels]);

  /* ── 통계 ── */
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

  /* ── 활동 요약 ── */
  const activityRecords = useMemo(() => {
    let recs = allRecords;
    if (activityStart) recs = recs.filter((r) => r.date >= activityStart);
    return recs;
  }, [allRecords, activityStart]);

  /* ── 수치 토글 ── */
  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  /* ── 점 클릭 → 팝업 ── */
  const handleDotPress = (filteredRecs: WeightRecord[], idx: number) => {
    const rec = filteredRecs[idx];
    if (rec) setSelectedPoint(rec);
  };

  const METRICS: MetricKey[] = [
    "weight",
    "waist",
    "muscleMass",
    "bodyFatPercent",
    "bodyFatMass",
  ];
  const isSingle = selectedMetrics.length === 1;
  const isMulti = selectedMetrics.length > 1;

  return (
    <SwipeableTab currentIndex={1}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>{"\u{1F4CA}"} 기록 그래프</Text>

        {/* 수치 선택 칩 */}
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
                    {
                      backgroundColor: active ? METRIC_COLORS[key] : "#CBD5E0",
                    },
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

        {/* 기간 모드 */}
        <View style={s.periodRow}>
          {(["daily", "weekly", "monthly", "custom"] as PeriodMode[]).map(
            (m) => (
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
            )
          )}
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

        {/* 차트 카드 */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>
            {selectedMetrics.map((k) => METRIC_LABELS[k]).join(" · ")} 추이
          </Text>

          {/* 오버레이 토글 (다중 선택 시) */}
          {isMulti && (
            <View style={s.overlayToggleRow}>
              <TouchableOpacity
                style={[s.overlayBtn, overlayMode && s.overlayBtnActive]}
                onPress={() => setOverlayMode(true)}
              >
                <Text
                  style={[
                    s.overlayBtnText,
                    overlayMode && s.overlayBtnTextActive,
                  ]}
                >
                  겹쳐보기
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.overlayBtn, !overlayMode && s.overlayBtnActive]}
                onPress={() => setOverlayMode(false)}
              >
                <Text
                  style={[
                    s.overlayBtnText,
                    !overlayMode && s.overlayBtnTextActive,
                  ]}
                >
                  따로보기
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 단일 수치 차트 */}
          {isSingle &&
            singleChartInfo &&
            singleChartInfo.filtered.length >= 2 && (
              <LineChart
                data={{
                  labels: singleChartInfo.labels,
                  datasets: [
                    {
                      data: singleChartInfo.values,
                      color: (opacity = 1) =>
                        hexToRGBA(METRIC_COLORS[singleChartInfo.key], opacity),
                      strokeWidth: 2,
                    },
                  ],
                }}
                width={CHART_WIDTH}
                height={220}
                chartConfig={{
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  color: (opacity = 1) =>
                    hexToRGBA(METRIC_COLORS[singleChartInfo.key], opacity),
                  labelColor: (opacity = 1) => `rgba(113,128,150,${opacity})`,
                  strokeWidth: 2,
                  propsForDots: {
                    r: "3.5",
                    strokeWidth: "1.5",
                    stroke: METRIC_COLORS[singleChartInfo.key],
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
                onDataPointClick={({ index }) =>
                  handleDotPress(singleChartInfo.filtered, index)
                }
              />
            )}

          {isSingle &&
            (!singleChartInfo || singleChartInfo.filtered.length < 2) && (
              <View style={s.emptyChart}>
                <Text style={s.emptyIcon}>📈</Text>
                <Text style={s.emptyText}>
                  {METRIC_LABELS[selectedMetrics[0]]} 데이터가 부족합니다.
                </Text>
              </View>
            )}

          {/* 다중 수치 - 오버레이 모드 */}
          {isMulti && overlayMode && overlayInfo && (
            <>
              <Text style={s.multiAxisNote}>
                📐 정규화된 비교 (각 수치 0~100% 스케일)
              </Text>
              <LineChart
                data={{
                  labels: overlayInfo.labels,
                  datasets: overlayInfo.datasets,
                }}
                width={CHART_WIDTH}
                height={240}
                chartConfig={{
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  color: (opacity = 1) => `rgba(113,128,150,${opacity})`,
                  labelColor: (opacity = 1) => `rgba(113,128,150,${opacity})`,
                  strokeWidth: 2,
                  propsForDots: {
                    r: "3",
                    strokeWidth: "1",
                    stroke: "#718096",
                    fill: "#fff",
                  },
                  propsForBackgroundLines: { stroke: "#F0F4F8" },
                  decimalPlaces: 0,
                }}
                bezier
                style={s.chart}
                withVerticalLines={false}
                withShadow={false}
                formatYLabel={(v) => `${parseFloat(v).toFixed(0)}%`}
                onDataPointClick={({ index }) =>
                  handleDotPress(overlayInfo.filtered, index)
                }
              />
              <View style={s.overlayLegend}>
                {selectedMetrics.map((key) => {
                  const range = overlayInfo.ranges[key];
                  return (
                    <View key={key} style={s.overlayLegendItem}>
                      <View
                        style={[
                          s.legendDot,
                          { backgroundColor: METRIC_COLORS[key] },
                        ]}
                      />
                      <Text style={s.legendText}>
                        {METRIC_LABELS[key]} ({range.min.toFixed(1)}~
                        {range.max.toFixed(1)}
                        {METRIC_UNITS[key]})
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {isMulti && overlayMode && !overlayInfo && (
            <View style={s.emptyChart}>
              <Text style={s.emptyIcon}>📈</Text>
              <Text style={s.emptyText}>
                선택한 수치들의 동시 기록이 부족합니다.
              </Text>
            </View>
          )}

          {/* 다중 수치 - 개별 차트 모드 */}
          {isMulti && !overlayMode && separateCharts && (
            <>
              <Text style={s.multiAxisNote}>📐 각 수치별 독립 차트</Text>
              {separateCharts.map((info) => (
                <View key={info.key} style={s.miniChartWrap}>
                  <View style={s.miniChartHeader}>
                    <View
                      style={[
                        s.legendDot,
                        { backgroundColor: METRIC_COLORS[info.key] },
                      ]}
                    />
                    <Text style={s.miniChartTitle}>
                      {METRIC_LABELS[info.key]} ({METRIC_UNITS[info.key]})
                    </Text>
                  </View>
                  {info.filtered.length >= 2 ? (
                    <LineChart
                      data={{
                        labels: info.labels,
                        datasets: [
                          {
                            data: info.values,
                            color: (opacity = 1) =>
                              hexToRGBA(METRIC_COLORS[info.key], opacity),
                            strokeWidth: 2,
                          },
                        ],
                      }}
                      width={CHART_WIDTH}
                      height={160}
                      chartConfig={{
                        backgroundGradientFrom: "#fff",
                        backgroundGradientTo: "#fff",
                        color: (opacity = 1) =>
                          hexToRGBA(METRIC_COLORS[info.key], opacity),
                        labelColor: (opacity = 1) =>
                          `rgba(113,128,150,${opacity})`,
                        strokeWidth: 2,
                        propsForDots: {
                          r: "3.5",
                          strokeWidth: "1.5",
                          stroke: METRIC_COLORS[info.key],
                          fill: "#fff",
                        },
                        propsForBackgroundLines: {
                          stroke: "#F0F4F8",
                        },
                        decimalPlaces: 1,
                      }}
                      bezier
                      style={s.chart}
                      withVerticalLines={false}
                      withShadow={false}
                      formatYLabel={(v) => parseFloat(v).toFixed(1)}
                      onDataPointClick={({ index }) =>
                        handleDotPress(info.filtered, index)
                      }
                    />
                  ) : (
                    <View style={s.emptyMiniChart}>
                      <Text style={s.emptyText}>
                        {METRIC_LABELS[info.key]} 데이터가 부족합니다.
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </View>

        {/* 통계 */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>통계</Text>
            {statsStart ? (
              <TouchableOpacity onPress={() => setStatsStart("")}>
                <Text style={s.resetBtn}>초기화</Text>
              </TouchableOpacity>
            ) : null}
          </View>

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
                  statsMetric === k && {
                    backgroundColor: METRIC_COLORS[k],
                  },
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
                      {
                        color: stats.diff <= 0 ? "#38A169" : "#E53E3E",
                      },
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

        {/* 활동 요약 */}
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
                <Text style={s.summaryLabel}>운동률</Text>
              </View>
            </View>
          </View>
        )}

        {/* 점 클릭 팝업 모달 */}
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
                  {selectedPoint.bodyFatPercent != null && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>🔥 체지방률</Text>
                      <Text style={s.modalValue}>
                        {selectedPoint.bodyFatPercent} %
                      </Text>
                    </View>
                  )}
                  {selectedPoint.bodyFatMass != null && (
                    <View style={s.modalRow}>
                      <Text style={s.modalLabel}>🟣 체지방량</Text>
                      <Text style={s.modalValue}>
                        {selectedPoint.bodyFatMass} kg
                      </Text>
                    </View>
                  )}
                  {selectedPoint.photoUri && (
                    <Image
                      source={{ uri: selectedPoint.photoUri }}
                      style={s.modalPhoto}
                    />
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
                <Text style={s.modalCloseText}>{"\u{B2EB}\u{AE30}"}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
    </SwipeableTab>
  );
}

/* ───── styles ───── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 20,
  },
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
  metricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  metricChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#718096",
  },
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
  customDateCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  dateLabel: { fontSize: 13, color: "#4A5568", width: 50 },
  dateInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    backgroundColor: "#F7FAFC",
    paddingRight: 6,
  },
  dateInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#2D3748",
  },
  dateCalIcon: { fontSize: 16 },
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
  emptyMiniChart: { alignItems: "center", paddingVertical: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: {
    fontSize: 14,
    color: "#A0AEC0",
    textAlign: "center",
  },
  multiAxisNote: {
    fontSize: 12,
    color: "#A0AEC0",
    textAlign: "center",
    marginBottom: 8,
  },
  overlayToggleRow: {
    flexDirection: "row",
    backgroundColor: "#EDF2F7",
    borderRadius: 8,
    padding: 2,
    marginBottom: 12,
  },
  overlayBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  overlayBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  overlayBtnText: {
    fontSize: 13,
    color: "#A0AEC0",
    fontWeight: "500",
  },
  overlayBtnTextActive: { color: "#2D3748", fontWeight: "600" },
  miniChartWrap: {
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
    paddingTop: 10,
  },
  miniChartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    paddingLeft: 4,
  },
  miniChartTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
    marginLeft: 6,
  },
  overlayLegend: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
    gap: 6,
  },
  overlayLegendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
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
  statsMetricText: {
    fontSize: 13,
    color: "#718096",
    fontWeight: "500",
  },
  statsMetricTextActive: { color: "#fff" },
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
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
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
  modalPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginTop: 14,
  },
  modalBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
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
  modalCloseText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4A5568",
  },
});
