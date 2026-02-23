import { SwipeableTab } from "@/components/swipeable-tab";
import { UserSettings, WeightRecord } from "@/types";
import {
  fmtDate,
  getBmiInfo,
  getDaysInMonth,
  getFirstDayOfWeek,
  pad2,
  WEEKDAY_LABELS,
} from "@/utils/format";
import { pickPhoto, takePhoto } from "@/utils/photo";
import {
  deleteRecord,
  loadRecords,
  loadUserSettings,
  upsertRecord,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const DAY_SIZE = Math.floor((width - 56) / 7);

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<WeightRecord | null>(
    null
  );
  const [editMode, setEditMode] = useState(false);
  const [navMode, setNavMode] = useState<
    "calendar" | "yearPicker" | "monthPicker"
  >("calendar");
  const [summaryMode, setSummaryMode] = useState<
    "monthly" | "quarterly" | "yearly"
  >("monthly");

  /* 새 기록 추가 모달 */
  const [addMode, setAddMode] = useState(false);
  const [addDate, setAddDate] = useState("");

  /* 편집 폼 상태 */
  const [eWeight, setEWeight] = useState("");
  const [eWaist, setEWaist] = useState("");
  const [eMuscleMass, setEMuscleMass] = useState("");
  const [eBodyFatPercent, setEBodyFatPercent] = useState("");
  const [eBodyFatMass, setEBodyFatMass] = useState("");
  const [eExercised, setEExercised] = useState(false);
  const [eDrank, setEDrank] = useState(false);
  const [ePhotoUri, setEPhotoUri] = useState<string | undefined>(undefined);
  const [eCustomInputs, setECustomInputs] = useState<Record<string, string>>(
    {}
  );
  const [eBoolCustomInputs, setEBoolCustomInputs] = useState<
    Record<string, boolean>
  >({});
  const [userSettings, setUserSettings] = useState<UserSettings>({});

  useFocusEffect(
    useCallback(() => {
      loadRecords().then(setRecords);
      loadUserSettings().then(setUserSettings);
    }, [])
  );

  const recordMap = useMemo(() => {
    const map: Record<string, WeightRecord> = {};
    records.forEach((r) => {
      map[r.date] = r;
    });
    return map;
  }, [records]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const summaryData = useMemo(() => {
    let filtered: WeightRecord[];
    let periodLabel: string;

    if (summaryMode === "monthly") {
      const prefix = `${year}-${pad2(month + 1)}`;
      filtered = records.filter((r) => r.date.startsWith(prefix));
      periodLabel = `${year}년 ${month + 1}월`;
    } else if (summaryMode === "quarterly") {
      const quarter = Math.floor(month / 3);
      const startMonth = quarter * 3;
      const endMonth = startMonth + 2;
      filtered = records.filter((r) => {
        const [ry, rm] = r.date.split("-").map(Number);
        return ry === year && rm - 1 >= startMonth && rm - 1 <= endMonth;
      });
      periodLabel = `${year}년 ${quarter + 1}분기`;
    } else {
      filtered = records.filter((r) => r.date.startsWith(`${year}`));
      periodLabel = `${year}년`;
    }

    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted.length > 0 ? sorted[0] : null;
    const last = sorted.length > 1 ? sorted[sorted.length - 1] : null;

    const findMetricRange = (
      key: "muscleMass" | "bodyFatPercent" | "bodyFatMass"
    ) => {
      const withData = sorted.filter((r) => r[key] != null);
      if (withData.length === 0) return null;
      if (withData.length === 1)
        return { first: withData[0], last: null as WeightRecord | null };
      return { first: withData[0], last: withData[withData.length - 1] };
    };

    const findCustomRange = (key: string) => {
      const withData = sorted.filter((r) => r.customValues?.[key] != null);
      if (withData.length === 0) return null;
      if (withData.length === 1)
        return { first: withData[0], last: null as WeightRecord | null };
      return { first: withData[0], last: withData[withData.length - 1] };
    };

    const customMetricRanges: Record<
      string,
      { first: WeightRecord; last: WeightRecord | null } | null
    > = {};
    (userSettings.customMetrics ?? []).forEach((cm) => {
      customMetricRanges[cm.key] = findCustomRange(cm.key);
    });

    const customBoolCounts: Record<string, number> = {};
    (userSettings.customBoolMetrics ?? []).forEach((cbm) => {
      customBoolCounts[cbm.key] = filtered.filter(
        (r) => r.customBoolValues?.[cbm.key]
      ).length;
    });

    return {
      records: filtered,
      periodLabel,
      first,
      last,
      muscleMassRange: findMetricRange("muscleMass"),
      bodyFatPercentRange: findMetricRange("bodyFatPercent"),
      bodyFatMassRange: findMetricRange("bodyFatMass"),
      exerciseCount: filtered.filter((r) => r.exercised).length,
      drinkCount: filtered.filter((r) => r.drank).length,
      customMetricRanges,
      customBoolCounts,
    };
  }, [records, year, month, summaryMode, userSettings]);

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;

  /* 모달 열기 */
  const openDetail = (rec: WeightRecord) => {
    setSelectedRecord(rec);
    setEditMode(false);
  };

  /* 편집 모드 시작 */
  const startEdit = () => {
    if (!selectedRecord) return;
    setEWeight(selectedRecord.weight.toString());
    setEWaist(selectedRecord.waist?.toString() ?? "");
    setEMuscleMass(selectedRecord.muscleMass?.toString() ?? "");
    setEBodyFatPercent(selectedRecord.bodyFatPercent?.toString() ?? "");
    setEBodyFatMass(selectedRecord.bodyFatMass?.toString() ?? "");
    setEExercised(selectedRecord.exercised);
    setEDrank(selectedRecord.drank);
    setEPhotoUri(selectedRecord.photoUri);
    const ci: Record<string, string> = {};
    if (selectedRecord.customValues) {
      for (const [k, v] of Object.entries(selectedRecord.customValues)) {
        ci[k] = String(v);
      }
    }
    setECustomInputs(ci);
    const bi: Record<string, boolean> = {};
    if (selectedRecord.customBoolValues) {
      for (const [k, v] of Object.entries(selectedRecord.customBoolValues)) {
        bi[k] = v;
      }
    }
    setEBoolCustomInputs(bi);
    setEditMode(true);
  };

  /* 저장 */
  const handleSave = async () => {
    if (!selectedRecord) return;
    const w = parseFloat(eWeight);
    if (!eWeight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const customValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(eCustomInputs)) {
      const n = parseFloat(v);
      if (!isNaN(n)) customValues[k] = n;
    }
    const updated: WeightRecord = {
      ...selectedRecord,
      weight: w,
      waist: eWaist ? parseFloat(eWaist) : undefined,
      muscleMass: eMuscleMass ? parseFloat(eMuscleMass) : undefined,
      bodyFatPercent: eBodyFatPercent ? parseFloat(eBodyFatPercent) : undefined,
      bodyFatMass: eBodyFatMass ? parseFloat(eBodyFatMass) : undefined,
      exercised: eExercised,
      drank: eDrank,
      photoUri: ePhotoUri,
      customValues:
        Object.keys(customValues).length > 0 ? customValues : undefined,
      customBoolValues:
        Object.keys(eBoolCustomInputs).length > 0
          ? { ...eBoolCustomInputs }
          : undefined,
    };
    const newRecords = await upsertRecord(updated);
    setRecords(newRecords);
    setSelectedRecord(updated);
    setEditMode(false);
    Alert.alert("저장 완료", "기록이 수정되었습니다.");
  };

  /* 삭제 */
  const handleDelete = () => {
    if (!selectedRecord) return;
    Alert.alert("기록 삭제", "이 기록을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const newRecords = await deleteRecord(selectedRecord.date);
          setRecords(newRecords);
          setSelectedRecord(null);
          setEditMode(false);
        },
      },
    ]);
  };

  const closeModal = () => {
    setSelectedRecord(null);
    setEditMode(false);
    setAddMode(false);
    setAddDate("");
  };

  /* 빈 날짜 클릭 → 새 기록 추가 */
  const openAddModal = (dateStr: string) => {
    setAddDate(dateStr);
    setEWeight("");
    setEWaist("");
    setEMuscleMass("");
    setEBodyFatPercent("");
    setEBodyFatMass("");
    setEExercised(false);
    setEDrank(false);
    setEPhotoUri(undefined);
    setECustomInputs({});
    setEBoolCustomInputs({});
    setAddMode(true);
  };

  const handleAddSave = async () => {
    const w = parseFloat(eWeight);
    if (!eWeight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const addCustomValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(eCustomInputs)) {
      const n = parseFloat(v);
      if (!isNaN(n)) addCustomValues[k] = n;
    }
    const newRec: WeightRecord = {
      id: addDate,
      date: addDate,
      weight: w,
      waist: eWaist ? parseFloat(eWaist) : undefined,
      muscleMass: eMuscleMass ? parseFloat(eMuscleMass) : undefined,
      bodyFatPercent: eBodyFatPercent ? parseFloat(eBodyFatPercent) : undefined,
      bodyFatMass: eBodyFatMass ? parseFloat(eBodyFatMass) : undefined,
      exercised: eExercised,
      drank: eDrank,
      photoUri: ePhotoUri,
      customValues:
        Object.keys(addCustomValues).length > 0 ? addCustomValues : undefined,
      customBoolValues:
        Object.keys(eBoolCustomInputs).length > 0
          ? { ...eBoolCustomInputs }
          : undefined,
    };
    const newRecords = await upsertRecord(newRec);
    setRecords(newRecords);
    setAddMode(false);
    setAddDate("");
    Alert.alert("저장 완료", `${fmtDate(addDate)} 기록이 추가되었습니다.`);
  };

  return (
    <SwipeableTab currentIndex={2}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* 월 네비게이션 */}
        <View style={s.navRow}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <Text style={s.navBtnText}>◀</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() =>
                setNavMode((m) =>
                  m === "yearPicker" ? "calendar" : "yearPicker"
                )
              }
            >
              <Text style={s.navTitle}>{year}년</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setNavMode((m) =>
                  m === "monthPicker" ? "calendar" : "monthPicker"
                )
              }
            >
              <Text style={[s.navTitle, { marginLeft: 4 }]}>{month + 1}월</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToday} style={{ marginLeft: 8 }}>
              <Text
                style={{ fontSize: 12, color: "#4CAF50", fontWeight: "600" }}
              >
                오늘
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <Text style={s.navBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* 연도/월 선택 */}
        {navMode === "yearPicker" && (
          <ScrollView
            style={{ maxHeight: 180, marginBottom: 12 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
              }}
            >
              {Array.from(
                { length: now.getFullYear() - 1950 + 1 },
                (_, i) => now.getFullYear() - i
              ).map((y) => (
                <TouchableOpacity
                  key={y}
                  onPress={() => {
                    setYear(y);
                    setNavMode("calendar");
                  }}
                  style={{
                    width: (width - 56) / 7,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: y === year ? "#4CAF50" : "#EDF2F7",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: y === year ? "#fff" : "#4A5568",
                    }}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {navMode === "monthPicker" && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
              justifyContent: "center",
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  setMonth(m);
                  setNavMode("calendar");
                }}
                style={{
                  width: (width - 80) / 4,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: m === month ? "#4CAF50" : "#EDF2F7",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: m === month ? "#fff" : "#4A5568",
                  }}
                >
                  {m + 1}월
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 기간 모드 토글 */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#E2E8F0",
            borderRadius: 8,
            padding: 2,
            marginBottom: 12,
          }}
        >
          {(["monthly", "quarterly", "yearly"] as const).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setSummaryMode(m)}
              style={{
                flex: 1,
                paddingVertical: 6,
                borderRadius: 6,
                alignItems: "center",
                backgroundColor: summaryMode === m ? "#fff" : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: summaryMode === m ? "600" : "500",
                  color: summaryMode === m ? "#2D3748" : "#718096",
                }}
              >
                {{ monthly: "월별", quarterly: "분기별", yearly: "연별" }[m]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 요약 칩 */}
        <View style={s.monthSummary}>
          <View style={s.summaryChip}>
            <Text style={s.summaryNum}>{summaryData.records.length}</Text>
            <Text style={s.summaryLabel}>기록일</Text>
          </View>
          <View style={s.summaryChip}>
            <Text style={s.summaryNum}>{summaryData.exerciseCount}</Text>
            <Text style={s.summaryLabel}>운동</Text>
          </View>
          <View style={s.summaryChip}>
            <Text style={s.summaryNum}>{summaryData.drinkCount}</Text>
            <Text style={s.summaryLabel}>음주</Text>
          </View>
        </View>

        {/* 기간 변화 */}
        {summaryData.first &&
          summaryData.last &&
          summaryData.first.date !== summaryData.last.date && (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#4A5568",
                  marginBottom: 8,
                }}
              >
                {summaryData.periodLabel} 변화
              </Text>
              {/* 몸무게 (항상 표시) */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 4,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#718096" }}>몸무게</Text>
                  <Text style={{ fontSize: 10, color: "#A0AEC0" }}>
                    {summaryData.first.date.slice(2).replace(/-/g, ".")}~
                    {summaryData.last.date.slice(2).replace(/-/g, ".")}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      summaryData.last.weight - summaryData.first.weight <= 0
                        ? "#38A169"
                        : "#E53E3E",
                  }}
                >
                  {summaryData.first.weight}→{summaryData.last.weight}kg (
                  {summaryData.last.weight - summaryData.first.weight > 0
                    ? "+"
                    : ""}
                  {(summaryData.last.weight - summaryData.first.weight).toFixed(
                    1
                  )}
                  )
                </Text>
              </View>
              {/* 골격근량 */}
              {userSettings.metricDisplayVisibility?.muscleMass !== false &&
                (() => {
                  const range = summaryData.muscleMassRange;
                  if (!range) return null;
                  const fmtShort = (d: string) => d.slice(2).replace(/-/g, ".");
                  if (!range.last) {
                    // 데이터 1개만 존재
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#718096" }}>
                          골격근량
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#4A5568",
                          }}
                        >
                          {range.first.muscleMass}kg
                        </Text>
                      </View>
                    );
                  }
                  const diff = range.last.muscleMass! - range.first.muscleMass!;
                  const dateLabel = `${fmtShort(range.first.date)}~${fmtShort(range.last.date)}`;
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#718096" }}>
                          골격근량
                        </Text>
                        <Text style={{ fontSize: 10, color: "#A0AEC0" }}>
                          {dateLabel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: diff >= 0 ? "#38A169" : "#E53E3E",
                        }}
                      >
                        {range.first.muscleMass}→{range.last.muscleMass}kg (
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)})
                      </Text>
                    </View>
                  );
                })()}
              {/* 체지방률 */}
              {userSettings.metricDisplayVisibility?.bodyFatPercent !== false &&
                (() => {
                  const range = summaryData.bodyFatPercentRange;
                  if (!range) return null;
                  const fmtShort = (d: string) => d.slice(2).replace(/-/g, ".");
                  if (!range.last) {
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#718096" }}>
                          체지방률
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#4A5568",
                          }}
                        >
                          {range.first.bodyFatPercent}%
                        </Text>
                      </View>
                    );
                  }
                  const diff =
                    range.last.bodyFatPercent! - range.first.bodyFatPercent!;
                  const dateLabel = `${fmtShort(range.first.date)}~${fmtShort(range.last.date)}`;
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#718096" }}>
                          체지방률
                        </Text>
                        <Text style={{ fontSize: 10, color: "#A0AEC0" }}>
                          {dateLabel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: diff <= 0 ? "#38A169" : "#E53E3E",
                        }}
                      >
                        {range.first.bodyFatPercent}→{range.last.bodyFatPercent}
                        % ({diff > 0 ? "+" : ""}
                        {diff.toFixed(1)})
                      </Text>
                    </View>
                  );
                })()}
              {/* 체지방량 */}
              {userSettings.metricDisplayVisibility?.bodyFatMass !== false &&
                (() => {
                  const range = summaryData.bodyFatMassRange;
                  if (!range) return null;
                  const fmtShort = (d: string) => d.slice(2).replace(/-/g, ".");
                  if (!range.last) {
                    return (
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#718096" }}>
                          체지방량
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#4A5568",
                          }}
                        >
                          {range.first.bodyFatMass}kg
                        </Text>
                      </View>
                    );
                  }
                  const diff =
                    range.last.bodyFatMass! - range.first.bodyFatMass!;
                  const dateLabel = `${fmtShort(range.first.date)}~${fmtShort(range.last.date)}`;
                  return (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#718096" }}>
                          체지방량
                        </Text>
                        <Text style={{ fontSize: 10, color: "#A0AEC0" }}>
                          {dateLabel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: diff <= 0 ? "#38A169" : "#E53E3E",
                        }}
                      >
                        {range.first.bodyFatMass}→{range.last.bodyFatMass}kg (
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)})
                      </Text>
                    </View>
                  );
                })()}
              {/* 사용자 정의 수치 변화 */}
              {(userSettings.customMetrics ?? []).map((cm) => {
                if (userSettings.metricDisplayVisibility?.[cm.key] === false)
                  return null;
                const range = summaryData.customMetricRanges?.[cm.key];
                if (!range) return null;
                const fmtShort = (d: string) => d.slice(2).replace(/-/g, ".");
                const firstVal = range.first.customValues?.[cm.key];
                if (firstVal == null) return null;
                if (!range.last) {
                  return (
                    <View
                      key={cm.key}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: "#718096" }}>
                        {cm.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#4A5568",
                        }}
                      >
                        {firstVal}
                        {cm.unit}
                      </Text>
                    </View>
                  );
                }
                const lastVal = range.last.customValues?.[cm.key];
                if (lastVal == null) return null;
                const diff = lastVal - firstVal;
                return (
                  <View
                    key={cm.key}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 4,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: "#718096" }}>
                        {cm.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: "#A0AEC0" }}>
                        {fmtShort(range.first.date)}~{fmtShort(range.last.date)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: diff <= 0 ? "#38A169" : "#E53E3E",
                      }}
                    >
                      {firstVal}→{lastVal}
                      {cm.unit} ({diff > 0 ? "+" : ""}
                      {diff.toFixed(1)})
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

        {/* 캘린더 */}
        <View style={s.calendarCard}>
          {/* 요일 헤더 */}
          <View style={s.weekRow}>
            {WEEKDAY_LABELS.map((d, i) => (
              <View key={i} style={s.weekCell}>
                <Text
                  style={[
                    s.weekText,
                    i === 0 && { color: "#E53E3E" },
                    i === 6 && { color: "#3182CE" },
                  ]}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* 날짜 그리드 */}
          {Array.from({ length: calendarCells.length / 7 }, (_, weekIdx) => (
            <View key={weekIdx} style={s.weekRow}>
              {calendarCells
                .slice(weekIdx * 7, weekIdx * 7 + 7)
                .map((day, di) => {
                  if (day === null) {
                    return <View key={di} style={s.dayCell} />;
                  }
                  const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
                  const rec = recordMap[dateStr];
                  const isToday = dateStr === todayStr;
                  const dayOfWeek = (firstDay + day - 1) % 7;
                  const isFuture = dateStr > todayStr;

                  return (
                    <TouchableOpacity
                      key={di}
                      style={[
                        s.dayCell,
                        isToday && s.dayCellToday,
                        rec && s.dayCellHasRecord,
                      ]}
                      onPress={() => {
                        if (rec) {
                          openDetail(rec);
                        } else if (!isFuture) {
                          openAddModal(dateStr);
                        }
                      }}
                      disabled={isFuture}
                    >
                      <Text
                        style={[
                          s.dayText,
                          dayOfWeek === 0 && { color: "#E53E3E" },
                          dayOfWeek === 6 && { color: "#3182CE" },
                          isToday && s.dayTextToday,
                        ]}
                      >
                        {day}
                      </Text>
                      {rec && (
                        <View style={s.dotRow}>
                          {userSettings.metricDisplayVisibility?.exercised !==
                            false &&
                            rec.exercised && (
                              <View
                                style={[
                                  s.miniDot,
                                  { backgroundColor: "#4CAF50" },
                                ]}
                              />
                            )}
                          {userSettings.metricDisplayVisibility?.drank !==
                            false &&
                            rec.drank && (
                              <View
                                style={[
                                  s.miniDot,
                                  { backgroundColor: "#FF9800" },
                                ]}
                              />
                            )}
                          {(userSettings.customBoolMetrics ?? []).map((cbm) =>
                            userSettings.metricDisplayVisibility?.[cbm.key] !==
                              false && rec.customBoolValues?.[cbm.key] ? (
                              <View
                                key={cbm.key}
                                style={[
                                  s.miniDot,
                                  { backgroundColor: cbm.color },
                                ]}
                              />
                            ) : null
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))}

          {/* 범례 */}
          <View style={s.legendRow}>
            {userSettings.metricDisplayVisibility?.exercised !== false && (
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: "#4CAF50" }]} />
                <Text style={s.legendText}>운동</Text>
              </View>
            )}
            {userSettings.metricDisplayVisibility?.drank !== false && (
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: "#FF9800" }]} />
                <Text style={s.legendText}>음주</Text>
              </View>
            )}
            {(userSettings.customBoolMetrics ?? []).map((cbm) =>
              userSettings.metricDisplayVisibility?.[cbm.key] !== false ? (
                <View key={cbm.key} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: cbm.color }]} />
                  <Text style={s.legendText}>{cbm.label}</Text>
                </View>
              ) : null
            )}
          </View>
        </View>

        {/* 상세/수정 모달 */}
        <Modal
          visible={!!selectedRecord}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={s.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeModal}
            />
            <View style={s.modalCard}>
              {selectedRecord && !editMode && (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                >
                  <Text style={s.modalDate}>
                    {fmtDate(selectedRecord.date)}
                  </Text>
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>몸무게</Text>
                    <Text style={s.modalValue}>{selectedRecord.weight} kg</Text>
                  </View>
                  {userSettings.metricDisplayVisibility?.waist !== false &&
                    selectedRecord.waist != null && (
                      <View style={s.modalRow}>
                        <Text style={s.modalLabel}>허리둘레</Text>
                        <Text style={s.modalValue}>
                          {selectedRecord.waist} cm
                        </Text>
                      </View>
                    )}
                  {userSettings.metricDisplayVisibility?.muscleMass !== false &&
                    selectedRecord.muscleMass != null && (
                      <View style={s.modalRow}>
                        <Text style={s.modalLabel}>골격근량</Text>
                        <Text style={s.modalValue}>
                          {selectedRecord.muscleMass} kg
                        </Text>
                      </View>
                    )}
                  {userSettings.metricDisplayVisibility?.bodyFatPercent !==
                    false &&
                    selectedRecord.bodyFatPercent != null && (
                      <View style={s.modalRow}>
                        <Text style={s.modalLabel}>체지방률</Text>
                        <Text style={s.modalValue}>
                          {selectedRecord.bodyFatPercent} %
                        </Text>
                      </View>
                    )}
                  {userSettings.metricDisplayVisibility?.bodyFatMass !==
                    false &&
                    selectedRecord.bodyFatMass != null && (
                      <View style={s.modalRow}>
                        <Text style={s.modalLabel}>체지방량</Text>
                        <Text style={s.modalValue}>
                          {selectedRecord.bodyFatMass} kg
                        </Text>
                      </View>
                    )}
                  {/* 사용자 정의 수치 */}
                  {(userSettings.customMetrics ?? [])
                    .filter(
                      (cm) =>
                        userSettings.metricDisplayVisibility?.[cm.key] !== false
                    )
                    .map((cm) => {
                      const val = selectedRecord.customValues?.[cm.key];
                      if (val == null) return null;
                      return (
                        <View key={cm.key} style={s.modalRow}>
                          <Text style={s.modalLabel}>{cm.label}</Text>
                          <Text style={s.modalValue}>
                            {val} {cm.unit}
                          </Text>
                        </View>
                      );
                    })}
                  {userSettings.height &&
                    (() => {
                      const info = getBmiInfo(
                        selectedRecord.weight,
                        userSettings.height
                      );
                      if (!info) return null;
                      return (
                        <View style={{ marginTop: 8 }}>
                          <View style={s.modalRow}>
                            <Text style={s.modalLabel}>BMI</Text>
                            <Text style={[s.modalValue, { color: info.color }]}>
                              {info.bmi} ({info.label})
                            </Text>
                          </View>
                          <View
                            style={{
                              marginTop: 4,
                              height: 10,
                              position: "relative",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                height: 8,
                                borderRadius: 4,
                                overflow: "hidden",
                              }}
                            >
                              <View
                                style={{
                                  flex: 18.5,
                                  backgroundColor: "#BEE3F8",
                                }}
                              />
                              <View
                                style={{
                                  flex: 4.5,
                                  backgroundColor: "#C6F6D5",
                                }}
                              />
                              <View
                                style={{ flex: 2, backgroundColor: "#FEEBC8" }}
                              />
                              <View
                                style={{ flex: 15, backgroundColor: "#FED7D7" }}
                              />
                            </View>
                            <View
                              style={{
                                position: "absolute",
                                top: -1,
                                left: `${Math.min(95, Math.max(2, ((info.bmi - 10) / 30) * 100))}%`,
                                width: 4,
                                height: 10,
                                backgroundColor: "#2D3748",
                                borderRadius: 2,
                              }}
                            />
                          </View>
                        </View>
                      );
                    })()}
                  {selectedRecord.photoUri && (
                    <Image
                      source={{ uri: selectedRecord.photoUri }}
                      style={s.modalPhoto}
                    />
                  )}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                    contentContainerStyle={s.modalBadges}
                  >
                    {selectedRecord.exercised && (
                      <View style={[s.badge, s.badgeGreen]}>
                        <Text style={s.badgeText}>운동</Text>
                      </View>
                    )}
                    {selectedRecord.drank && (
                      <View style={[s.badge, s.badgeOrange]}>
                        <Text style={s.badgeText}>음주</Text>
                      </View>
                    )}
                    {(userSettings.customBoolMetrics ?? []).map((cbm) =>
                      selectedRecord.customBoolValues?.[cbm.key] ? (
                        <View
                          key={cbm.key}
                          style={[
                            s.badge,
                            { backgroundColor: cbm.color + "22" },
                          ]}
                        >
                          <Text style={[s.badgeText, { color: cbm.color }]}>
                            {cbm.label}
                          </Text>
                        </View>
                      ) : null
                    )}
                  </ScrollView>

                  {/* 수정/삭제 버튼 */}
                  <View style={s.modalActionRow}>
                    <TouchableOpacity
                      style={s.modalEditBtn}
                      onPress={startEdit}
                    >
                      <Text style={s.modalEditBtnText}>수정</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.modalDeleteBtn}
                      onPress={handleDelete}
                    >
                      <Text style={s.modalDeleteBtnText}>삭제</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={s.modalClose} onPress={closeModal}>
                    <Text style={s.modalCloseText}>닫기</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* 편집 모드 */}
              {selectedRecord && editMode && (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  nestedScrollEnabled
                >
                  <Text style={s.modalDate}>
                    {fmtDate(selectedRecord.date)} 수정
                  </Text>

                  <Text style={s.editLabel}>몸무게 (kg)</Text>
                  <TextInput
                    style={s.editInput}
                    value={eWeight}
                    onChangeText={setEWeight}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor="#aaa"
                  />

                  {userSettings.metricInputVisibility?.waist !== false && (
                    <>
                      <Text style={s.editLabel}>허리둘레 (cm)</Text>
                      <TextInput
                        style={s.editInput}
                        value={eWaist}
                        onChangeText={setEWaist}
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </>
                  )}

                  {userSettings.metricInputVisibility?.muscleMass !== false && (
                    <>
                      <Text style={s.editLabel}>골격근량 (kg)</Text>
                      <TextInput
                        style={s.editInput}
                        value={eMuscleMass}
                        onChangeText={setEMuscleMass}
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </>
                  )}

                  {userSettings.metricInputVisibility?.bodyFatPercent !==
                    false && (
                    <>
                      <Text style={s.editLabel}>체지방률 (%)</Text>
                      <TextInput
                        style={s.editInput}
                        value={eBodyFatPercent}
                        onChangeText={(v) => {
                          setEBodyFatPercent(v);
                          const w = parseFloat(eWeight);
                          const p = parseFloat(v);
                          if (w > 0 && p >= 0 && !isNaN(p)) {
                            setEBodyFatMass(((w * p) / 100).toFixed(1));
                          }
                        }}
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </>
                  )}

                  {userSettings.metricInputVisibility?.bodyFatMass !==
                    false && (
                    <>
                      <Text style={s.editLabel}>체지방량 (kg)</Text>
                      <TextInput
                        style={s.editInput}
                        value={eBodyFatMass}
                        onChangeText={(v) => {
                          setEBodyFatMass(v);
                          const w = parseFloat(eWeight);
                          const m = parseFloat(v);
                          if (w > 0 && m >= 0 && !isNaN(m)) {
                            setEBodyFatPercent(((m / w) * 100).toFixed(1));
                          }
                        }}
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </>
                  )}

                  {/* 사용자 정의 수치 */}
                  {(userSettings.customMetrics ?? [])
                    .filter(
                      (cm) =>
                        userSettings.metricInputVisibility?.[cm.key] !== false
                    )
                    .map((cm) => (
                      <View key={cm.key}>
                        <Text style={s.editLabel}>
                          {cm.label} ({cm.unit})
                        </Text>
                        <TextInput
                          style={s.editInput}
                          value={eCustomInputs[cm.key] ?? ""}
                          onChangeText={(v) =>
                            setECustomInputs((prev) => ({
                              ...prev,
                              [cm.key]: v,
                            }))
                          }
                          keyboardType="decimal-pad"
                          placeholder="선택"
                          placeholderTextColor="#aaa"
                        />
                      </View>
                    ))}

                  {/* 눈바디 사진 */}
                  <Text style={s.editLabel}>눈바디 사진</Text>
                  {ePhotoUri ? (
                    <View style={{ alignItems: "center", marginVertical: 8 }}>
                      <Image source={{ uri: ePhotoUri }} style={s.editPhoto} />
                      <TouchableOpacity
                        style={s.photoRemoveBtn}
                        onPress={() => setEPhotoUri(undefined)}
                      >
                        <Text style={s.photoRemoveBtnText}>사진 제거</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <View style={s.photoActionRow}>
                    <TouchableOpacity
                      style={s.photoActionBtn}
                      onPress={async () => {
                        const uri = await takePhoto(
                          "body",
                          userSettings.bodyPhotoQuality
                        );
                        if (uri) setEPhotoUri(uri);
                      }}
                    >
                      <Text style={s.photoActionBtnText}>촬영</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.photoActionBtn}
                      onPress={async () => {
                        const uri = await pickPhoto(
                          "body",
                          userSettings.bodyPhotoQuality
                        );
                        if (uri) setEPhotoUri(uri);
                      }}
                    >
                      <Text style={s.photoActionBtnText}>갤러리</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.editSwitchRow}>
                    <Text style={s.editLabel}>🏃 운동</Text>
                    <Switch
                      value={eExercised}
                      onValueChange={setEExercised}
                      trackColor={{ true: "#4CAF50", false: "#ddd" }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={s.editSwitchRow}>
                    <Text style={s.editLabel}>🍺 음주</Text>
                    <Switch
                      value={eDrank}
                      onValueChange={setEDrank}
                      trackColor={{ true: "#FF9800", false: "#ddd" }}
                      thumbColor="#fff"
                    />
                  </View>
                  {(userSettings.customBoolMetrics ?? []).map((cbm) => (
                    <View key={cbm.key} style={s.editSwitchRow}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flex: 1,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: cbm.color,
                          }}
                        />
                        <Text style={s.editLabel}>
                          {cbm.emoji ? `${cbm.emoji} ` : ""}
                          {cbm.label}
                        </Text>
                      </View>
                      <Switch
                        value={eBoolCustomInputs[cbm.key] ?? false}
                        onValueChange={(v) =>
                          setEBoolCustomInputs((prev) => ({
                            ...prev,
                            [cbm.key]: v,
                          }))
                        }
                        trackColor={{ true: cbm.color, false: "#ddd" }}
                        thumbColor="#fff"
                      />
                    </View>
                  ))}

                  <View style={s.modalActionRow}>
                    <TouchableOpacity
                      style={s.modalSaveBtn}
                      onPress={handleSave}
                    >
                      <Text style={s.modalSaveBtnText}>저장</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.modalCancelBtn}
                      onPress={() => setEditMode(false)}
                    >
                      <Text style={s.modalCancelBtnText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
        {/* 새 기록 추가 모달 */}
        <Modal
          visible={addMode}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setAddMode(false);
            setAddDate("");
          }}
        >
          <View style={s.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => {
                setAddMode(false);
                setAddDate("");
              }}
            />
            <View style={s.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <Text style={s.modalDate}>
                  {addDate ? fmtDate(addDate) : ""} 새 기록
                </Text>

                <Text style={s.editLabel}>몸무게 (kg) *</Text>
                <TextInput
                  style={s.editInput}
                  value={eWeight}
                  onChangeText={setEWeight}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#aaa"
                />

                {userSettings.metricInputVisibility?.waist !== false && (
                  <>
                    <Text style={s.editLabel}>허리둘레 (cm)</Text>
                    <TextInput
                      style={s.editInput}
                      value={eWaist}
                      onChangeText={setEWaist}
                      keyboardType="decimal-pad"
                      placeholder="선택"
                      placeholderTextColor="#aaa"
                    />
                  </>
                )}

                {userSettings.metricInputVisibility?.muscleMass !== false && (
                  <>
                    <Text style={s.editLabel}>골격근량 (kg)</Text>
                    <TextInput
                      style={s.editInput}
                      value={eMuscleMass}
                      onChangeText={setEMuscleMass}
                      keyboardType="decimal-pad"
                      placeholder="선택"
                      placeholderTextColor="#aaa"
                    />
                  </>
                )}

                {userSettings.metricInputVisibility?.bodyFatPercent !==
                  false && (
                  <>
                    <Text style={s.editLabel}>체지방률 (%)</Text>
                    <TextInput
                      style={s.editInput}
                      value={eBodyFatPercent}
                      onChangeText={(v) => {
                        setEBodyFatPercent(v);
                        const w = parseFloat(eWeight);
                        const p = parseFloat(v);
                        if (w > 0 && p >= 0 && !isNaN(p)) {
                          setEBodyFatMass(((w * p) / 100).toFixed(1));
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="선택"
                      placeholderTextColor="#aaa"
                    />
                  </>
                )}

                {userSettings.metricInputVisibility?.bodyFatMass !== false && (
                  <>
                    <Text style={s.editLabel}>체지방량 (kg)</Text>
                    <TextInput
                      style={s.editInput}
                      value={eBodyFatMass}
                      onChangeText={(v) => {
                        setEBodyFatMass(v);
                        const w = parseFloat(eWeight);
                        const m = parseFloat(v);
                        if (w > 0 && m >= 0 && !isNaN(m)) {
                          setEBodyFatPercent(((m / w) * 100).toFixed(1));
                        }
                      }}
                      keyboardType="decimal-pad"
                      placeholder="선택"
                      placeholderTextColor="#aaa"
                    />
                  </>
                )}

                {/* 사용자 정의 수치 */}
                {(userSettings.customMetrics ?? [])
                  .filter(
                    (cm) =>
                      userSettings.metricInputVisibility?.[cm.key] !== false
                  )
                  .map((cm) => (
                    <View key={cm.key}>
                      <Text style={s.editLabel}>
                        {cm.label} ({cm.unit})
                      </Text>
                      <TextInput
                        style={s.editInput}
                        value={eCustomInputs[cm.key] ?? ""}
                        onChangeText={(v) =>
                          setECustomInputs((prev) => ({ ...prev, [cm.key]: v }))
                        }
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </View>
                  ))}

                {/* 눈바디 사진 */}
                <Text style={s.editLabel}>눈바디 사진</Text>
                {ePhotoUri ? (
                  <View style={{ alignItems: "center", marginVertical: 8 }}>
                    <Image source={{ uri: ePhotoUri }} style={s.editPhoto} />
                    <TouchableOpacity
                      style={s.photoRemoveBtn}
                      onPress={() => setEPhotoUri(undefined)}
                    >
                      <Text style={s.photoRemoveBtnText}>사진 제거</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={s.photoActionRow}>
                  <TouchableOpacity
                    style={s.photoActionBtn}
                    onPress={async () => {
                      const uri = await takePhoto(
                        "body",
                        userSettings.bodyPhotoQuality
                      );
                      if (uri) setEPhotoUri(uri);
                    }}
                  >
                    <Text style={s.photoActionBtnText}>촬영</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.photoActionBtn}
                    onPress={async () => {
                      const uri = await pickPhoto(
                        "body",
                        userSettings.bodyPhotoQuality
                      );
                      if (uri) setEPhotoUri(uri);
                    }}
                  >
                    <Text style={s.photoActionBtnText}>갤러리</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.editSwitchRow}>
                  <Text style={s.editLabel}>🏃 운동</Text>
                  <Switch
                    value={eExercised}
                    onValueChange={setEExercised}
                    trackColor={{ true: "#4CAF50", false: "#ddd" }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={s.editSwitchRow}>
                  <Text style={s.editLabel}>🍺 음주</Text>
                  <Switch
                    value={eDrank}
                    onValueChange={setEDrank}
                    trackColor={{ true: "#FF9800", false: "#ddd" }}
                    thumbColor="#fff"
                  />
                </View>
                {(userSettings.customBoolMetrics ?? []).map((cbm) => (
                  <View key={cbm.key} style={s.editSwitchRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: cbm.color,
                        }}
                      />
                      <Text style={s.editLabel}>
                        {cbm.emoji ? `${cbm.emoji} ` : ""}
                        {cbm.label}
                      </Text>
                    </View>
                    <Switch
                      value={eBoolCustomInputs[cbm.key] ?? false}
                      onValueChange={(v) =>
                        setEBoolCustomInputs((prev) => ({
                          ...prev,
                          [cbm.key]: v,
                        }))
                      }
                      trackColor={{ true: cbm.color, false: "#ddd" }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}

                <View style={s.modalActionRow}>
                  <TouchableOpacity
                    style={s.modalSaveBtn}
                    onPress={handleAddSave}
                  >
                    <Text style={s.modalSaveBtnText}>저장</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.modalCancelBtn}
                    onPress={() => {
                      setAddMode(false);
                      setAddDate("");
                    }}
                  >
                    <Text style={s.modalCancelBtnText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SwipeableTab>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 20,
  },

  /* nav */
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  navBtnText: { fontSize: 16, color: "#4A5568" },
  navTitle: { fontSize: 20, fontWeight: "700", color: "#2D3748" },

  /* month summary */
  monthSummary: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryChip: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryNum: { fontSize: 22, fontWeight: "700", color: "#2D3748" },
  summaryLabel: { fontSize: 12, color: "#A0AEC0", marginTop: 2 },

  /* calendar */
  calendarCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  weekRow: { flexDirection: "row", justifyContent: "space-around" },
  weekCell: {
    width: DAY_SIZE,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  weekText: { fontSize: 13, fontWeight: "600", color: "#718096" },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: DAY_SIZE / 2,
  },
  dayCellToday: { borderWidth: 2, borderColor: "#4CAF50" },
  dayCellHasRecord: { backgroundColor: "#F0FFF4" },
  dayText: { fontSize: 14, fontWeight: "500", color: "#2D3748" },
  dayTextToday: { fontWeight: "700", color: "#4CAF50" },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  miniDot: { width: 5, height: 5, borderRadius: 2.5 },

  /* legend */
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 12, color: "#718096" },

  /* modal */
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    width: width * 0.88,
    maxHeight: "80%",
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
    alignItems: "center",
  },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeGreen: { backgroundColor: "#E8F5E9" },
  badgeOrange: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 13, fontWeight: "500", color: "#4A5568" },

  /* modal actions */
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalEditBtn: {
    flex: 1,
    backgroundColor: "#EBF8FF",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalEditBtnText: { fontSize: 14, fontWeight: "600", color: "#3182CE" },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: "#FFF5F5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalDeleteBtnText: { fontSize: 14, fontWeight: "600", color: "#E53E3E" },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalSaveBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelBtnText: { fontSize: 14, fontWeight: "600", color: "#718096" },

  /* edit form */
  editLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 4,
    marginTop: 8,
  },
  editInput: {
    height: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  editSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },

  editPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 8,
  },
  photoActionBtn: {
    flex: 1,
    backgroundColor: "#EBF8FF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  photoActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3182CE",
  },
  photoRemoveBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#FFF5F5",
  },
  photoRemoveBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E53E3E",
  },

  modalClose: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#F0F4F8",
    borderRadius: 10,
  },
  modalCloseText: { fontSize: 15, fontWeight: "600", color: "#4A5568" },
});
