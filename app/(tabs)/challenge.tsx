import { SwipeableTab } from "@/components/swipeable-tab";
import { Challenge, METRIC_COLORS, WeightRecord } from "@/types";
import {
  deleteChallenge,
  getLocalDateString,
  loadChallenge,
  loadRecords,
  saveChallenge,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
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

const { width } = Dimensions.get("window");
const CP_DAY2 = Math.floor((width * 0.82 - 56) / 7);

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}\ub144 ${parseInt(m)}\uc6d4 ${parseInt(d)}\uc77c`;
}

function daysBetween(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function pad2ch(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonthCh(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeekCh(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/* \u2500\u2500\u2500\u2500\u2500 \ub0a0\uc9dc \uce98\ub9b0\ub354 \ud53d\ucee4 \u2500\u2500\u2500\u2500\u2500 */
function DateCalendarPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
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
  const daysInMonth = getDaysInMonthCh(cYear, cMonth);
  const firstDay = getFirstDayOfWeekCh(cYear, cMonth);
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
      <Text style={st.formLabel}>{label}</Text>
      <TouchableOpacity style={dcpS.inputWrap} onPress={openCal}>
        <TextInput
          style={dcpS.input}
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#aaa"
          maxLength={10}
          keyboardType={
            Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
          }
        />
        <Text style={dcpS.icon}>{"\uD83D\uDCC5"}</Text>
      </TouchableOpacity>

      <Modal
        visible={showCal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCal(false)}
      >
        <TouchableOpacity
          style={dcpS.overlay}
          activeOpacity={1}
          onPress={() => setShowCal(false)}
        >
          <View style={dcpS.card} onStartShouldSetResponder={() => true}>
            <View style={dcpS.navRow}>
              <TouchableOpacity onPress={prevM} style={dcpS.navBtn}>
                <Text style={dcpS.navBtnText}>\u25C0</Text>
              </TouchableOpacity>
              <Text style={dcpS.navTitle}>
                {cYear}\ub144 {cMonth + 1}\uc6d4
              </Text>
              <TouchableOpacity onPress={nextM} style={dcpS.navBtn}>
                <Text style={dcpS.navBtnText}>\u25B6</Text>
              </TouchableOpacity>
            </View>
            <View style={dcpS.weekRow}>
              {WKDAYS.map((d, i) => (
                <View key={i} style={dcpS.weekCell}>
                  <Text
                    style={[
                      dcpS.weekText,
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
              <View key={wi} style={dcpS.weekRow}>
                {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                  if (day === null)
                    return <View key={di} style={dcpS.dayCell} />;
                  const dateStr = `${cYear}-${pad2ch(cMonth + 1)}-${pad2ch(day)}`;
                  const isSelected = dateStr === value;
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[dcpS.dayCell, isSelected && dcpS.dayCellSelected]}
                      onPress={() => {
                        onChange(dateStr);
                        setShowCal(false);
                      }}
                    >
                      <Text
                        style={[dcpS.dayText, isSelected && { color: "#fff" }]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const dcpS = StyleSheet.create({
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F7FAFC",
    paddingRight: 10,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#2D3748",
  },
  icon: { fontSize: 18 },
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
    width: CP_DAY2,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  weekText: { fontSize: 11, fontWeight: "600", color: "#718096" },
  dayCell: {
    width: CP_DAY2,
    height: CP_DAY2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CP_DAY2 / 2,
  },
  dayCellSelected: { backgroundColor: "#4CAF50" },
  dayText: { fontSize: 13, fontWeight: "500", color: "#2D3748" },
});

/* ───── 프로그레스 바 ───── */
function ProgressBar({
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

/* ───── MAIN ───── */

export default function ChallengeScreen() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [showForm, setShowForm] = useState(false);

  /* 폼 상태 */
  const [fTargetWeight, setFTargetWeight] = useState("");
  const [fTargetMuscleMass, setFTargetMuscleMass] = useState("");
  const [fTargetBodyFatMass, setFTargetBodyFatMass] = useState("");
  const [fTargetBodyFatPercent, setFTargetBodyFatPercent] = useState("");
  const [fEndDate, setFEndDate] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadChallenge().then(setChallenge);
      loadRecords().then((data) =>
        setRecords([...data].sort((a, b) => a.date.localeCompare(b.date)))
      );
    }, [])
  );

  /* 시작 시점 수치 (챌린지 시작일 근처 기록) */
  const startValues = useMemo(() => {
    if (!challenge) return null;
    const rec = records.find((r) => r.date >= challenge.startDate);
    if (!rec) return null;
    return {
      weight: rec.weight,
      muscleMass: rec.muscleMass,
      bodyFatMass: rec.bodyFatMass,
      bodyFatPercent: rec.bodyFatPercent,
    };
  }, [challenge, records]);

  /* 현재 수치 (가장 최근 기록) */
  const currentValues = useMemo(() => {
    if (records.length === 0) return null;
    const latest = records[records.length - 1];
    return {
      weight: latest.weight,
      muscleMass: latest.muscleMass,
      bodyFatMass: latest.bodyFatMass,
      bodyFatPercent: latest.bodyFatPercent,
    };
  }, [records]);

  const today = getLocalDateString();
  const daysLeft = challenge ? daysBetween(today, challenge.endDate) : 0;
  const totalDays = challenge
    ? daysBetween(challenge.startDate, challenge.endDate)
    : 1;
  const daysPassed = challenge ? daysBetween(challenge.startDate, today) : 0;
  const timeProgress =
    totalDays > 0 ? Math.min(100, (daysPassed / totalDays) * 100) : 0;

  /* 폼 초기화 */
  const openForm = (existing?: Challenge) => {
    if (existing) {
      setFTargetWeight(existing.targetWeight?.toString() ?? "");
      setFTargetMuscleMass(existing.targetMuscleMass?.toString() ?? "");
      setFTargetBodyFatMass(existing.targetBodyFatMass?.toString() ?? "");
      setFTargetBodyFatPercent(existing.targetBodyFatPercent?.toString() ?? "");
      setFEndDate(existing.endDate);
    } else {
      setFTargetWeight("");
      setFTargetMuscleMass("");
      setFTargetBodyFatMass("");
      setFTargetBodyFatPercent("");
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      setFEndDate(getLocalDateString(d));
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!fEndDate || fEndDate <= today) {
      Alert.alert("입력 오류", "종료일은 오늘 이후여야 합니다.");
      return;
    }
    const hasTarget =
      fTargetWeight ||
      fTargetMuscleMass ||
      fTargetBodyFatMass ||
      fTargetBodyFatPercent;
    if (!hasTarget) {
      Alert.alert("입력 오류", "최소 하나의 목표 수치를 입력해주세요.");
      return;
    }

    const latestRecord =
      records.length > 0 ? records[records.length - 1] : null;

    const newChallenge: Challenge = {
      id: challenge?.id ?? Date.now().toString(),
      startDate: challenge?.startDate ?? today,
      endDate: fEndDate,
      createdAt: challenge?.createdAt ?? new Date().toISOString(),
      startWeight: challenge?.startWeight ?? latestRecord?.weight,
      startMuscleMass: challenge?.startMuscleMass ?? latestRecord?.muscleMass,
      startBodyFatMass:
        challenge?.startBodyFatMass ?? latestRecord?.bodyFatMass,
      startBodyFatPercent:
        challenge?.startBodyFatPercent ?? latestRecord?.bodyFatPercent,
      targetWeight: fTargetWeight ? parseFloat(fTargetWeight) : undefined,
      targetMuscleMass: fTargetMuscleMass
        ? parseFloat(fTargetMuscleMass)
        : undefined,
      targetBodyFatMass: fTargetBodyFatMass
        ? parseFloat(fTargetBodyFatMass)
        : undefined,
      targetBodyFatPercent: fTargetBodyFatPercent
        ? parseFloat(fTargetBodyFatPercent)
        : undefined,
    };

    await saveChallenge(newChallenge);
    setChallenge(newChallenge);
    setShowForm(false);
    Alert.alert("저장 완료 ✅", "챌린지가 설정되었습니다!");
  };

  const handleDeleteChallenge = () => {
    Alert.alert("챌린지 삭제", "현재 챌린지를 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await deleteChallenge();
          setChallenge(null);
        },
      },
    ]);
  };

  /* 전체 달성도 평균 */
  const overallProgress = useMemo(() => {
    if (!challenge || !startValues || !currentValues) return null;
    const items: number[] = [];
    if (challenge.targetWeight != null && startValues.weight != null) {
      const total = challenge.targetWeight - startValues.weight;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.weight - startValues.weight) / total) * 100
            )
          )
        );
      }
    }
    if (
      challenge.targetMuscleMass != null &&
      startValues.muscleMass != null &&
      currentValues.muscleMass != null
    ) {
      const total = challenge.targetMuscleMass - startValues.muscleMass;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.muscleMass - startValues.muscleMass) / total) *
                100
            )
          )
        );
      }
    }
    if (
      challenge.targetBodyFatMass != null &&
      startValues.bodyFatMass != null &&
      currentValues.bodyFatMass != null
    ) {
      const total = challenge.targetBodyFatMass - startValues.bodyFatMass;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.bodyFatMass - startValues.bodyFatMass) / total) *
                100
            )
          )
        );
      }
    }
    if (
      challenge.targetBodyFatPercent != null &&
      startValues.bodyFatPercent != null &&
      currentValues.bodyFatPercent != null
    ) {
      const total = challenge.targetBodyFatPercent - startValues.bodyFatPercent;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.bodyFatPercent - startValues.bodyFatPercent) /
                total) *
                100
            )
          )
        );
      }
    }
    if (items.length === 0) return null;
    return Math.round(items.reduce((a, b) => a + b, 0) / items.length);
  }, [challenge, startValues, currentValues]);

  return (
    <SwipeableTab currentIndex={3}>
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        <Text style={st.title}>
          {"\u{1F3C6}"} {"\uCC4C\uB9B0\uC9C0"}
        </Text>

        {!challenge && (
          <View style={st.emptyCard}>
            <Text style={st.emptyIcon}>🎯</Text>
            <Text style={st.emptyTitle}>아직 챌린지가 없습니다</Text>
            <Text style={st.emptyDesc}>
              목표 몸무게, 골격근량, 체지방 등을 설정하고{"\n"}달성도를
              추적해보세요!
            </Text>
            <TouchableOpacity style={st.createBtn} onPress={() => openForm()}>
              <Text style={st.createBtnText}>챌린지 만들기</Text>
            </TouchableOpacity>
          </View>
        )}

        {challenge && (
          <>
            {/* 기간 & 전체 달성도 */}
            <View style={st.card}>
              <View style={st.cardHeader}>
                <Text style={st.cardTitle}>📊 진행 현황</Text>
                <View style={st.headerActions}>
                  <TouchableOpacity onPress={() => openForm(challenge)}>
                    <Text style={st.editLink}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDeleteChallenge}>
                    <Text style={st.deleteLink}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={st.periodRow}>
                <Text style={st.periodText}>
                  {fmtDate(challenge.startDate)} → {fmtDate(challenge.endDate)}
                </Text>
              </View>

              <View style={st.daysRow}>
                <View style={st.dayItem}>
                  <Text style={st.dayNum}>{daysPassed}</Text>
                  <Text style={st.dayLabel}>경과일</Text>
                </View>
                <View style={st.dayItem}>
                  <Text
                    style={[
                      st.dayNum,
                      daysLeft <= 0 ? { color: "#E53E3E" } : null,
                    ]}
                  >
                    {Math.max(0, daysLeft)}
                  </Text>
                  <Text style={st.dayLabel}>남은 일</Text>
                </View>
                <View style={st.dayItem}>
                  <Text style={st.dayNum}>{Math.round(timeProgress)}%</Text>
                  <Text style={st.dayLabel}>기간 진행</Text>
                </View>
              </View>

              {overallProgress !== null && (
                <View style={st.overallCard}>
                  <Text style={st.overallLabel}>전체 달성도</Text>
                  <Text
                    style={[
                      st.overallPercent,
                      overallProgress >= 100 && { color: "#38A169" },
                    ]}
                  >
                    {overallProgress}%
                  </Text>
                  <View style={st.overallTrack}>
                    <View
                      style={[
                        st.overallFill,
                        {
                          width: `${Math.min(100, overallProgress)}%`,
                          backgroundColor:
                            overallProgress >= 100 ? "#38A169" : "#4CAF50",
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* 개별 수치 프로그레스 */}
            <View style={st.card}>
              <Text style={st.cardTitle}>📈 수치별 진행도</Text>

              <ProgressBar
                label="⚖️ 몸무게"
                start={challenge.startWeight ?? startValues?.weight}
                current={currentValues?.weight}
                target={challenge.targetWeight}
                unit="kg"
                color={METRIC_COLORS.weight}
              />
              <ProgressBar
                label="💪 골격근량"
                start={challenge.startMuscleMass ?? startValues?.muscleMass}
                current={currentValues?.muscleMass}
                target={challenge.targetMuscleMass}
                unit="kg"
                color={METRIC_COLORS.muscleMass}
              />
              <ProgressBar
                label="🟣 체지방량"
                start={challenge.startBodyFatMass ?? startValues?.bodyFatMass}
                current={currentValues?.bodyFatMass}
                target={challenge.targetBodyFatMass}
                unit="kg"
                color={METRIC_COLORS.bodyFatMass}
              />
              <ProgressBar
                label="🔥 체지방률"
                start={
                  challenge.startBodyFatPercent ?? startValues?.bodyFatPercent
                }
                current={currentValues?.bodyFatPercent}
                target={challenge.targetBodyFatPercent}
                unit="%"
                color={METRIC_COLORS.bodyFatPercent}
              />

              {!challenge.targetWeight &&
                !challenge.targetMuscleMass &&
                !challenge.targetBodyFatMass &&
                !challenge.targetBodyFatPercent && (
                  <Text style={st.noTarget}>
                    설정된 목표가 없습니다. 수정 버튼을 눌러 목표를 추가하세요.
                  </Text>
                )}
            </View>
          </>
        )}

        {/* 챌린지 생성/수정 모달 */}
        <Modal
          visible={showForm}
          transparent
          animationType="slide"
          onRequestClose={() => setShowForm(false)}
        >
          <View style={st.formOverlay}>
            <View style={st.formCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={st.formTitle}>
                  {challenge ? "챌린지 수정" : "새 챌린지"}
                </Text>

                <Text style={st.formLabel}>목표 몸무게 (kg)</Text>
                <TextInput
                  style={st.formInput}
                  value={fTargetWeight}
                  onChangeText={setFTargetWeight}
                  keyboardType="decimal-pad"
                  placeholder="예: 70.0"
                  placeholderTextColor="#aaa"
                />

                <Text style={st.formLabel}>목표 골격근량 (kg)</Text>
                <TextInput
                  style={st.formInput}
                  value={fTargetMuscleMass}
                  onChangeText={setFTargetMuscleMass}
                  keyboardType="decimal-pad"
                  placeholder="예: 35.0"
                  placeholderTextColor="#aaa"
                />

                <Text style={st.formLabel}>목표 체지방량 (kg)</Text>
                <TextInput
                  style={st.formInput}
                  value={fTargetBodyFatMass}
                  onChangeText={setFTargetBodyFatMass}
                  keyboardType="decimal-pad"
                  placeholder="예: 12.0"
                  placeholderTextColor="#aaa"
                />

                <Text style={st.formLabel}>목표 체지방률 (%)</Text>
                <TextInput
                  style={st.formInput}
                  value={fTargetBodyFatPercent}
                  onChangeText={setFTargetBodyFatPercent}
                  keyboardType="decimal-pad"
                  placeholder="예: 15.0"
                  placeholderTextColor="#aaa"
                />

                <DateCalendarPicker
                  label={"\ubaa9\ud45c \uc885\ub8cc\uc77c"}
                  value={fEndDate}
                  onChange={setFEndDate}
                />

                <View style={st.formBtnRow}>
                  <TouchableOpacity style={st.formSaveBtn} onPress={handleSave}>
                    <Text style={st.formSaveBtnText}>저장</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.formCancelBtn}
                    onPress={() => setShowForm(false)}
                  >
                    <Text style={st.formCancelBtnText}>취소</Text>
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

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 20,
  },

  /* empty state */
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#A0AEC0",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  createBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

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
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 12,
  },
  headerActions: { flexDirection: "row", gap: 16 },
  editLink: { fontSize: 13, color: "#3182CE", fontWeight: "600" },
  deleteLink: { fontSize: 13, color: "#E53E3E", fontWeight: "600" },

  /* period */
  periodRow: { marginBottom: 12 },
  periodText: { fontSize: 13, color: "#718096", textAlign: "center" },

  /* days */
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  dayItem: { alignItems: "center" },
  dayNum: { fontSize: 22, fontWeight: "700", color: "#2D3748" },
  dayLabel: { fontSize: 12, color: "#A0AEC0", marginTop: 2 },

  /* overall */
  overallCard: {
    backgroundColor: "#F7FAFC",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  overallLabel: { fontSize: 13, color: "#718096", marginBottom: 6 },
  overallPercent: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 8,
  },
  overallTrack: {
    width: "100%",
    height: 12,
    backgroundColor: "#EDF2F7",
    borderRadius: 6,
    overflow: "hidden",
  },
  overallFill: { height: "100%", borderRadius: 6 },

  noTarget: {
    textAlign: "center",
    color: "#A0AEC0",
    fontSize: 13,
    marginVertical: 10,
  },

  /* form modal */
  formOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  formCard: {
    width: width * 0.9,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 20,
    textAlign: "center",
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 4,
    marginTop: 12,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  formBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },
  formSaveBtn: {
    flex: 1,
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  formSaveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  formCancelBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  formCancelBtnText: {
    color: "#718096",
    fontSize: 16,
    fontWeight: "600",
  },
});
