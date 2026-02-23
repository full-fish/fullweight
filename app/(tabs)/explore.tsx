import { CalendarModal } from "@/components/calendar-modal";
import { DatePickerRow } from "@/components/date-picker-row";
import {
  METRIC_COLORS,
  METRIC_UNITS,
  PeriodMode,
  UserSettings,
  WeightRecord,
} from "@/types";
import {
  calcDailyNutrition,
  fmtDate,
  fmtLabel,
  fmtMonthLabel,
  fmtWeekLabel,
  getMetricValue,
  hexToRGBA,
  monthKey,
  weekKey,
} from "@/utils/format";
import { loadMeals, loadRecords, loadUserSettings } from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Line as SvgLine, Text as SvgText } from "react-native-svg";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

/** 영양소 수치별 고유 색상 (METRIC_COLORS에 없는 키) */
const NUTRITION_COLORS: Record<string, string> = {
  kcal: "#E53E3E",
  carb: "#F6AD55",
  protein: "#FC8181",
  fat: "#63B3ED",
};

/* ───── MAIN ───── */

export default function ChartScreen() {
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

  const [allRecords, setAllRecords] = useState<WeightRecord[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>({});
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["weight"]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statsMetric, setStatsMetric] = useState<string>("weight");
  const [statsStart, setStatsStart] = useState("");
  const [statsEnd, setStatsEnd] = useState("");
  const [activityStart, setActivityStart] = useState("");
  const [activityEnd, setActivityEnd] = useState("");
  const [tooltipPoint, setTooltipPoint] = useState<{
    record: WeightRecord;
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const tooltipPointRef = useRef(tooltipPoint);
  tooltipPointRef.current = tooltipPoint;
  const [overlayMode, setOverlayMode] = useState(true);
  const [chartZoom, setChartZoom] = useState(30); // 표시할 데이터 포인트 수 (X축 줌)
  const [chartOffset, setChartOffset] = useState(0); // 우측 끝에서의 오프셋 (팬)
  const [yPadding, setYPadding] = useState(10); // Y축 여유 비율 (0~30, 연속, 기본 10)
  const [scrollEnabled, setScrollEnabled] = useState(true); // 핀치 중 스크롤 잠금

  /* ── 핀치/팬 줌 제스처 ref ── */
  const pinchBaseZoom = useRef(30);
  const pinchBaseYPad = useRef(10);
  const pinchBaseOffset = useRef(0);
  const isVerticalPinch = useRef(false); // 핀치 방향 (세로=Y축, 가로=X축)
  const panBaseOffset = useRef(0);
  const latestZoom = useRef(chartZoom);
  const latestYPad = useRef(yPadding);
  const latestOffset = useRef(chartOffset);
  latestZoom.current = chartZoom;
  latestYPad.current = yPadding;
  latestOffset.current = chartOffset;

  const [showStatsCal, setShowStatsCal] = useState(false);
  const [showStatsEndCal, setShowStatsEndCal] = useState(false);
  const [showActivityCal, setShowActivityCal] = useState(false);
  const [showActivityEndCal, setShowActivityEndCal] = useState(false);

  /* ── 식사 데이터 (일별 합산) ── */
  const [dailyMealMap, setDailyMealMap] = useState<
    Record<string, { kcal: number; carb: number; protein: number; fat: number }>
  >({});

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        setAllRecords([...data].sort((a, b) => a.date.localeCompare(b.date)));
      });
      loadUserSettings().then(setUserSettings);
      loadMeals().then((meals) => {
        const map: Record<
          string,
          { kcal: number; carb: number; protein: number; fat: number }
        > = {};
        meals.forEach((m) => {
          if (!map[m.date])
            map[m.date] = { kcal: 0, carb: 0, protein: 0, fat: 0 };
          map[m.date].kcal += m.kcal;
          map[m.date].carb += m.carb;
          map[m.date].protein += m.protein;
          map[m.date].fat += m.fat;
        });
        setDailyMealMap(map);
      });
    }, [])
  );

  /* ── 하루 권장 영양소 (그래프 기준선용) ── */
  const dailyNutrition = useMemo(() => {
    const s = userSettings;
    if (!s.height || !s.gender || !s.birthDate || allRecords.length === 0)
      return null;
    const latest = allRecords[allRecords.length - 1];
    return calcDailyNutrition({
      weight: latest.weight,
      targetWeight: latest.weight,
      height: s.height,
      gender: s.gender,
      birthDate: s.birthDate,
      periodDays: 30,
      exerciseFreq: s.exerciseFreq ?? 0,
      exerciseMins: s.exerciseMins ?? 60,
      exerciseIntensity: s.exerciseIntensity ?? 1,
      muscleMass: latest.muscleMass,
      bodyFatPercent: latest.bodyFatPercent,
    });
  }, [userSettings, allRecords]);

  /* ── 영양소 키 + 확장 getMetricValue ── */
  const NUTRITION_KEYS = useMemo(
    () => new Set(["kcal", "carb", "protein", "fat"]),
    []
  );

  const getVal = useCallback(
    (r: WeightRecord, key: string): number | null => {
      if (NUTRITION_KEYS.has(key)) {
        // 주/월별 집계 레코드의 경우 _nutritionAvg 사용
        const aggRec = r as WeightRecord & {
          _nutritionAvg?: Record<string, number | null>;
        };
        if (aggRec._nutritionAvg) {
          return aggRec._nutritionAvg[key] ?? null;
        }
        const dm = dailyMealMap[r.date];
        if (!dm) return null;
        const v = dm[key as keyof typeof dm];
        return v > 0 ? Math.round(v) : null;
      }
      return getMetricValue(r, key);
    },
    [dailyMealMap, NUTRITION_KEYS]
  );

  /* ── 기간 필터 ── */
  const filteredRecords = useMemo(() => {
    let recs = allRecords;
    if (periodMode === "custom") {
      if (customStart) recs = recs.filter((r) => r.date >= customStart);
      if (customEnd) recs = recs.filter((r) => r.date <= customEnd);
    }
    // daily / weekly / monthly: 모든 데이터 사용 (줌/드래그로 전체 탐색 가능)
    // 기본 뷰는 chartZoom(30)으로 최근 30개 표시
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

        // 영양소 평균 계산 (dailyMealMap에서 해당 기간 날짜들의 평균)
        const nutKeys = ["kcal", "carb", "protein", "fat"] as const;
        const nutAvg: Record<string, number | null> = {};
        nutKeys.forEach((nk) => {
          const vals = recs
            .map((r) => dailyMealMap[r.date]?.[nk] ?? null)
            .filter((v): v is number => v !== null && v > 0);
          nutAvg[nk] =
            vals.length > 0
              ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
              : null;
        });

        const rec = {
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
          _nutritionAvg: nutAvg,
        } as WeightRecord & { _nutritionAvg?: Record<string, number | null> };
        return rec;
      });
  }, [filteredRecords, periodMode, dailyMealMap]);

  const slicedData = useMemo(() => {
    const len = chartData.length;
    const end = Math.max(chartZoom, len - chartOffset);
    const start = Math.max(0, end - chartZoom);
    return chartData.slice(start, end);
  }, [chartData, chartZoom, chartOffset]);

  /* ── 핀치 줌 제스처
       • 세로 핀치 (터치늤운 시 dy > dx) → Y축 줌
       • 가로 핀치               → X축 줌 + 터치 포인트 기준 ── */
  const pinchGesture = useMemo(() => {
    const dataLen = chartData.length;
    return Gesture.Pinch()
      .runOnJS(true)
      .onTouchesDown((e) => {
        // 두 손가락 위치로 핀치 방향 판단 (가장 신뢰성 높음)
        if (e.allTouches.length >= 2) {
          const t1 = e.allTouches[0];
          const t2 = e.allTouches[1];
          const dx = Math.abs(t2.x - t1.x);
          const dy = Math.abs(t2.y - t1.y);
          isVerticalPinch.current = dy > dx;
          // 두 손가락 닿으면 스크롤 즉시 잠금 (세로 핀치 충돌 방지)
          setScrollEnabled(false);
        }
      })
      .onBegin(() => {
        pinchBaseZoom.current = latestZoom.current;
        pinchBaseYPad.current = latestYPad.current;
        pinchBaseOffset.current = latestOffset.current;
        setTooltipPoint(null);
      })
      .onUpdate((e) => {
        if (isVerticalPinch.current) {
          // ─ Y축: 세로 핀치 ─
          // scale > 1(벌리기) → yPadding 감소 → Y축 좌아짐 → 줌인
          // scale < 1(모으기) → yPadding 증가 → Y축 넓어짐 → 줌아웃
          const yDelta = Math.round((1 - e.scale) * 20);
          const newYPad = pinchBaseYPad.current + yDelta;
          setYPadding(Math.max(0, Math.min(30, newYPad)));
        } else {
          // ─ X축: 가로 핀치 ─
          const baseZ = pinchBaseZoom.current;
          const newZoom = Math.round(baseZ / e.scale);
          const clampedZoom = Math.max(5, Math.min(dataLen, newZoom));
          setChartZoom(clampedZoom);

          const focalRatio = Math.min(1, Math.max(0, e.focalX / CHART_WIDTH));
          const zoomDelta = clampedZoom - baseZ;
          const offsetShift = Math.round(zoomDelta * (1 - focalRatio));
          const newOff = pinchBaseOffset.current - offsetShift;
          setChartOffset(Math.max(0, Math.min(dataLen - clampedZoom, newOff)));
        }
      })
      .onFinalize(() => {
        setScrollEnabled(true);
      });
  }, [chartData.length]);

  /* ── 1손가락 팬 제스처 (좌우 드래그 → 날짜 이동) ── */
  const panGesture = useMemo(() => {
    const dataLen = chartData.length;
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(10)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        panBaseOffset.current = latestOffset.current;
        setTooltipPoint(null);
      })
      .onUpdate((e) => {
        const pointsPerPx = latestZoom.current / CHART_WIDTH;
        const shift = Math.round(e.translationX * pointsPerPx);
        const newOff = panBaseOffset.current + shift;
        setChartOffset(
          Math.max(0, Math.min(dataLen - latestZoom.current, newOff))
        );
      });
  }, [chartData.length]);

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
    const filtered = slicedData.filter((r) => getVal(r, key) !== null);
    const values = filtered.map((r) => getVal(r, key)!);
    const labels = makeLabels(filtered);
    return { key, filtered, values: values.length > 0 ? values : [0], labels };
  }, [slicedData, selectedMetrics, makeLabels, getVal]);

  /* ── 오버레이 차트 데이터 (정규화 + 모든 데이터 포함, 누락값은 빈칸) ── */
  const overlayInfo = useMemo(() => {
    if (selectedMetrics.length <= 1 || !overlayMode) return null;
    // 선택된 수치 중 하나라도 있는 레코드를 모두 사용
    const filtered = slicedData.filter((r) =>
      selectedMetrics.some((key) => getVal(r, key) !== null)
    );
    if (filtered.length < 2) return null;
    const labels = makeLabels(filtered);
    const ranges: Record<string, { min: number; max: number }> = {};
    const datasets = selectedMetrics
      .map((key) => {
        const rawVals = filtered.map((r) => getVal(r, key));
        const validVals = rawVals.filter((v): v is number => v !== null);
        if (validVals.length === 0) return null;
        const min = Math.min(...validVals);
        const max = Math.max(...validVals);
        ranges[key] = { min, max };
        const span = max - min || 1;
        // 선형보간: null 위치를 이전/다음 유효값 사이 직선으로
        // 양 끝 외삽(extrapolation)은 하지 않음
        const normalized: number[] = rawVals.map((v) =>
          v !== null ? Math.round(((v - min) / span) * 100 * 10) / 10 : 0
        );
        const firstValid = rawVals.findIndex((v) => v !== null);
        const lastValid =
          rawVals.length -
          1 -
          [...rawVals].reverse().findIndex((v) => v !== null);
        for (let i = 0; i < normalized.length; i++) {
          if (rawVals[i] !== null) continue;
          // 첫 유효값 이전 또는 마지막 유효값 이후는 그냥 끊김 (유효값으로 채워서 선이 평탄하게)
          if (i < firstValid) {
            normalized[i] = normalized[firstValid];
            continue;
          }
          if (i > lastValid) {
            normalized[i] = normalized[lastValid];
            continue;
          }
          // 두 유효값 사이: 선형보간
          let prevIdx = -1;
          let nextIdx = -1;
          for (let j = i - 1; j >= 0; j--)
            if (rawVals[j] !== null) {
              prevIdx = j;
              break;
            }
          for (let j = i + 1; j < rawVals.length; j++)
            if (rawVals[j] !== null) {
              nextIdx = j;
              break;
            }
          if (prevIdx !== -1 && nextIdx !== -1) {
            const t = (i - prevIdx) / (nextIdx - prevIdx);
            normalized[i] =
              Math.round(
                (normalized[prevIdx] * (1 - t) + normalized[nextIdx] * t) * 10
              ) / 10;
          }
        }
        return {
          data: normalized,
          color: (opacity = 1) =>
            hexToRGBA(
              (METRIC_COLORS as Record<string, string>)[key] ??
                NUTRITION_COLORS[key] ??
                userSettings.customMetrics?.find((m) => m.key === key)?.color ??
                "#CBD5E0",
              opacity
            ),
          strokeWidth: 2,
        };
      })
      .filter(
        (
          d
        ): d is {
          data: number[];
          color: (o?: number) => string;
          strokeWidth: number;
        } => d !== null
      );
    if (datasets.length === 0) return null;
    // 어느 위치가 널이었는지 추적 (데이셋 인덱스 순서와 동일)
    const nullMasks = selectedMetrics
      .filter((key) => {
        const rawVals = filtered.map((r) => getVal(r, key));
        return rawVals.some((v) => v !== null);
      })
      .map((key) => filtered.map((r) => getVal(r, key) === null));
    return { filtered, labels, datasets, ranges, nullMasks };
  }, [
    slicedData,
    selectedMetrics,
    overlayMode,
    makeLabels,
    userSettings,
    getVal,
  ]);

  /* ── 개별 차트 데이터 (전체 날짜 기반, 선형보간 + 점은 실제데이터만) ── */
  const separateCharts = useMemo(() => {
    if (selectedMetrics.length <= 1) return null;
    // 모든 수치가 하나의 통일된 X축(날짜) 기반을 사용
    const allDatesFiltered = slicedData.filter((r) =>
      selectedMetrics.some((key) => getVal(r, key) !== null)
    );
    const commonLabels = makeLabels(allDatesFiltered);
    return selectedMetrics.map((key) => {
      const rawValues = allDatesFiltered.map((r) => getVal(r, key));
      const validValues = rawValues.filter((v): v is number => v !== null);
      // 선형보간: null 위치를 이전/다음 유효값 사이 직선으로
      // 양 끝 외삽은 하지 않음 (첫/마지막 유효값으로 평탄하게 유지)
      const interpolated = [...rawValues];
      const firstValid = rawValues.findIndex((v) => v !== null);
      const lastValid =
        rawValues.length -
        1 -
        [...rawValues].reverse().findIndex((v) => v !== null);
      for (let i = 0; i < interpolated.length; i++) {
        if (interpolated[i] !== null) continue;
        if (firstValid === -1) {
          interpolated[i] = 0;
          continue;
        }
        if (i < firstValid) {
          interpolated[i] = rawValues[firstValid];
          continue;
        }
        if (i > lastValid) {
          interpolated[i] = rawValues[lastValid];
          continue;
        }
        let prevIdx = -1;
        let nextIdx = -1;
        for (let j = i - 1; j >= 0; j--)
          if (interpolated[j] !== null) {
            prevIdx = j;
            break;
          }
        for (let j = i + 1; j < interpolated.length; j++)
          if (rawValues[j] !== null) {
            nextIdx = j;
            break;
          }
        if (prevIdx !== -1 && nextIdx !== -1) {
          const t = (i - prevIdx) / (nextIdx - prevIdx);
          interpolated[i] =
            Math.round(
              (interpolated[prevIdx]! * (1 - t) + rawValues[nextIdx]! * t) * 10
            ) / 10;
        }
      }
      return {
        key,
        filtered: allDatesFiltered,
        values: validValues.length > 0 ? (interpolated as number[]) : [0],
        labels: commonLabels,
        hasData: validValues.length >= 2,
        nullMask: rawValues.map((v) => v === null),
      };
    });
  }, [slicedData, selectedMetrics, makeLabels, getVal]);

  /* ── 통계 ── */
  const statsRecords = useMemo(() => {
    let recs = allRecords;
    if (statsStart) recs = recs.filter((r) => r.date >= statsStart);
    if (statsEnd) recs = recs.filter((r) => r.date <= statsEnd);
    return recs.filter((r) => getVal(r, statsMetric) !== null);
  }, [allRecords, statsStart, statsEnd, statsMetric, getVal]);

  const stats = useMemo(() => {
    if (statsRecords.length === 0) return null;
    const vals = statsRecords.map((r) => getVal(r, statsMetric)!);
    const current = vals[vals.length - 1];
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const diff = vals.length >= 2 ? current - vals[0] : null;
    const builtinUnit = (METRIC_UNITS as Record<string, string>)[statsMetric];
    const customCm = userSettings.customMetrics?.find(
      (m) => m.key === statsMetric
    );
    const nutriUnits: Record<string, string> = {
      kcal: "kcal",
      carb: "g",
      protein: "g",
      fat: "g",
    };
    const unit = builtinUnit ?? customCm?.unit ?? nutriUnits[statsMetric] ?? "";
    return { current, max, min, avg, diff, unit };
  }, [statsRecords, statsMetric, userSettings.customMetrics, getVal]);

  /* ── 활동 요약 ── */
  const activityRecords = useMemo(() => {
    let recs = allRecords;
    if (activityStart) recs = recs.filter((r) => r.date >= activityStart);
    if (activityEnd) recs = recs.filter((r) => r.date <= activityEnd);
    return recs;
  }, [allRecords, activityStart, activityEnd]);

  /* ── 수치 토글 ── */
  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
      }
      return [...prev, key];
    });
  };

  /* ── 인라인 툴팁 렌더링 (chartCard 레벨) ── */
  const renderCardTooltip = () => {
    if (!tooltipPoint) return null;
    const { record, x } = tooltipPoint;
    const tooltipW = 160;
    // x: dot SVG x + chartCard→SVG 오프셋 기준으로 left 계산
    const svgToCard = 16 + -10; // chartCard padding + chart marginLeft
    const left = Math.max(
      4,
      Math.min(
        svgToCard + x - tooltipW / 2,
        CHART_WIDTH - tooltipW + svgToCard - 4
      )
    );

    const metrics: { icon: string; val: string }[] = [];
    metrics.push({ icon: "", val: `${record.weight} kg` });
    if (record.waist != null)
      metrics.push({ icon: "허리", val: `${record.waist} cm` });
    if (record.muscleMass != null)
      metrics.push({ icon: "골격근", val: `${record.muscleMass} kg` });
    if (record.bodyFatPercent != null)
      metrics.push({ icon: "체지방", val: `${record.bodyFatPercent} %` });
    if (record.bodyFatMass != null)
      metrics.push({ icon: "체지방량", val: `${record.bodyFatMass} kg` });

    // 영양소 정보 추가
    const dm = dailyMealMap[record.date];
    if (dm) {
      if (dm.kcal > 0)
        metrics.push({ icon: "칼로리", val: `${Math.round(dm.kcal)} kcal` });
      if (dm.carb > 0)
        metrics.push({ icon: "탄수화물", val: `${Math.round(dm.carb)} g` });
      if (dm.protein > 0)
        metrics.push({ icon: "단백질", val: `${Math.round(dm.protein)} g` });
      if (dm.fat > 0)
        metrics.push({ icon: "지방", val: `${Math.round(dm.fat)} g` });
    }

    const fixedTop = 0;

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setTooltipPoint(null)}
        style={[
          s.tooltip,
          {
            left,
            width: tooltipW,
            top: fixedTop,
          },
        ]}
      >
        <Text style={s.tooltipDate}>{fmtDate(record.date)}</Text>
        {metrics.map((m, i) => (
          <Text key={i} style={s.tooltipMetric}>
            {m.icon} {m.val}
          </Text>
        ))}
      </TouchableOpacity>
    );
  };

  /* ── 차트 데코레이터: 세로 점선 + 영양소 권장량 가로 점선 ── */
  const NUTRITION_TARGET_MAP: Record<string, number | undefined> =
    dailyNutrition
      ? {
          kcal: dailyNutrition.kcal,
          carb: dailyNutrition.carb,
          protein: dailyNutrition.protein,
          fat: dailyNutrition.fat,
        }
      : {};

  const makeDecorator = (
    chartHeight: number,
    dataLen: number,
    metricKey?: string,
    dataValues?: number[]
  ) => {
    if (!tooltipPoint && !metricKey) return undefined;
    if (dataLen < 2) return undefined;
    const CHART_LEFT_PAD = 64;
    const plotTop = 16;
    const plotBottom = chartHeight - 32;
    const plotH = plotBottom - plotTop;

    // 영양소 권장량 가로선 Y좌표 계산
    let targetY: number | null = null;
    let targetLabel = "";
    if (
      metricKey &&
      NUTRITION_KEYS.has(metricKey) &&
      dataValues &&
      dataValues.length > 0
    ) {
      const targetVal = NUTRITION_TARGET_MAP[metricKey];
      if (targetVal != null) {
        const padFactor = yPadding * 0.01;
        const rangeVals = [...dataValues, targetVal];
        const dataMin = Math.min(...rangeVals) * (1 - padFactor);
        const dataMax = Math.max(...rangeVals) * (1 + padFactor);
        const range = dataMax - dataMin || 1;
        // chart-kit은 위가 max, 아래가 min
        const ratio = (targetVal - dataMin) / range;
        targetY = plotBottom - ratio * plotH;
        targetLabel =
          metricKey === "kcal" ? `권장 ${targetVal}kcal` : `권장 ${targetVal}g`;
      }
    }

    // eslint-disable-next-line react/display-name
    return () => (
      <Svg
        width={CHART_WIDTH}
        height={chartHeight}
        style={{ position: "absolute", left: 0, top: 0 }}
        pointerEvents="none"
      >
        {tooltipPoint &&
          (() => {
            const dotX =
              CHART_LEFT_PAD +
              (tooltipPoint.index * (CHART_WIDTH - CHART_LEFT_PAD)) / dataLen;
            return (
              <SvgLine
                x1={dotX}
                y1={plotTop}
                x2={dotX}
                y2={plotBottom}
                stroke="#718096"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            );
          })()}
        {targetY != null && targetY >= plotTop && targetY <= plotBottom && (
          <>
            <SvgLine
              x1={CHART_LEFT_PAD}
              y1={targetY}
              x2={CHART_WIDTH}
              y2={targetY}
              stroke="#E53E3E"
              strokeWidth={1}
              strokeDasharray="6,4"
            />
            <SvgText
              x={CHART_WIDTH - 4}
              y={targetY - 4}
              fill="#E53E3E"
              fontSize={9}
              fontWeight="600"
              textAnchor="end"
            >
              {targetLabel}
            </SvgText>
          </>
        )}
      </Svg>
    );
  };

  // 내장 + 커스텀 수치를 합쳐서 카드/통계에 표시할 메트릭 리스트
  const ALL_METRICS: {
    key: string;
    label: string;
    unit: string;
    color: string;
  }[] = [
    { key: "weight", label: "몸무게", unit: "kg", color: "#4CAF50" },
    { key: "waist", label: "허리둘레", unit: "cm", color: "#FF9800" },
    { key: "muscleMass", label: "골격근량", unit: "kg", color: "#2196F3" },
    { key: "bodyFatPercent", label: "체지방률", unit: "%", color: "#E91E63" },
    { key: "bodyFatMass", label: "체지방량", unit: "kg", color: "#9C27B0" },
    { key: "kcal", label: "칼로리", unit: "kcal", color: "#E53E3E" },
    { key: "carb", label: "탄수화물", unit: "g", color: "#F6AD55" },
    { key: "protein", label: "단백질", unit: "g", color: "#FC8181" },
    { key: "fat", label: "지방", unit: "g", color: "#63B3ED" },
    ...(userSettings.customMetrics ?? []).map((cm) => ({
      key: cm.key,
      label: cm.label,
      unit: cm.unit,
      color: cm.color,
    })),
  ];
  const METRICS = ALL_METRICS.filter(
    (m) =>
      m.key === "weight" ||
      userSettings.metricDisplayVisibility?.[m.key] !== false
  );
  // 키 단독 베니어 타입 호환성
  const getMetricInfo = (key: string) =>
    ALL_METRICS.find((m) => m.key === key) ?? {
      key,
      label: key,
      unit: "",
      color: "#CBD5E0",
    };
  const isSingle = selectedMetrics.length === 1;
  const isMulti = selectedMetrics.length > 1;

  /* ── 탭 제스처 (점 클릭 → 인라인 툴팁) ── */
  const tapGesture = useMemo(() => {
    return Gesture.Tap()
      .runOnJS(true)
      .maxDuration(250)
      .onEnd((e) => {
        // react-native-chart-kit 내부 좌표계:
        // paddingRight(=좌측패딩) = 64, s.chart marginLeft = -10, chartCard padding = 16
        const CHART_LEFT_PAD = 64;
        const CARD_TO_SVG = 16 + -10; // chartCard padding + chart marginLeft
        const svgX = e.x - CARD_TO_SVG;

        // 현재 표시 중인 차트의 데이터 확인
        let dataLen = 0;
        let filtered: WeightRecord[] = [];
        if (
          isSingle &&
          singleChartInfo &&
          singleChartInfo.filtered.length >= 2
        ) {
          dataLen = singleChartInfo.values.length;
          filtered = singleChartInfo.filtered;
        } else if (isMulti && overlayMode && overlayInfo) {
          dataLen = overlayInfo.filtered.length;
          filtered = overlayInfo.filtered;
        } else if (
          isMulti &&
          !overlayMode &&
          separateCharts &&
          separateCharts.length > 0
        ) {
          dataLen = separateCharts[0].values.length;
          filtered = separateCharts[0].filtered;
        }
        if (dataLen < 2 || filtered.length === 0) return;

        // x좌표 → 데이터 인덱스
        const index = Math.round(
          ((svgX - CHART_LEFT_PAD) * dataLen) / (CHART_WIDTH - CHART_LEFT_PAD)
        );
        if (index < 0 || index >= dataLen) return;

        const rec = filtered[index];
        if (!rec) return;

        // 같은 점 다시 누르면 닫기
        const prev = tooltipPointRef.current;
        if (prev && prev.record.date === rec.date) {
          setTooltipPoint(null);
          return;
        }

        // dot의 SVG x 좌표 계산 (툴팁 위치용)
        const dotX =
          CHART_LEFT_PAD + (index * (CHART_WIDTH - CHART_LEFT_PAD)) / dataLen;

        setTooltipPoint({ record: rec, x: dotX, y: e.y, index });
      });
  }, [
    isSingle,
    isMulti,
    overlayMode,
    singleChartInfo,
    overlayInfo,
    separateCharts,
  ]);

  /* ── 핀치 + (팬 | 탭) 동시 제스처 ── */
  const composedGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        pinchGesture,
        Gesture.Exclusive(panGesture, tapGesture)
      ),
    [pinchGesture, panGesture, tapGesture]
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        scrollEnabled={scrollEnabled}
      >
        {/* 수치 선택 칩 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
        >
          <View style={s.metricRow}>
            {METRICS.map((m) => {
              const active = selectedMetrics.includes(m.key);
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[
                    s.metricChip,
                    active && {
                      backgroundColor: m.color + "22",
                      borderColor: m.color,
                    },
                  ]}
                  onPress={() => toggleMetric(m.key)}
                >
                  <View
                    style={[
                      s.metricDot,
                      {
                        backgroundColor: active ? m.color : "#CBD5E0",
                      },
                    ]}
                  />
                  <Text
                    style={[s.metricChipText, active && { color: m.color }]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

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
              onChange={(v) => {
                setCustomStart(v);
                if (customEnd && v > customEnd) setCustomEnd(v);
              }}
              maxDate={todayStr}
            />
            <DatePickerRow
              label="종료일"
              value={customEnd}
              onChange={setCustomEnd}
              minDate={customStart || undefined}
              maxDate={todayStr}
            />
          </View>
        )}

        {/* 차트 카드 */}
        <GestureDetector gesture={composedGesture}>
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>
              {selectedMetrics.map((k) => getMetricInfo(k).label).join(" · ")}{" "}
              추이
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
                          hexToRGBA(
                            getMetricInfo(singleChartInfo.key).color,
                            opacity
                          ),
                        strokeWidth: 2,
                      },
                      ...(() => {
                        const tgt = NUTRITION_KEYS.has(singleChartInfo.key)
                          ? NUTRITION_TARGET_MAP[singleChartInfo.key]
                          : undefined;
                        const allV =
                          tgt != null
                            ? [...singleChartInfo.values, tgt]
                            : singleChartInfo.values;
                        const pad = yPadding * 0.01;
                        return [
                          {
                            data: [Math.min(...allV) * (1 - pad)],
                            withDots: false,
                            strokeWidth: 0,
                            color: () => "transparent",
                          },
                          {
                            data: [Math.max(...allV) * (1 + pad)],
                            withDots: false,
                            strokeWidth: 0,
                            color: () => "transparent",
                          },
                        ];
                      })(),
                    ],
                  }}
                  width={CHART_WIDTH}
                  height={220}
                  chartConfig={{
                    backgroundGradientFrom: "#fff",
                    backgroundGradientTo: "#fff",
                    color: (opacity = 1) =>
                      hexToRGBA(
                        getMetricInfo(singleChartInfo.key).color,
                        opacity
                      ),
                    labelColor: (opacity = 1) => `rgba(113,128,150,${opacity})`,
                    strokeWidth: 2,
                    propsForDots: {
                      r: "4",
                      strokeWidth: "1.5",
                      stroke: getMetricInfo(singleChartInfo.key).color,
                      fill: getMetricInfo(singleChartInfo.key).color,
                    },
                    propsForBackgroundLines: { stroke: "#F0F4F8" },
                    decimalPlaces: NUTRITION_KEYS.has(singleChartInfo.key)
                      ? 0
                      : 1,
                  }}
                  bezier
                  style={s.chart}
                  withVerticalLines={false}
                  withShadow={false}
                  formatYLabel={(v) =>
                    NUTRITION_KEYS.has(singleChartInfo.key)
                      ? Math.round(parseFloat(v)).toString()
                      : parseFloat(v).toFixed(1)
                  }
                  decorator={makeDecorator(
                    220,
                    singleChartInfo.values.length,
                    singleChartInfo.key,
                    singleChartInfo.values
                  )}
                />
              )}

            {isSingle &&
              (!singleChartInfo || singleChartInfo.filtered.length < 2) && (
                <View style={s.emptyChart}>
                  <Text style={s.emptyIcon}></Text>
                  <Text style={s.emptyText}>
                    {getMetricInfo(selectedMetrics[0]).label} 데이터가
                    부족합니다.
                  </Text>
                </View>
              )}

            {/* 다중 수치 - 오버레이 모드 */}
            {isMulti && overlayMode && overlayInfo && (
              <>
                {(() => {
                  let dotCallIdx = 0;
                  const N = overlayInfo.filtered.length;
                  return (
                    <LineChart
                      data={{
                        labels: overlayInfo.labels,
                        datasets: overlayInfo.datasets,
                      }}
                      width={CHART_WIDTH}
                      height={240}
                      getDotProps={(_: unknown, j: number) => {
                        const dsIdx = Math.floor(dotCallIdx / N);
                        dotCallIdx++;
                        const isNull =
                          overlayInfo.nullMasks[dsIdx]?.[j] ?? false;
                        if (isNull)
                          return {
                            r: "0",
                            strokeWidth: "0",
                            fill: "transparent",
                          };
                        const c =
                          overlayInfo.datasets[dsIdx]?.color(1) ?? "#718096";
                        return { r: "3.5", strokeWidth: "0", fill: c };
                      }}
                      chartConfig={
                        {
                          backgroundGradientFrom: "#fff",
                          backgroundGradientTo: "#fff",
                          color: (opacity = 1) =>
                            `rgba(113,128,150,${opacity})`,
                          labelColor: (opacity = 1) =>
                            `rgba(113,128,150,${opacity})`,
                          strokeWidth: 2,
                          propsForBackgroundLines: { stroke: "#F0F4F8" },
                          decimalPlaces: 0,
                        } as unknown as import("react-native-chart-kit/dist/AbstractChart").AbstractChartConfig
                      }
                      bezier
                      style={s.chart}
                      withVerticalLines={false}
                      withShadow={false}
                      formatYLabel={(v) => `${parseFloat(v).toFixed(0)}%`}
                      decorator={makeDecorator(
                        240,
                        overlayInfo.filtered.length
                      )}
                    />
                  );
                })()}
                <View style={s.overlayLegend}>
                  {selectedMetrics.map((key) => {
                    const range = overlayInfo.ranges[key];
                    if (!range) return null; // 데이터가 없는 수치는 범례에서 제외
                    const mi = getMetricInfo(key);
                    return (
                      <View key={key} style={s.overlayLegendItem}>
                        <View
                          style={[s.legendDot, { backgroundColor: mi.color }]}
                        />
                        <Text style={s.legendText}>
                          {mi.label} ({range.min.toFixed(1)}~
                          {range.max.toFixed(1)}
                          {mi.unit})
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {isMulti && overlayMode && !overlayInfo && (
              <View style={s.emptyChart}>
                <Text style={s.emptyIcon}></Text>
                <Text style={s.emptyText}>
                  선택한 수치들의 기록이 부족합니다.
                </Text>
              </View>
            )}

            {/* 다중 수치 - 개별 차트 모드 */}
            {isMulti && !overlayMode && separateCharts && (
              <>
                {separateCharts.map((info) => (
                  <View key={info.key} style={s.miniChartWrap}>
                    <View style={s.miniChartHeader}>
                      <View
                        style={[
                          s.legendDot,
                          { backgroundColor: getMetricInfo(info.key).color },
                        ]}
                      />
                      <Text style={s.miniChartTitle}>
                        {getMetricInfo(info.key).label} (
                        {getMetricInfo(info.key).unit})
                      </Text>
                    </View>
                    {info.hasData ? (
                      <LineChart
                        data={{
                          labels: info.labels,
                          datasets: [
                            {
                              data: info.values,
                              color: (opacity = 1) =>
                                hexToRGBA(
                                  getMetricInfo(info.key).color,
                                  opacity
                                ),
                              strokeWidth: 2,
                            },
                            ...(() => {
                              const tgt = NUTRITION_KEYS.has(info.key)
                                ? NUTRITION_TARGET_MAP[info.key]
                                : undefined;
                              const allV =
                                tgt != null
                                  ? [...info.values, tgt]
                                  : info.values;
                              const pad = yPadding * 0.01;
                              return [
                                {
                                  data: [Math.min(...allV) * (1 - pad)],
                                  withDots: false,
                                  strokeWidth: 0,
                                  color: () => "transparent",
                                },
                                {
                                  data: [Math.max(...allV) * (1 + pad)],
                                  withDots: false,
                                  strokeWidth: 0,
                                  color: () => "transparent",
                                },
                              ];
                            })(),
                          ],
                        }}
                        width={CHART_WIDTH}
                        height={160}
                        getDotProps={(_: unknown, j: number) =>
                          info.nullMask[j]
                            ? { r: "0", strokeWidth: "0", fill: "transparent" }
                            : {
                                r: "4",
                                strokeWidth: "0",
                                fill: getMetricInfo(info.key).color,
                              }
                        }
                        chartConfig={
                          {
                            backgroundGradientFrom: "#fff",
                            backgroundGradientTo: "#fff",
                            color: (opacity = 1) =>
                              hexToRGBA(getMetricInfo(info.key).color, opacity),
                            labelColor: (opacity = 1) =>
                              `rgba(113,128,150,${opacity})`,
                            strokeWidth: 2,
                            propsForBackgroundLines: {
                              stroke: "#F0F4F8",
                            },
                            decimalPlaces: NUTRITION_KEYS.has(info.key) ? 0 : 1,
                          } as unknown as import("react-native-chart-kit/dist/AbstractChart").AbstractChartConfig
                        }
                        bezier
                        style={s.chart}
                        withVerticalLines={false}
                        withShadow={false}
                        formatYLabel={(v) =>
                          NUTRITION_KEYS.has(info.key)
                            ? Math.round(parseFloat(v)).toString()
                            : parseFloat(v).toFixed(1)
                        }
                        decorator={makeDecorator(
                          160,
                          info.values.length,
                          info.key,
                          info.values
                        )}
                      />
                    ) : (
                      <View style={s.emptyMiniChart}>
                        <Text style={s.emptyText}>
                          {getMetricInfo(info.key).label} 데이터가 부족합니다.
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
            {renderCardTooltip()}
          </View>
        </GestureDetector>

        {/* 통계 */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>통계</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {statsStart || statsEnd ? (
                <Text style={{ fontSize: 11, color: "#A0AEC0" }}>
                  {statsStart || "전체"}~{statsEnd || "현재"}
                </Text>
              ) : null}
              <TouchableOpacity
                style={s.startBtn}
                onPress={() => setShowStatsCal(true)}
              >
                <Text style={s.startBtnText}>시작</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.endBtn}
                onPress={() => setShowStatsEndCal(true)}
              >
                <Text style={s.endBtnText}>끝</Text>
              </TouchableOpacity>
              {statsStart || statsEnd ? (
                <TouchableOpacity
                  onPress={() => {
                    setStatsStart("");
                    setStatsEnd("");
                  }}
                >
                  <Text style={s.resetBtn}>초기화</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.statsMetricScroll}
          >
            {METRICS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  s.statsMetricBtn,
                  statsMetric === m.key && {
                    backgroundColor: m.color,
                  },
                ]}
                onPress={() => setStatsMetric(m.key)}
              >
                <Text
                  style={[
                    s.statsMetricText,
                    statsMetric === m.key && s.statsMetricTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {activityStart || activityEnd ? (
                  <Text style={{ fontSize: 11, color: "#A0AEC0" }}>
                    {activityStart || "전체"}~{activityEnd || "현재"}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={s.startBtn}
                  onPress={() => setShowActivityCal(true)}
                >
                  <Text style={s.startBtnText}>시작</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.endBtn}
                  onPress={() => setShowActivityEndCal(true)}
                >
                  <Text style={s.endBtnText}>끝</Text>
                </TouchableOpacity>
                {activityStart || activityEnd ? (
                  <TouchableOpacity
                    onPress={() => {
                      setActivityStart("");
                      setActivityEnd("");
                    }}
                  >
                    <Text style={s.resetBtn}>초기화</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.summaryRow}
              snapToInterval={(width - 48) / 5}
              decelerationRate="fast"
            >
              <View style={[s.summaryItem, { width: (width - 48) / 5 }]}>
                <Text style={s.summaryEmoji}>📅</Text>
                <Text style={s.summaryCount}>{activityRecords.length}</Text>
                <Text style={s.summaryLabel}>총 기록일</Text>
              </View>
              <View style={[s.summaryItem, { width: (width - 48) / 5 }]}>
                <Text style={s.summaryEmoji}>🏃</Text>
                <Text style={s.summaryCount}>
                  {activityRecords.filter((r) => r.exercised).length}
                  <Text style={s.summaryPercent}>
                    (
                    {activityRecords.length > 0
                      ? Math.round(
                          (activityRecords.filter((r) => r.exercised).length /
                            activityRecords.length) *
                            100
                        )
                      : 0}
                    %)
                  </Text>
                </Text>
                <Text style={s.summaryLabel}>운동일</Text>
              </View>
              <View style={[s.summaryItem, { width: (width - 48) / 5 }]}>
                <Text style={s.summaryEmoji}>🍺</Text>
                <Text style={s.summaryCount}>
                  {activityRecords.filter((r) => r.drank).length}
                  <Text style={s.summaryPercent}>
                    (
                    {activityRecords.length > 0
                      ? Math.round(
                          (activityRecords.filter((r) => r.drank).length /
                            activityRecords.length) *
                            100
                        )
                      : 0}
                    %)
                  </Text>
                </Text>
                <Text style={s.summaryLabel}>음주일</Text>
              </View>
              {(userSettings.customBoolMetrics ?? []).map((cbm) => {
                const count = activityRecords.filter(
                  (r) => r.customBoolValues?.[cbm.key]
                ).length;
                const pct =
                  activityRecords.length > 0
                    ? Math.round((count / activityRecords.length) * 100)
                    : 0;
                return (
                  <View
                    key={cbm.key}
                    style={[s.summaryItem, { width: (width - 48) / 5 }]}
                  >
                    <View
                      style={{
                        height: 36,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      {cbm.emoji ? (
                        <Text style={{ fontSize: 26 }}>{cbm.emoji}</Text>
                      ) : (
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: cbm.color,
                          }}
                        />
                      )}
                    </View>
                    <Text style={s.summaryCount}>
                      {count}
                      <Text style={s.summaryPercent}>({pct}%)</Text>
                    </Text>
                    <Text style={s.summaryLabel}>{cbm.label}일</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 통계 시작 캘린더 팝업 */}
        <CalendarModal
          visible={showStatsCal}
          value={statsStart}
          onChange={(v) => {
            setStatsStart(v);
            if (statsEnd && v > statsEnd) setStatsEnd(v);
          }}
          onClose={() => setShowStatsCal(false)}
          maxDate={todayStr}
        />

        {/* 통계 끝 캘린더 팝업 */}
        <CalendarModal
          visible={showStatsEndCal}
          value={statsEnd}
          onChange={setStatsEnd}
          onClose={() => setShowStatsEndCal(false)}
          minDate={statsStart || undefined}
          maxDate={todayStr}
        />

        {/* 활동 요약 시작 캘린더 팝업 */}
        <CalendarModal
          visible={showActivityCal}
          value={activityStart}
          onChange={(v) => {
            setActivityStart(v);
            if (activityEnd && v > activityEnd) setActivityEnd(v);
          }}
          onClose={() => setShowActivityCal(false)}
          maxDate={todayStr}
        />

        {/* 활동 요약 끝 캘린더 팝업 */}
        <CalendarModal
          visible={showActivityEndCal}
          value={activityEnd}
          onChange={setActivityEnd}
          onClose={() => setShowActivityEndCal(false)}
          minDate={activityStart || undefined}
          maxDate={todayStr}
        />
      </ScrollView>
    </View>
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
    gap: 8,
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
  chartCard: {
    position: "relative" as const,
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
  pinchHint: {
    fontSize: 11,
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
  startBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EBF8FF",
  },
  startBtnText: { fontSize: 13, fontWeight: "600", color: "#4299E1" },
  endBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF5F5",
  },
  endBtnText: { fontSize: 13, fontWeight: "600", color: "#E53E3E" },
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
    paddingVertical: 8,
  },
  summaryItem: { alignItems: "center" },
  summaryEmoji: { fontSize: 26, marginBottom: 6 },
  summaryCount: { fontSize: 20, fontWeight: "700", color: "#2D3748" },
  summaryPercent: { fontSize: 13, fontWeight: "500", color: "#718096" },
  summaryLabel: { fontSize: 12, color: "#A0AEC0", marginTop: 2 },
  tooltip: {
    position: "absolute",
    backgroundColor: "#2D3748",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
    textAlign: "center",
  },
  tooltipMetric: {
    fontSize: 11,
    color: "#E2E8F0",
    lineHeight: 17,
  },
});
