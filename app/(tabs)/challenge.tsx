import { ProgressBar } from "@/components/progress-bar";
import { useKeyboardOffset } from "@/hooks/use-keyboard-offset";
import {
  Challenge,
  ChallengeHistory,
  METRIC_COLORS,
  WeightRecord,
} from "@/types";
import {
  calcDailyNutrition,
  daysBetween,
  fmtDate,
  getDaysInMonth,
  getFirstDayOfWeek,
  pad2,
} from "@/utils/format";
import {
  addChallengeToHistory,
  deleteChallenge,
  getLocalDateString,
  loadChallenge,
  loadChallengeHistory,
  loadRecords,
  loadUserSettings,
  saveChallenge,
  saveChallengeHistory,
  saveUserSettings,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
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

/* ───── 스텝 버튼 입력 (±0.1, 꾹 누르면 반복) ───── */
function StepInput({
  value,
  onChangeText,
  placeholder,
  step = 0.1,
  editable = true,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  step?: number;
  editable?: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const valRef = useRef(value);
  valRef.current = value;

  const adjust = useCallback(
    (dir: 1 | -1) => {
      const cur = parseFloat(valRef.current) || 0;
      const next = Math.max(0, +(cur + dir * step).toFixed(1));
      const nv = next.toFixed(1);
      valRef.current = nv;
      onChangeText(nv);
    },
    [onChangeText, step]
  );

  const startRepeat = useCallback(
    (dir: 1 | -1) => {
      adjust(dir);
      timerRef.current = setInterval(() => adjust(dir), 120);
    },
    [adjust]
  );

  const stopRepeat = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return (
    <View style={stepStyles.row}>
      <TouchableOpacity
        style={stepStyles.btn}
        onPressIn={() => startRepeat(-1)}
        onPressOut={stopRepeat}
        disabled={!editable}
      >
        <Text style={stepStyles.btnText}>▼</Text>
      </TouchableOpacity>
      <TextInput
        style={[stepStyles.input, !editable && stepStyles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        editable={editable}
      />
      <TouchableOpacity
        style={stepStyles.btn}
        onPressIn={() => startRepeat(1)}
        onPressOut={stopRepeat}
        disabled={!editable}
      >
        <Text style={stepStyles.btnText}>▲</Text>
      </TouchableOpacity>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  btn: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EDF2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4A5568",
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#2D3748",
    marginHorizontal: 8,
    textAlign: "center",
  },
  inputDisabled: {
    backgroundColor: "#F7FAFC",
    color: "#A0AEC0",
  },
});

/* ───── 날짜 캘린더 픽커 ───── */
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
  const kbOffset = useKeyboardOffset();
  const [textDate, setTextDate] = useState(value);
  const [pickerMode, setPickerMode] = useState<"calendar" | "year" | "month">(
    "calendar"
  );
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
    setTextDate(value);
    setPickerMode("calendar");
    setShowCal(true);
  };

  const WKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
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

  const handleTextConfirm = () => {
    const v = textDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      if (
        dt.getFullYear() === y &&
        dt.getMonth() === m - 1 &&
        dt.getDate() === d
      ) {
        onChange(v);
        setShowCal(false);
        return;
      }
    }
    Alert.alert("형식 오류", "YYYY-MM-DD 형식으로 입력해주세요.");
  };

  const CURRENT_YEAR = now.getFullYear();

  return (
    <>
      <Text style={st.formLabel}>{label}</Text>
      <View style={dcpS.inputWrap}>
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
        <TouchableOpacity style={dcpS.calBtn} onPress={openCal}>
          <Text style={dcpS.icon}>📅</Text>
        </TouchableOpacity>
      </View>

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
          <View
            style={[dcpS.card, { transform: [{ translateY: kbOffset }] }]}
            onStartShouldSetResponder={() => true}
          >
            {/* 텍스트 입력 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  height: 38,
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  fontSize: 14,
                  color: "#2D3748",
                  backgroundColor: "#F7FAFC",
                }}
                value={textDate}
                onChangeText={setTextDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#aaa"
                keyboardType={
                  Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
                }
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleTextConfirm}
              />
              <TouchableOpacity
                style={{
                  marginLeft: 8,
                  backgroundColor: "#4CAF50",
                  borderRadius: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
                onPress={handleTextConfirm}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}
                >
                  확인
                </Text>
              </TouchableOpacity>
            </View>

            <View style={dcpS.navRow}>
              <TouchableOpacity onPress={prevM} style={dcpS.navBtn}>
                <Text style={dcpS.navBtnText}>◀</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() =>
                    setPickerMode((m) => (m === "year" ? "calendar" : "year"))
                  }
                >
                  <Text style={dcpS.navTitle}>{cYear}년</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setPickerMode((m) => (m === "month" ? "calendar" : "month"))
                  }
                >
                  <Text style={[dcpS.navTitle, { marginLeft: 4 }]}>
                    {cMonth + 1}월
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={nextM} style={dcpS.navBtn}>
                <Text style={dcpS.navBtnText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* 연도 선택 */}
            {pickerMode === "year" && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
              >
                <View
                  style={{ flexDirection: "row", gap: 6, paddingVertical: 6 }}
                >
                  {Array.from(
                    { length: 21 },
                    (_, i) => CURRENT_YEAR - 10 + i
                  ).map((y) => (
                    <TouchableOpacity
                      key={y}
                      onPress={() => {
                        setCYear(y);
                        setPickerMode("calendar");
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: y === cYear ? "#4CAF50" : "#EDF2F7",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: y === cYear ? "#fff" : "#4A5568",
                        }}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* 월 선택 */}
            {pickerMode === "month" && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 8,
                  justifyContent: "center",
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      setCMonth(m);
                      setPickerMode("calendar");
                    }}
                    style={{
                      width: 60,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: m === cMonth ? "#4CAF50" : "#EDF2F7",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: m === cMonth ? "#fff" : "#4A5568",
                      }}
                    >
                      {m + 1}월
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 달력 */}
            {pickerMode === "calendar" && (
              <>
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
                      const dateStr = `${cYear}-${pad2(cMonth + 1)}-${pad2(day)}`;
                      const isSelected = dateStr === value;
                      return (
                        <TouchableOpacity
                          key={di}
                          style={[
                            dcpS.dayCell,
                            isSelected && dcpS.dayCellSelected,
                          ]}
                          onPress={() => {
                            onChange(dateStr);
                            setShowCal(false);
                          }}
                        >
                          <Text
                            style={[
                              dcpS.dayText,
                              isSelected && { color: "#fff" },
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </>
            )}
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
  calBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
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

/* ───── MAIN ───── */

export default function ChallengeScreen() {
  const kbOffset = useKeyboardOffset();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState<ChallengeHistory[]>([]);

  /* 폼 상태 */
  const [fCurrentWeight, setFCurrentWeight] = useState("");
  const [fCurrentMuscleMass, setFCurrentMuscleMass] = useState("");
  const [fCurrentBodyFatMass, setFCurrentBodyFatMass] = useState("");
  const [fTargetWeight, setFTargetWeight] = useState("");
  const [fTargetMuscleMass, setFTargetMuscleMass] = useState("");
  const [fTargetBodyFatMass, setFTargetBodyFatMass] = useState("");
  const [fTargetBodyFatPercent, setFTargetBodyFatPercent] = useState("");
  const [fEndDate, setFEndDate] = useState("");
  const [enableMuscleMass, setEnableMuscleMass] = useState(false);
  const [enableBodyFatMass, setEnableBodyFatMass] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadChallenge().then(setChallenge);
      loadRecords().then((data) =>
        setRecords([...data].sort((a, b) => a.date.localeCompare(b.date)))
      );
      loadChallengeHistory().then(setHistory);
    }, [])
  );

  /* 시작 시점 수치 (챌린지에 저장된 start값 우선, 없으면 시작일 근처 기록) */
  const startValues = useMemo(() => {
    if (!challenge) return null;
    const saved = {
      weight: challenge.startWeight,
      muscleMass: challenge.startMuscleMass,
      bodyFatMass: challenge.startBodyFatMass,
      bodyFatPercent: challenge.startBodyFatPercent,
    };
    // 저장된 값이 하나라도 있으면 그대로 사용
    if (
      saved.weight != null ||
      saved.muscleMass != null ||
      saved.bodyFatMass != null
    )
      return saved;
    // fallback: 시작일 근처 기록
    const rec = records.find((r) => r.date >= challenge.startDate);
    if (!rec) return null;
    return {
      weight: rec.weight,
      muscleMass: rec.muscleMass,
      bodyFatMass: rec.bodyFatMass,
      bodyFatPercent: rec.bodyFatPercent,
    };
  }, [challenge, records]);

  /* 현재 수치 (각 수치의 가장 최근 유효값) */
  const currentValues = useMemo(() => {
    if (records.length === 0) return null;
    let weight: number | undefined;
    let muscleMass: number | undefined;
    let bodyFatMass: number | undefined;
    let bodyFatPercent: number | undefined;
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (weight == null && r.weight) weight = r.weight;
      if (muscleMass == null && r.muscleMass != null) muscleMass = r.muscleMass;
      if (bodyFatMass == null && r.bodyFatMass != null)
        bodyFatMass = r.bodyFatMass;
      if (bodyFatPercent == null && r.bodyFatPercent != null)
        bodyFatPercent = r.bodyFatPercent;
      if (
        weight != null &&
        muscleMass != null &&
        bodyFatMass != null &&
        bodyFatPercent != null
      )
        break;
    }
    return { weight: weight!, muscleMass, bodyFatMass, bodyFatPercent };
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
    // 최근 기록에서 각 수치의 가장 최근 유효값을 가져옴
    let prefillWeight = "";
    let prefillMuscle = "";
    let prefillFatMass = "";
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (!prefillWeight && r.weight) prefillWeight = r.weight.toFixed(1);
      if (!prefillMuscle && r.muscleMass)
        prefillMuscle = r.muscleMass.toFixed(1);
      if (!prefillFatMass && r.bodyFatMass)
        prefillFatMass = r.bodyFatMass.toFixed(1);
      if (prefillWeight && prefillMuscle && prefillFatMass) break;
    }

    if (existing) {
      // 현재값: 저장된 start값이 있으면 사용, 없으면 최근 기록값
      setFCurrentWeight(existing.startWeight?.toString() ?? prefillWeight);
      setFCurrentMuscleMass(
        existing.startMuscleMass?.toString() ?? prefillMuscle
      );
      setFCurrentBodyFatMass(
        existing.startBodyFatMass?.toString() ?? prefillFatMass
      );
      setFTargetWeight(
        existing.targetWeight?.toString() ??
          existing.startWeight?.toString() ??
          prefillWeight
      );
      setFTargetMuscleMass(
        existing.targetMuscleMass?.toString() ??
          existing.startMuscleMass?.toString() ??
          prefillMuscle
      );
      setFTargetBodyFatMass(
        existing.targetBodyFatMass?.toString() ??
          existing.startBodyFatMass?.toString() ??
          prefillFatMass
      );
      setFTargetBodyFatPercent(
        (() => {
          if (existing.targetBodyFatPercent != null)
            return existing.targetBodyFatPercent.toString();
          // 목표 체지방량과 목표 몸무게로 자동 계산
          const tw = parseFloat(
            existing.targetWeight?.toString() ??
              existing.startWeight?.toString() ??
              prefillWeight
          );
          const fm = parseFloat(
            existing.targetBodyFatMass?.toString() ??
              existing.startBodyFatMass?.toString() ??
              prefillFatMass
          );
          if (!isNaN(tw) && tw > 0 && !isNaN(fm) && fm >= 0)
            return ((fm / tw) * 100).toFixed(1);
          return "";
        })()
      );
      setFEndDate(existing.endDate);
      // 골격근량/체지방량 토글: 값이 있으면 활성화
      setEnableMuscleMass(
        existing.targetMuscleMass != null || existing.startMuscleMass != null
      );
      setEnableBodyFatMass(
        existing.targetBodyFatMass != null || existing.startBodyFatMass != null
      );
    } else {
      // 현재값: 최근 기록값으로 프리필
      setFCurrentWeight(prefillWeight);
      setFCurrentMuscleMass(prefillMuscle);
      setFCurrentBodyFatMass(prefillFatMass);
      // 목표값: 최근 기록값으로 프리필
      setFTargetWeight(prefillWeight);
      setFTargetMuscleMass(prefillMuscle);
      setFTargetBodyFatMass(prefillFatMass);
      // 초기에는 비활성
      setEnableMuscleMass(false);
      setEnableBodyFatMass(false);
      // 체지방률 자동 계산
      const tw = parseFloat(prefillWeight);
      const fm = parseFloat(prefillFatMass);
      if (!isNaN(tw) && tw > 0 && !isNaN(fm) && fm >= 0) {
        setFTargetBodyFatPercent(((fm / tw) * 100).toFixed(1));
      } else {
        setFTargetBodyFatPercent("");
      }
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

    const newChallenge: Challenge = {
      id: challenge?.id ?? Date.now().toString(),
      startDate: challenge?.startDate ?? today,
      endDate: fEndDate,
      createdAt: challenge?.createdAt ?? new Date().toISOString(),
      startWeight: fCurrentWeight ? parseFloat(fCurrentWeight) : undefined,
      startMuscleMass:
        enableMuscleMass && fCurrentMuscleMass
          ? parseFloat(fCurrentMuscleMass)
          : undefined,
      startBodyFatMass:
        enableBodyFatMass && fCurrentBodyFatMass
          ? parseFloat(fCurrentBodyFatMass)
          : undefined,
      startBodyFatPercent: (() => {
        if (!enableBodyFatMass) return undefined;
        const cw = parseFloat(fCurrentWeight);
        const cfm = parseFloat(fCurrentBodyFatMass);
        if (!isNaN(cw) && cw > 0 && !isNaN(cfm) && cfm >= 0)
          return parseFloat(((cfm / cw) * 100).toFixed(1));
        return challenge?.startBodyFatPercent;
      })(),
      targetWeight: fTargetWeight ? parseFloat(fTargetWeight) : undefined,
      targetMuscleMass:
        enableMuscleMass && fTargetMuscleMass
          ? parseFloat(fTargetMuscleMass)
          : undefined,
      targetBodyFatMass:
        enableBodyFatMass && fTargetBodyFatMass
          ? parseFloat(fTargetBodyFatMass)
          : undefined,
      targetBodyFatPercent:
        enableBodyFatMass && fTargetBodyFatPercent
          ? parseFloat(fTargetBodyFatPercent)
          : undefined,
    };

    await saveChallenge(newChallenge);
    setChallenge(newChallenge);
    setShowForm(false);
  };

  const handleDeleteChallenge = () => {
    Alert.alert("챌린지 삭제", "현재 챌린지를 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          // Save to history before deleting
          if (challenge) {
            // 각 수치별 가장 최근 유효값 찾기
            let endWeight: number | undefined;
            let endMuscleMass: number | undefined;
            let endBodyFatMass: number | undefined;
            let endBodyFatPercent: number | undefined;
            for (let i = records.length - 1; i >= 0; i--) {
              const r = records[i];
              if (endWeight == null && r.weight) endWeight = r.weight;
              if (endMuscleMass == null && r.muscleMass != null)
                endMuscleMass = r.muscleMass;
              if (endBodyFatMass == null && r.bodyFatMass != null)
                endBodyFatMass = r.bodyFatMass;
              if (endBodyFatPercent == null && r.bodyFatPercent != null)
                endBodyFatPercent = r.bodyFatPercent;
              if (
                endWeight != null &&
                endMuscleMass != null &&
                endBodyFatMass != null &&
                endBodyFatPercent != null
              )
                break;
            }
            const historyEntry: ChallengeHistory = {
              id: challenge.id,
              challenge: { ...challenge },
              endWeight,
              endMuscleMass,
              endBodyFatMass,
              endBodyFatPercent,
              overallProgress: overallProgress,
              completedAt: new Date().toISOString(),
            };
            const updatedHistory = await addChallengeToHistory(historyEntry);
            setHistory(updatedHistory);
          }
          await deleteChallenge();
          setChallenge(null);
        },
      },
    ]);
  };

  /* 전체 달성도 평균 */
  const overallProgress = useMemo(() => {
    if (!challenge || !currentValues) return null;
    const items: number[] = [];

    const effStartWeight = challenge.startWeight ?? startValues?.weight;
    if (
      challenge.targetWeight != null &&
      effStartWeight != null &&
      currentValues.weight != null
    ) {
      const total = challenge.targetWeight - effStartWeight;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.weight - effStartWeight) / total) * 100
            )
          )
        );
      }
    }

    const effStartMuscle = challenge.startMuscleMass ?? startValues?.muscleMass;
    if (
      challenge.targetMuscleMass != null &&
      effStartMuscle != null &&
      currentValues.muscleMass != null
    ) {
      const total = challenge.targetMuscleMass - effStartMuscle;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.muscleMass - effStartMuscle) / total) * 100
            )
          )
        );
      }
    }

    const effStartBodyFatMass =
      challenge.startBodyFatMass ?? startValues?.bodyFatMass;
    if (
      challenge.targetBodyFatMass != null &&
      effStartBodyFatMass != null &&
      currentValues.bodyFatMass != null
    ) {
      const total = challenge.targetBodyFatMass - effStartBodyFatMass;
      if (total !== 0) {
        items.push(
          Math.max(
            0,
            Math.min(
              100,
              ((currentValues.bodyFatMass - effStartBodyFatMass) / total) * 100
            )
          )
        );
      }
    }

    if (items.length === 0) return null;
    return Math.round(items.reduce((a, b) => a + b, 0) / items.length);
  }, [challenge, startValues, currentValues]);

  // 챌린지 탭 상단: 하루 권장량 박스
  const [userSettings, setUserSettings] = useState<any>(null);
  const [exFreq, setExFreq] = useState(0);
  const [exMins, setExMins] = useState(60);
  const [exIntensity, setExIntensity] = useState(1);

  const FREQ_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7];
  const DURATION_OPTIONS = [
    { value: 30, label: "30분" },
    { value: 60, label: "1시간" },
    { value: 90, label: "1.5시간" },
    { value: 120, label: "2시간" },
    { value: 150, label: "2.5시간" },
    { value: 180, label: "3시간" },
    { value: 210, label: "3.5시간" },
    { value: 240, label: "4시간" },
  ];
  const INTENSITY_OPTIONS = [
    { value: 1, label: "가벼움", desc: "가벼운 유산소·요가" },
    { value: 2, label: "보통", desc: "근력+유산소 혼합" },
    { value: 3, label: "고강도", desc: "고중량·인터벌·HIIT" },
  ];

  useFocusEffect(
    useCallback(() => {
      loadUserSettings().then((s) => {
        setUserSettings(s);
        setExFreq(s.exerciseFreq ?? 0);
        setExMins(s.exerciseMins ?? 60);
        setExIntensity(s.exerciseIntensity ?? 1);
      });
    }, [])
  );

  const saveExercise = async (f: number, m: number, i: number) => {
    const cur = await loadUserSettings();
    await saveUserSettings({
      ...cur,
      exerciseFreq: f,
      exerciseMins: m,
      exerciseIntensity: i,
    });
  };

  const dailyNutrition = useMemo(() => {
    if (!userSettings) return null;
    const { gender, birthDate, height } = userSettings;
    if (!gender || !birthDate || !height) return null;
    const w = currentValues?.weight;
    if (!w) return null;

    // 챌린지가 있고 targetWeight이 설정된 경우
    if (challenge && challenge.targetWeight) {
      const today = getLocalDateString();
      const daysLeft = daysBetween(today, challenge.endDate);
      return calcDailyNutrition({
        weight: w,
        targetWeight: challenge.targetWeight,
        height,
        gender,
        birthDate,
        periodDays: daysLeft > 0 ? daysLeft : 1,
        exerciseFreq: exFreq,
        exerciseMins: exMins,
        exerciseIntensity: exIntensity,
        muscleMass: currentValues?.muscleMass,
        bodyFatPercent: currentValues?.bodyFatPercent,
        bodyFatMass: currentValues?.bodyFatMass,
        targetMuscleMass: challenge.targetMuscleMass,
        targetBodyFatPercent: challenge.targetBodyFatPercent,
        targetBodyFatMass: challenge.targetBodyFatMass,
      });
    }

    // 챌린지가 없거나 targetWeight이 없으면 유지 칼로리
    return calcDailyNutrition({
      weight: w,
      targetWeight: w,
      height,
      gender,
      birthDate,
      periodDays: 30,
      exerciseFreq: exFreq,
      exerciseMins: exMins,
      exerciseIntensity: exIntensity,
      muscleMass: currentValues?.muscleMass,
      bodyFatPercent: currentValues?.bodyFatPercent,
      bodyFatMass: currentValues?.bodyFatMass,
      targetMuscleMass: challenge?.targetMuscleMass,
      targetBodyFatPercent: challenge?.targetBodyFatPercent,
      targetBodyFatMass: challenge?.targetBodyFatMass,
    });
  }, [challenge, userSettings, currentValues, exFreq, exMins, exIntensity]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={st.content}>
        {!challenge && (
          <View style={st.emptyCard}>
            <Text style={st.emptyIcon}></Text>
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
                <Text style={st.cardTitle}>진행 현황</Text>
                <View style={st.headerActions}>
                  <TouchableOpacity
                    style={st.editLinkBtn}
                    onPress={() => openForm(challenge)}
                  >
                    <Text style={st.editLinkText}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.deleteLinkBtn}
                    onPress={handleDeleteChallenge}
                  >
                    <Text style={st.deleteLinkText}>삭제</Text>
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
              <Text style={st.cardTitle}>수치별 진행도</Text>

              <ProgressBar
                label="몸무게"
                start={challenge.startWeight ?? startValues?.weight}
                current={currentValues?.weight}
                target={challenge.targetWeight}
                unit="kg"
                color={METRIC_COLORS.weight}
              />
              <ProgressBar
                label="골격근량"
                start={challenge.startMuscleMass ?? startValues?.muscleMass}
                current={currentValues?.muscleMass}
                target={challenge.targetMuscleMass}
                unit="kg"
                color={METRIC_COLORS.muscleMass}
              />
              {(() => {
                const sW = challenge.startWeight ?? startValues?.weight;
                const sFM =
                  challenge.startBodyFatMass ?? startValues?.bodyFatMass;
                const cW = currentValues?.weight;
                const cFM = currentValues?.bodyFatMass;
                const tW = challenge.targetWeight;
                const tFM = challenge.targetBodyFatMass;
                return (
                  <ProgressBar
                    label="체지방량"
                    start={
                      challenge.startBodyFatMass ?? startValues?.bodyFatMass
                    }
                    current={currentValues?.bodyFatMass}
                    target={challenge.targetBodyFatMass}
                    unit="kg"
                    color={METRIC_COLORS.bodyFatMass}
                    pctStart={
                      sW && sFM ? ((sFM / sW) * 100).toFixed(1) : undefined
                    }
                    pctCurrent={
                      cW && cFM ? ((cFM / cW) * 100).toFixed(1) : undefined
                    }
                    pctTarget={
                      tW && tFM ? ((tFM / tW) * 100).toFixed(1) : undefined
                    }
                  />
                );
              })()}

              {!challenge.targetWeight &&
                !challenge.targetMuscleMass &&
                !challenge.targetBodyFatMass && (
                  <Text style={st.noTarget}>
                    설정된 목표가 없습니다. 수정 버튼을 눌러 목표를 추가하세요.
                  </Text>
                )}
            </View>
          </>
        )}

        {/* 하루 권장 영양소 */}
        {dailyNutrition ? (
          <View style={[st.card, { marginTop: 16 }]}>
            <Text style={st.cardTitle}>
              하루 권장 영양소
              {challenge?.targetWeight ? " (챌린지)" : " (유지)"}
            </Text>

            {/* 운동 빈도 */}
            <Text style={st.exSectionLabel}>주당 운동 일수</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={st.exScrollRow}
            >
              <View style={st.exFreqRow}>
                {FREQ_OPTIONS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[st.exChip, exFreq === f && st.exChipActive]}
                    onPress={() => {
                      setExFreq(f);
                      saveExercise(f, exMins, exIntensity);
                    }}
                  >
                    <Text
                      style={[
                        st.exChipText,
                        exFreq === f && st.exChipTextActive,
                      ]}
                    >
                      {f === 0 ? "안 함" : `${f}일`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* 운동 시간 */}
            {exFreq > 0 && (
              <>
                <Text style={st.exSectionLabel}>1일 운동 시간</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={st.exScrollRow}
                >
                  <View style={st.exFreqRow}>
                    {DURATION_OPTIONS.map((d) => (
                      <TouchableOpacity
                        key={d.value}
                        style={[
                          st.exChip,
                          exMins === d.value && st.exChipActive,
                        ]}
                        onPress={() => {
                          setExMins(d.value);
                          saveExercise(exFreq, d.value, exIntensity);
                        }}
                      >
                        <Text
                          style={[
                            st.exChipText,
                            exMins === d.value && st.exChipTextActive,
                          ]}
                        >
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* 운동 강도 */}
                <Text style={st.exSectionLabel}>운동 강도</Text>
                <View style={st.activityRow}>
                  {INTENSITY_OPTIONS.map((iv) => (
                    <TouchableOpacity
                      key={iv.value}
                      style={[
                        st.activityBtn,
                        exIntensity === iv.value && st.activityBtnActive,
                      ]}
                      onPress={() => {
                        setExIntensity(iv.value);
                        saveExercise(exFreq, exMins, iv.value);
                      }}
                    >
                      <Text
                        style={[
                          st.activityBtnLabel,
                          exIntensity === iv.value && st.activityBtnLabelActive,
                        ]}
                      >
                        {iv.label}
                      </Text>
                      <Text
                        style={[
                          st.activityBtnDesc,
                          exIntensity === iv.value && st.activityBtnDescActive,
                        ]}
                      >
                        {iv.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={st.nutriKcalRow}>
              <Text style={st.nutriKcalNum}>{dailyNutrition.kcal}</Text>
              <Text style={st.nutriKcalUnit}>kcal</Text>
            </View>
            <View style={st.nutriRow}>
              <View style={st.nutriItem}>
                <View style={[st.nutriDot, { backgroundColor: "#F6AD55" }]} />
                <Text style={st.nutriLabel}>탄수화물</Text>
                <Text style={st.nutriValue}>{dailyNutrition.carb}g</Text>
              </View>
              <View style={st.nutriItem}>
                <View style={[st.nutriDot, { backgroundColor: "#FC8181" }]} />
                <Text style={st.nutriLabel}>단백질</Text>
                <Text style={st.nutriValue}>{dailyNutrition.protein}g</Text>
              </View>
              <View style={st.nutriItem}>
                <View style={[st.nutriDot, { backgroundColor: "#63B3ED" }]} />
                <Text style={st.nutriLabel}>지방</Text>
                <Text style={st.nutriValue}>{dailyNutrition.fat}g</Text>
              </View>
            </View>
            <View style={st.nutriBarTrack}>
              <View
                style={[
                  st.nutriBarSeg,
                  {
                    flex: Math.max(1, dailyNutrition.carb * 4),
                    backgroundColor: "#F6AD55",
                    borderTopLeftRadius: 6,
                    borderBottomLeftRadius: 6,
                  },
                ]}
              />
              <View
                style={[
                  st.nutriBarSeg,
                  {
                    flex: Math.max(1, dailyNutrition.protein * 4),
                    backgroundColor: "#FC8181",
                  },
                ]}
              />
              <View
                style={[
                  st.nutriBarSeg,
                  {
                    flex: Math.max(1, dailyNutrition.fat * 9),
                    backgroundColor: "#63B3ED",
                    borderTopRightRadius: 6,
                    borderBottomRightRadius: 6,
                  },
                ]}
              />
            </View>
            <Text style={st.nutriHint}>
              {challenge?.targetWeight
                ? `남은 ${Math.max(0, daysLeft)}일 · 개인정보 기반 계산`
                : "현재 체중 유지 기준 · 개인정보 기반 계산"}
            </Text>
          </View>
        ) : (
          <View style={st.card}>
            <Text style={st.cardTitle}>하루 권장 영양소</Text>
            <Text style={st.nutriHint}>
              설정 탭에서 성별·키·생년월일을 입력하고{"\n"}몸무게를 기록하면
              권장 영양소를 계산해드립니다.
            </Text>
          </View>
        )}

        {/* 챌린지 생성/수정 모달 */}
        {showForm && (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setShowForm(false)}
          >
            <View style={st.formOverlay}>
              <View
                style={[st.formCard, { transform: [{ translateY: kbOffset }] }]}
              >
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={st.formTitle}>
                    {challenge ? "챌린지 수정" : "새 챌린지"}
                  </Text>

                  {/* ── 몸무게 ── */}
                  <Text style={st.formSectionTitle}>몸무게 (kg)</Text>
                  <View style={st.formDualRow}>
                    <View style={st.formDualCol}>
                      <Text style={st.formSubLabel}>현재</Text>
                      <StepInput
                        value={fCurrentWeight}
                        onChangeText={setFCurrentWeight}
                        placeholder="0.0"
                      />
                    </View>
                    <Text style={st.formArrow}>→</Text>
                    <View style={st.formDualCol}>
                      <Text style={st.formSubLabel}>목표</Text>
                      <StepInput
                        value={fTargetWeight}
                        onChangeText={(v) => {
                          setFTargetWeight(v);
                          const tw = parseFloat(v);
                          const fm = parseFloat(fTargetBodyFatMass);
                          if (!isNaN(tw) && tw > 0 && !isNaN(fm) && fm >= 0) {
                            setFTargetBodyFatPercent(
                              ((fm / tw) * 100).toFixed(1)
                            );
                          }
                        }}
                        placeholder="0.0"
                      />
                    </View>
                  </View>

                  {/* ── 골격근량 (선택) ── */}
                  <TouchableOpacity
                    style={st.formToggleRow}
                    onPress={() => setEnableMuscleMass(!enableMuscleMass)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        st.formCheckbox,
                        enableMuscleMass && st.formCheckboxActive,
                      ]}
                    >
                      {enableMuscleMass && (
                        <Text style={st.formCheckmark}>✓</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        st.formSectionTitle,
                        { marginTop: 0, marginBottom: 0 },
                      ]}
                    >
                      골격근량 (kg)
                    </Text>
                    <Text style={st.formOptional}>선택</Text>
                  </TouchableOpacity>
                  {enableMuscleMass && (
                    <View style={st.formDualRow}>
                      <View style={st.formDualCol}>
                        <Text style={st.formSubLabel}>현재</Text>
                        <StepInput
                          value={fCurrentMuscleMass}
                          onChangeText={setFCurrentMuscleMass}
                          placeholder="0.0"
                        />
                      </View>
                      <Text style={st.formArrow}>→</Text>
                      <View style={st.formDualCol}>
                        <Text style={st.formSubLabel}>목표</Text>
                        <StepInput
                          value={fTargetMuscleMass}
                          onChangeText={setFTargetMuscleMass}
                          placeholder="0.0"
                        />
                      </View>
                    </View>
                  )}

                  {/* ── 체지방량 (선택) ── */}
                  <TouchableOpacity
                    style={st.formToggleRow}
                    onPress={() => setEnableBodyFatMass(!enableBodyFatMass)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        st.formCheckbox,
                        enableBodyFatMass && st.formCheckboxActive,
                      ]}
                    >
                      {enableBodyFatMass && (
                        <Text style={st.formCheckmark}>✓</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        st.formSectionTitle,
                        { marginTop: 0, marginBottom: 0 },
                      ]}
                    >
                      체지방량 (kg)
                    </Text>
                    <Text style={st.formOptional}>선택</Text>
                  </TouchableOpacity>
                  {enableBodyFatMass && (
                    <>
                      <View style={st.formDualRow}>
                        <View style={st.formDualCol}>
                          <Text style={st.formSubLabel}>현재</Text>
                          <StepInput
                            value={fCurrentBodyFatMass}
                            onChangeText={setFCurrentBodyFatMass}
                            placeholder="0.0"
                          />
                        </View>
                        <Text style={st.formArrow}>→</Text>
                        <View style={st.formDualCol}>
                          <Text style={st.formSubLabel}>목표</Text>
                          <StepInput
                            value={fTargetBodyFatMass}
                            onChangeText={(v) => {
                              setFTargetBodyFatMass(v);
                              const tw = parseFloat(fTargetWeight);
                              const fm = parseFloat(v);
                              if (
                                !isNaN(tw) &&
                                tw > 0 &&
                                !isNaN(fm) &&
                                fm >= 0
                              ) {
                                setFTargetBodyFatPercent(
                                  ((fm / tw) * 100).toFixed(1)
                                );
                              } else {
                                setFTargetBodyFatPercent("");
                              }
                            }}
                            placeholder="0.0"
                          />
                        </View>
                      </View>
                      {fTargetBodyFatPercent ? (
                        <View style={st.formFatPercentBadge}>
                          <Text style={st.formFatPercentLabel}>
                            목표 체지방률
                          </Text>
                          <Text style={st.formFatPercentValue}>
                            {fTargetBodyFatPercent}%
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}

                  <DateCalendarPicker
                    label="목표 종료일"
                    value={fEndDate}
                    onChange={setFEndDate}
                  />

                  <View style={st.formBtnRow}>
                    <TouchableOpacity
                      style={st.formSaveBtn}
                      onPress={handleSave}
                    >
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
        )}

        {/* 이전 챌린지 기록 */}
        {history.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[st.cardTitle, { marginBottom: 12, marginTop: 4 }]}>
              이전 챌린지
            </Text>
            {history.map((h, idx) => {
              const c = h.challenge;

              /* ── 수치별 개별 달성률 계산 (마이너스 가능) ── */
              type MetricRow = {
                label: string;
                unit: string;
                start: number;
                target: number;
                end: number;
                pct: number;
              };
              const metrics: MetricRow[] = [];

              if (
                c.startWeight != null &&
                c.targetWeight != null &&
                h.endWeight != null
              ) {
                const total = c.targetWeight - c.startWeight;
                const pct =
                  total !== 0
                    ? Math.round(((h.endWeight - c.startWeight) / total) * 100)
                    : 0;
                metrics.push({
                  label: "몸무게",
                  unit: "kg",
                  start: c.startWeight,
                  target: c.targetWeight,
                  end: h.endWeight,
                  pct,
                });
              }
              if (
                c.startMuscleMass != null &&
                c.targetMuscleMass != null &&
                h.endMuscleMass != null
              ) {
                const total = c.targetMuscleMass - c.startMuscleMass;
                const pct =
                  total !== 0
                    ? Math.round(
                        ((h.endMuscleMass - c.startMuscleMass) / total) * 100
                      )
                    : 0;
                metrics.push({
                  label: "골격근량",
                  unit: "kg",
                  start: c.startMuscleMass,
                  target: c.targetMuscleMass,
                  end: h.endMuscleMass,
                  pct,
                });
              }
              if (
                c.startBodyFatMass != null &&
                c.targetBodyFatMass != null &&
                h.endBodyFatMass != null
              ) {
                const total = c.targetBodyFatMass - c.startBodyFatMass;
                const pct =
                  total !== 0
                    ? Math.round(
                        ((h.endBodyFatMass - c.startBodyFatMass) / total) * 100
                      )
                    : 0;
                metrics.push({
                  label: "체지방량",
                  unit: "kg",
                  start: c.startBodyFatMass,
                  target: c.targetBodyFatMass,
                  end: h.endBodyFatMass,
                  pct,
                });
              }
              // 체지방률 별도 행은 더 이상 사용하지 않음 (체지방량에 통합 표시)

              const avgPct =
                metrics.length > 0
                  ? Math.round(
                      metrics.reduce((s, m) => s + m.pct, 0) / metrics.length
                    )
                  : (h.overallProgress ?? 0);

              /* 카드 색상: 성공(100%+)=초록, 0~99=노랑, <0=빨강 */
              const cardBg =
                avgPct >= 100 ? "#E6F4EA" : avgPct >= 0 ? "#FFF9E6" : "#FDE8E8";
              const cardBorder =
                avgPct >= 100 ? "#38A169" : avgPct >= 0 ? "#D69E2E" : "#E53E3E";
              const pctColor =
                avgPct >= 100 ? "#276749" : avgPct >= 0 ? "#975A16" : "#C53030";

              const metricPctColor = (p: number) =>
                p >= 100 ? "#38A169" : p >= 0 ? "#D69E2E" : "#E53E3E";

              return (
                <View
                  key={h.id + idx}
                  style={[
                    st.hCard,
                    {
                      backgroundColor: cardBg,
                      borderLeftColor: cardBorder,
                    },
                  ]}
                >
                  {/* 상단: 날짜 + 퍼센트 + 삭제 */}
                  <View style={st.hCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.hCardDate}>
                        {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                      </Text>
                    </View>
                    <View style={st.hCardPctBox}>
                      <Text style={[st.hCardPct, { color: pctColor }]}>
                        {avgPct > 0 ? "+" : ""}
                        {avgPct}%
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ padding: 4, marginLeft: 8 }}
                      onPress={() => {
                        Alert.alert(
                          "챌린지 삭제",
                          `${fmtDate(c.startDate)} ~ ${fmtDate(c.endDate)} 챌린지를 삭제하시겠습니까?`,
                          [
                            { text: "취소", style: "cancel" },
                            {
                              text: "삭제",
                              style: "destructive",
                              onPress: async () => {
                                const updated = history.filter(
                                  (_, i) => i !== idx
                                );
                                await saveChallengeHistory(updated);
                                setHistory(updated);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={{ fontSize: 16, color: "#A0AEC0" }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 수치별 상세 */}
                  {metrics.length > 0 && (
                    <View style={st.hMetrics}>
                      {metrics.map((m) => {
                        // 체지방량일 때 kg 옆에 체지방률 % 계산
                        const fatPctStart =
                          m.label === "체지방량" && c.startWeight && m.start
                            ? ((m.start / c.startWeight) * 100).toFixed(1)
                            : null;
                        const fatPctEnd =
                          m.label === "체지방량" && h.endWeight && m.end
                            ? ((m.end / h.endWeight) * 100).toFixed(1)
                            : null;
                        const fatPctTarget =
                          m.label === "체지방량" && c.targetWeight && m.target
                            ? ((m.target / c.targetWeight) * 100).toFixed(1)
                            : null;
                        return (
                          <View key={m.label} style={st.hMetricRow}>
                            <View style={st.hMetricLabelRow}>
                              <Text style={st.hMetricLabel}>{m.label}</Text>
                              <Text style={st.hMetricLabelTarget}>
                                (목표 {m.target}
                                {m.unit}
                                {fatPctTarget ? ` · ${fatPctTarget}%` : ""})
                              </Text>
                            </View>
                            <View style={st.hMetricValues}>
                              <Text style={st.hMetricValue}>
                                {m.start}
                                {m.unit}
                                {fatPctStart ? (
                                  <Text
                                    style={{ color: "#718096", fontSize: 10 }}
                                  >{` (${fatPctStart}%)`}</Text>
                                ) : (
                                  ""
                                )}
                              </Text>
                              <Text style={st.hMetricArrow}> → </Text>
                              <Text style={st.hMetricValue}>
                                {m.end}
                                {m.unit}
                                {fatPctEnd ? (
                                  <Text
                                    style={{ color: "#718096", fontSize: 10 }}
                                  >{` (${fatPctEnd}%)`}</Text>
                                ) : (
                                  ""
                                )}
                              </Text>
                              <Text
                                style={[
                                  st.hMetricPct,
                                  { color: metricPctColor(m.pct) },
                                ]}
                              >
                                {m.pct > 0 ? "+" : ""}
                                {m.pct}%
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
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
  editLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EBF8FF",
  },
  editLinkText: { fontSize: 13, color: "#3182CE", fontWeight: "600" },
  deleteLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF5F5",
  },
  deleteLinkText: { fontSize: 13, color: "#E53E3E", fontWeight: "600" },

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
  formSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2D3748",
    marginTop: 16,
    marginBottom: 6,
  },
  formOptional: {
    fontSize: 11,
    fontWeight: "400",
    color: "#A0AEC0",
  },
  formDualRow: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    gap: 6,
    marginBottom: 2,
  },
  formDualCol: {
    flex: 1,
  },
  formSubLabel: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: "#718096",
    marginBottom: 2,
    textAlign: "center" as const,
  },
  formArrow: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#A0AEC0",
    marginBottom: 20,
    marginHorizontal: 2,
  },
  formFatPercentBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "flex-end" as const,
    backgroundColor: "#EBF8FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 6,
    marginBottom: 4,
  },
  formFatPercentLabel: {
    fontSize: 11,
    fontWeight: "500" as const,
    color: "#63B3ED",
  },
  formFatPercentValue: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#3182CE",
  },
  formToggleRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  formCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E0",
    backgroundColor: "#F7FAFC",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  formCheckboxActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E9",
  },
  formCheckmark: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#4CAF50",
    marginTop: -1,
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
  historyItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyDate: { fontSize: 13, color: "#718096", fontWeight: "500" },
  historyPercent: { fontSize: 16, fontWeight: "700", color: "#2D3748" },
  historyDetails: { gap: 2, marginBottom: 4 },
  historyDetail: { fontSize: 13, color: "#4A5568" },
  historyCompleted: { fontSize: 11, color: "#A0AEC0", marginTop: 4 },

  /* history card (색상 카드) */
  hCard: {
    borderRadius: 14,
    paddingTop: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 16,
    marginBottom: 12,
    borderLeftWidth: 5,
  },
  hCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hCardDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2D3748",
  },
  hCardCompleted: {
    fontSize: 11,
    color: "#718096",
    marginTop: 3,
  },
  hCardPctBox: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  hCardPct: {
    fontSize: 28,
    fontWeight: "800",
  },
  hCardPctLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },

  /* 수치별 상세 */
  hMetrics: {
    marginTop: 8,
    gap: 8,
  },
  hMetricRow: {
    gap: 2,
  },
  hMetricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 1,
  },
  hMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A5568",
  },
  hMetricLabelTarget: {
    fontSize: 11,
    color: "#718096",
  },
  hMetricValues: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  hMetricValue: {
    fontSize: 12,
    color: "#4A5568",
  },
  hMetricArrow: {
    fontSize: 12,
    color: "#A0AEC0",
  },
  hMetricPct: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },

  /* 하루 권장 영양소 */
  exSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#718096",
    marginBottom: 6,
    marginTop: 4,
  },
  exScrollRow: {
    marginBottom: 12,
  },
  exFreqRow: {
    flexDirection: "row",
    gap: 6,
  },
  activityRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  exChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#F7FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  exChipActive: {
    backgroundColor: "#E6FFFA",
    borderColor: "#4CAF50",
  },
  exChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#718096",
  },
  exChipTextActive: {
    color: "#4CAF50",
  },
  activityBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#F7FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    minWidth: 80,
  },
  activityBtnActive: {
    backgroundColor: "#E6FFFA",
    borderColor: "#4CAF50",
  },
  activityBtnLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#718096",
  },
  activityBtnLabelActive: {
    color: "#4CAF50",
  },
  activityBtnDesc: {
    fontSize: 10,
    color: "#A0AEC0",
    marginTop: 2,
  },
  activityBtnDescActive: {
    color: "#68D391",
  },
  nutriKcalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 16,
  },
  nutriKcalNum: {
    fontSize: 32,
    fontWeight: "800",
    color: "#2D3748",
  },
  nutriKcalUnit: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A0AEC0",
    marginLeft: 4,
  },
  nutriRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  nutriItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  nutriDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nutriLabel: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "500",
  },
  nutriValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2D3748",
  },
  nutriBarTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  nutriBarSeg: {
    height: 10,
  },
  nutriHint: {
    fontSize: 11,
    color: "#A0AEC0",
    textAlign: "center",
    lineHeight: 16,
  },
});
