import { SwipeableTab } from "@/components/swipeable-tab";
import { UserSettings, WeightRecord } from "@/types";
import { deletePhoto, pickPhoto, takePhoto } from "@/utils/photo";
import {
  deleteRecord,
  getLocalDateString,
  loadRecords,
  loadUserSettings,
  upsertRecord,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const CAL_DAY = Math.floor((width - 80) / 7);

function getBmiInfo(weight: number, heightCm: number | undefined) {
  if (!heightCm || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  let label: string, color: string;
  if (bmi < 18.5) {
    label = "저체중";
    color = "#3182CE";
  } else if (bmi < 25) {
    label = "정상";
    color = "#38A169";
  } else if (bmi < 30) {
    label = "과체중";
    color = "#DD6B20";
  } else {
    label = "비만";
    color = "#E53E3E";
  }
  return { bmi: Math.round(bmi * 10) / 10, label, color };
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/* ───── 미니 달력 팝업 ───── */
function MiniCalendar({
  visible,
  selectedDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const [cYear, setCYear] = useState(now.getFullYear());
  const [cMonth, setCMonth] = useState(now.getMonth());

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const daysInMonth = getDaysInMonth(cYear, cMonth);
  const firstDay = getFirstDayOfWeek(cYear, cMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = getLocalDateString();

  const prevMonth = () => {
    if (cMonth === 0) {
      setCYear(cYear - 1);
      setCMonth(11);
    } else {
      setCMonth(cMonth - 1);
    }
  };

  const nextMonth = () => {
    if (cMonth === 11) {
      setCYear(cYear + 1);
      setCMonth(0);
    } else {
      setCMonth(cMonth + 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={cs.overlay} activeOpacity={1} onPress={onClose}>
        <View style={cs.card} onStartShouldSetResponder={() => true}>
          {/* 월 네비 */}
          <View style={cs.navRow}>
            <TouchableOpacity onPress={prevMonth} style={cs.navBtn}>
              <Text style={cs.navBtnText}>◀</Text>
            </TouchableOpacity>
            <Text style={cs.navTitle}>
              {cYear}년 {cMonth + 1}월
            </Text>
            <TouchableOpacity onPress={nextMonth} style={cs.navBtn}>
              <Text style={cs.navBtnText}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* 요일 */}
          <View style={cs.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <View key={i} style={cs.weekCell}>
                <Text
                  style={[
                    cs.weekText,
                    i === 0 && { color: "#E53E3E" },
                    i === 6 && { color: "#3182CE" },
                  ]}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* 날짜 */}
          {Array.from({ length: cells.length / 7 }, (_, wi) => (
            <View key={wi} style={cs.weekRow}>
              {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                if (day === null) return <View key={di} style={cs.dayCell} />;
                const dateStr = `${cYear}-${pad2(cMonth + 1)}-${pad2(day)}`;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;

                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      cs.dayCell,
                      isSelected && cs.dayCellSelected,
                      isToday && !isSelected && cs.dayCellToday,
                    ]}
                    onPress={() => {
                      if (!isFuture) onSelect(dateStr);
                    }}
                    disabled={isFuture}
                  >
                    <Text
                      style={[
                        cs.dayText,
                        isFuture && { color: "#CBD5E0" },
                        isSelected && { color: "#fff" },
                        isToday &&
                          !isSelected && {
                            color: "#4CAF50",
                            fontWeight: "700",
                          },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* 오늘 버튼 */}
          <TouchableOpacity
            style={cs.todayBtn}
            onPress={() => {
              setCYear(now.getFullYear());
              setCMonth(now.getMonth());
              onSelect(todayStr);
            }}
          >
            <Text style={cs.todayBtnText}>오늘</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: width * 0.88,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 16, color: "#4A5568" },
  navTitle: { fontSize: 17, fontWeight: "700", color: "#2D3748" },
  weekRow: { flexDirection: "row", justifyContent: "space-around" },
  weekCell: {
    width: CAL_DAY,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  weekText: { fontSize: 12, fontWeight: "600", color: "#718096" },
  dayCell: {
    width: CAL_DAY,
    height: CAL_DAY,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CAL_DAY / 2,
  },
  dayCellSelected: { backgroundColor: "#4CAF50" },
  dayCellToday: { borderWidth: 1.5, borderColor: "#4CAF50" },
  dayText: { fontSize: 14, fontWeight: "500", color: "#2D3748" },
  todayBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#F0F4F8",
    borderRadius: 10,
  },
  todayBtnText: { fontSize: 14, fontWeight: "600", color: "#4CAF50" },
});

/* ───── MAIN ───── */

export default function HomeScreen() {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [bodyFatMass, setBodyFatMass] = useState("");
  const [exercised, setExercised] = useState(false);
  const [drank, setDrank] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  const [userSettings, setUserSettings] = useState<UserSettings>({});

  /* 편집 모달 상태 */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState<WeightRecord | null>(null);
  const [emWeight, setEmWeight] = useState("");
  const [emWaist, setEmWaist] = useState("");
  const [emMuscleMass, setEmMuscleMass] = useState("");
  const [emBodyFatPercent, setEmBodyFatPercent] = useState("");
  const [emBodyFatMass, setEmBodyFatMass] = useState("");
  const [emExercised, setEmExercised] = useState(false);
  const [emDrank, setEmDrank] = useState(false);
  const [emPhotoUri, setEmPhotoUri] = useState<string | undefined>(undefined);

  const loadAndSetRecords = useCallback(async () => {
    const data = await loadRecords();
    const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
    setRecords(sorted);
    return data;
  }, []);

  // 선택된 날짜의 기록 불러오기
  const populateForm = useCallback(
    (date: string, allRecords: WeightRecord[]) => {
      const existing = allRecords.find((r) => r.date === date);
      if (existing) {
        setWeight(existing.weight.toString());
        setWaist(existing.waist?.toString() ?? "");
        setMuscleMass(existing.muscleMass?.toString() ?? "");
        setBodyFatPercent(existing.bodyFatPercent?.toString() ?? "");
        setBodyFatMass(existing.bodyFatMass?.toString() ?? "");
        setExercised(existing.exercised);
        setDrank(existing.drank);
        setPhotoUri(existing.photoUri);
      } else {
        // Pre-fill weight with most recent record
        const sorted = [...allRecords].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        const latestWeight =
          sorted.length > 0 ? sorted[0].weight.toString() : "";
        setWeight(latestWeight);
        setWaist("");
        setMuscleMass("");
        setBodyFatPercent("");
        setBodyFatMass("");
        setExercised(false);
        setDrank(false);
        setPhotoUri(undefined);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadAndSetRecords().then((data) => {
        populateForm(selectedDate, data);
      });
      loadUserSettings().then(setUserSettings);
    }, [selectedDate, loadAndSetRecords, populateForm])
  );

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    const existing = records.find((r) => r.date === date);
    if (existing) {
      setWeight(existing.weight.toString());
      setWaist(existing.waist?.toString() ?? "");
      setMuscleMass(existing.muscleMass?.toString() ?? "");
      setBodyFatPercent(existing.bodyFatPercent?.toString() ?? "");
      setBodyFatMass(existing.bodyFatMass?.toString() ?? "");
      setExercised(existing.exercised);
      setDrank(existing.drank);
      setPhotoUri(existing.photoUri);
    } else {
      // Pre-fill weight with most recent record
      const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
      const latestWeight = sorted.length > 0 ? sorted[0].weight.toString() : "";
      setWeight(latestWeight);
      setWaist("");
      setMuscleMass("");
      setBodyFatPercent("");
      setBodyFatMass("");
      setExercised(false);
      setDrank(false);
      setPhotoUri(undefined);
    }
  };

  const handleSave = async () => {
    const w = parseFloat(weight);
    if (!weight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const record: WeightRecord = {
      id: selectedDate,
      date: selectedDate,
      weight: w,
      waist: waist ? parseFloat(waist) : undefined,
      muscleMass: muscleMass ? parseFloat(muscleMass) : undefined,
      bodyFatPercent: bodyFatPercent ? parseFloat(bodyFatPercent) : undefined,
      bodyFatMass: bodyFatMass ? parseFloat(bodyFatMass) : undefined,
      exercised,
      drank,
      photoUri,
    };
    const updated = await upsertRecord(record);
    setRecords([...updated].sort((a, b) => b.date.localeCompare(a.date)));
    Alert.alert(
      "저장 완료 ✅",
      `${formatDate(selectedDate)} 기록이 저장되었습니다.`
    );
  };

  const handleDelete = (date: string) => {
    Alert.alert("기록 삭제", "이 기록을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const updated = await deleteRecord(date);
          setRecords([...updated].sort((a, b) => b.date.localeCompare(a.date)));
          if (date === selectedDate) {
            setWeight("");
            setWaist("");
            setMuscleMass("");
            setBodyFatPercent("");
            setBodyFatMass("");
            setExercised(false);
            setDrank(false);
            setPhotoUri(undefined);
          }
        },
      },
    ]);
  };

  const handleEdit = (record: WeightRecord) => {
    setEditRecord(record);
    setEmWeight(record.weight.toString());
    setEmWaist(record.waist?.toString() ?? "");
    setEmMuscleMass(record.muscleMass?.toString() ?? "");
    setEmBodyFatPercent(record.bodyFatPercent?.toString() ?? "");
    setEmBodyFatMass(record.bodyFatMass?.toString() ?? "");
    setEmExercised(record.exercised);
    setEmDrank(record.drank);
    setEmPhotoUri(record.photoUri);
    setShowEditModal(true);
  };

  const handleEditModalSave = async () => {
    if (!editRecord) return;
    const w = parseFloat(emWeight);
    if (!emWeight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const updated: WeightRecord = {
      id: editRecord.id,
      date: editRecord.date,
      weight: w,
      waist: emWaist ? parseFloat(emWaist) : undefined,
      muscleMass: emMuscleMass ? parseFloat(emMuscleMass) : undefined,
      bodyFatPercent: emBodyFatPercent
        ? parseFloat(emBodyFatPercent)
        : undefined,
      bodyFatMass: emBodyFatMass ? parseFloat(emBodyFatMass) : undefined,
      exercised: emExercised,
      drank: emDrank,
      photoUri: emPhotoUri,
    };
    const newRecords = await upsertRecord(updated);
    setRecords([...newRecords].sort((a, b) => b.date.localeCompare(a.date)));
    setShowEditModal(false);
    setEditRecord(null);
    // 선택된 날짜와 같으면 폼도 업데이트
    if (editRecord.date === selectedDate) {
      setWeight(w.toString());
      setWaist(emWaist);
      setMuscleMass(emMuscleMass);
      setBodyFatPercent(emBodyFatPercent);
      setBodyFatMass(emBodyFatMass);
      setExercised(emExercised);
      setDrank(emDrank);
      setPhotoUri(emPhotoUri);
    }
    Alert.alert(
      "저장 완료 ✅",
      `${formatDate(editRecord.date)} 기록이 수정되었습니다.`
    );
  };

  const isToday = selectedDate === getLocalDateString();

  return (
    <SwipeableTab currentIndex={0}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>💪 몸무게 트래커</Text>

          {/* 날짜 선택 */}
          <View style={styles.dateSelectRow}>
            <TouchableOpacity
              onPress={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                handleDateSelect(getLocalDateString(d));
              }}
              style={styles.dateArrow}
            >
              <Text style={styles.dateArrowText}>◀</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateTouchable}
            >
              <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
              <Text style={styles.datePickerIcon}>📅</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (!isToday) {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  const next = getLocalDateString(d);
                  if (next <= getLocalDateString()) {
                    handleDateSelect(next);
                  }
                }
              }}
              style={[styles.dateArrow, isToday && { opacity: 0.3 }]}
              disabled={isToday}
            >
              <Text style={styles.dateArrowText}>▶</Text>
            </TouchableOpacity>
          </View>

          {!isToday && (
            <TouchableOpacity
              style={styles.todayLink}
              onPress={() => handleDateSelect(getLocalDateString())}
            >
              <Text style={styles.todayLinkText}>오늘로 이동</Text>
            </TouchableOpacity>
          )}

          {/* 입력 카드 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isToday ? "오늘의 기록" : `${formatDate(selectedDate)} 기록`}
            </Text>

            <Text style={styles.label}>몸무게</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => {
                  const v = parseFloat(weight) || 0;
                  setWeight(Math.max(0, v - 0.1).toFixed(1));
                }}
              >
                <Text style={styles.stepBtnText}>▼</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { textAlign: "center" }]}
                value={weight}
                onChangeText={setWeight}
                placeholder="0.0"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => {
                  const v = parseFloat(weight) || 0;
                  setWeight((v + 0.1).toFixed(1));
                }}
              >
                <Text style={styles.stepBtnText}>▲</Text>
              </TouchableOpacity>
              <Text style={styles.unit}>kg</Text>
            </View>

            <Text style={styles.label}>허리둘레 (선택)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={waist}
                onChangeText={setWaist}
                placeholder="0.0"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>cm</Text>
            </View>

            <Text style={styles.label}>골격근량 (선택)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={muscleMass}
                onChangeText={setMuscleMass}
                placeholder="0.0"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>kg</Text>
            </View>

            <Text style={styles.label}>체지방률 (선택)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={bodyFatPercent}
                onChangeText={(v) => {
                  setBodyFatPercent(v);
                  const w = parseFloat(weight);
                  const p = parseFloat(v);
                  if (w > 0 && p >= 0 && !isNaN(p)) {
                    setBodyFatMass(((w * p) / 100).toFixed(1));
                  }
                }}
                placeholder="0.0"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>%</Text>
            </View>

            <Text style={styles.label}>체지방량 (선택)</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={bodyFatMass}
                onChangeText={(v) => {
                  setBodyFatMass(v);
                  const w = parseFloat(weight);
                  const m = parseFloat(v);
                  if (w > 0 && m >= 0 && !isNaN(m)) {
                    setBodyFatPercent(((m / w) * 100).toFixed(1));
                  }
                }}
                placeholder="0.0"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>kg</Text>
            </View>

            {/* 사진 */}
            <Text style={styles.label}>바디 사진 (선택)</Text>
            <View style={styles.photoSection}>
              {photoUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                  />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={async () => {
                      await deletePhoto(photoUri);
                      setPhotoUri(undefined);
                    }}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.photoBtnRow}>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={async () => {
                    const uri = await takePhoto();
                    if (uri) setPhotoUri(uri);
                  }}
                >
                  <Text style={styles.photoBtnText}>📸 촬영</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={async () => {
                    const uri = await pickPhoto();
                    if (uri) setPhotoUri(uri);
                  }}
                >
                  <Text style={styles.photoBtnText}>🖼 갤러리</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>🏃 오늘 운동했나요?</Text>
                <Switch
                  value={exercised}
                  onValueChange={setExercised}
                  trackColor={{ true: "#4CAF50", false: "#ddd" }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>🍺 오늘 음주했나요?</Text>
                <Switch
                  value={drank}
                  onValueChange={setDrank}
                  trackColor={{ true: "#FF9800", false: "#ddd" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>저장하기</Text>
            </TouchableOpacity>
          </View>

          {/* 기록 목록 */}
          <Text style={styles.sectionTitle}>기록 목록</Text>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>
              아직 기록이 없습니다.{"\n"}첫 번째 기록을 추가해보세요! 🎯
            </Text>
          ) : (
            records.map((record) => (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordTop}>
                  <Text style={styles.recordDate}>
                    {formatDate(record.date)}
                  </Text>
                  <View style={styles.recordActions}>
                    <TouchableOpacity onPress={() => handleEdit(record)}>
                      <Text style={styles.editBtn}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(record.date)}>
                      <Text style={styles.deleteBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.recordWeight}>{record.weight} kg</Text>
                {userSettings.height &&
                  (() => {
                    const info = getBmiInfo(record.weight, userSettings.height);
                    if (!info) return null;
                    return (
                      <View style={styles.bmiRow}>
                        <Text style={styles.recordSub}>📊 BMI: {info.bmi}</Text>
                        <View style={styles.bmiBadge}>
                          <Text
                            style={[styles.bmiBadgeText, { color: info.color }]}
                          >
                            {info.label}
                          </Text>
                        </View>
                        <View style={styles.bmiBarWrap}>
                          <View style={styles.bmiBarTrack}>
                            <View
                              style={[
                                styles.bmiBarZone,
                                { flex: 18.5, backgroundColor: "#BEE3F8" },
                              ]}
                            />
                            <View
                              style={[
                                styles.bmiBarZone,
                                { flex: 6.5, backgroundColor: "#C6F6D5" },
                              ]}
                            />
                            <View
                              style={[
                                styles.bmiBarZone,
                                { flex: 5, backgroundColor: "#FEEBC8" },
                              ]}
                            />
                            <View
                              style={[
                                styles.bmiBarZone,
                                { flex: 10, backgroundColor: "#FED7D7" },
                              ]}
                            />
                          </View>
                          <View
                            style={[
                              styles.bmiIndicator,
                              {
                                left: `${Math.min(95, Math.max(2, ((info.bmi - 10) / 30) * 100))}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })()}
                {record.waist != null && (
                  <Text style={styles.recordSub}>
                    📏 허리: {record.waist} cm
                  </Text>
                )}
                {record.muscleMass != null && (
                  <Text style={styles.recordSub}>
                    💪 골격근: {record.muscleMass} kg
                  </Text>
                )}
                {record.bodyFatPercent != null && (
                  <Text style={styles.recordSub}>
                    🔥 체지방률: {record.bodyFatPercent} %
                  </Text>
                )}
                {record.bodyFatMass != null && (
                  <Text style={styles.recordSub}>
                    🟣 체지방량: {record.bodyFatMass} kg
                  </Text>
                )}
                {record.photoUri && (
                  <Image
                    source={{ uri: record.photoUri }}
                    style={styles.recordPhoto}
                  />
                )}
                <View style={styles.badgeRow}>
                  {record.exercised && (
                    <View style={[styles.badge, styles.badgeExercise]}>
                      <Text style={styles.badgeText}>🏃 운동</Text>
                    </View>
                  )}
                  {record.drank && (
                    <View style={[styles.badge, styles.badgeDrank]}>
                      <Text style={styles.badgeText}>🍺 음주</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* 달력 팝업 */}
        <MiniCalendar
          visible={showDatePicker}
          selectedDate={selectedDate}
          onSelect={handleDateSelect}
          onClose={() => setShowDatePicker(false)}
        />

        {/* 편집 팝업 모달 */}
        <Modal
          visible={showEditModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowEditModal(false);
            setEditRecord(null);
          }}
        >
          <TouchableOpacity
            style={editModalStyles.overlay}
            activeOpacity={1}
            onPress={() => {
              setShowEditModal(false);
              setEditRecord(null);
            }}
          >
            <View
              style={editModalStyles.card}
              onStartShouldSetResponder={() => true}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={editModalStyles.title}>
                  {editRecord ? `${formatDate(editRecord.date)} 수정` : "수정"}
                </Text>

                <Text style={editModalStyles.label}>몸무게 (kg) *</Text>
                <TextInput
                  style={editModalStyles.input}
                  value={emWeight}
                  onChangeText={setEmWeight}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#aaa"
                />

                <Text style={editModalStyles.label}>허리둘레 (cm)</Text>
                <TextInput
                  style={editModalStyles.input}
                  value={emWaist}
                  onChangeText={setEmWaist}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                <Text style={editModalStyles.label}>골격근량 (kg)</Text>
                <TextInput
                  style={editModalStyles.input}
                  value={emMuscleMass}
                  onChangeText={setEmMuscleMass}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                <Text style={editModalStyles.label}>체지방률 (%)</Text>
                <TextInput
                  style={editModalStyles.input}
                  value={emBodyFatPercent}
                  onChangeText={(v) => {
                    setEmBodyFatPercent(v);
                    const w = parseFloat(emWeight);
                    const p = parseFloat(v);
                    if (w > 0 && p >= 0 && !isNaN(p)) {
                      setEmBodyFatMass(((w * p) / 100).toFixed(1));
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                <Text style={editModalStyles.label}>체지방량 (kg)</Text>
                <TextInput
                  style={editModalStyles.input}
                  value={emBodyFatMass}
                  onChangeText={(v) => {
                    setEmBodyFatMass(v);
                    const w = parseFloat(emWeight);
                    const m = parseFloat(v);
                    if (w > 0 && m >= 0 && !isNaN(m)) {
                      setEmBodyFatPercent(((m / w) * 100).toFixed(1));
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                {/* 사진 */}
                <Text style={editModalStyles.label}>바디 사진</Text>
                <View style={{ marginBottom: 12 }}>
                  {emPhotoUri ? (
                    <View style={{ position: "relative", marginBottom: 8 }}>
                      <Image
                        source={{ uri: emPhotoUri }}
                        style={{ width: "100%", height: 160, borderRadius: 10 }}
                      />
                      <TouchableOpacity
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          backgroundColor: "rgba(0,0,0,0.5)",
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onPress={async () => {
                          await deletePhoto(emPhotoUri!);
                          setEmPhotoUri(undefined);
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                        >
                          ✕
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#EDF2F7",
                        borderRadius: 8,
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                      onPress={async () => {
                        const uri = await takePhoto();
                        if (uri) setEmPhotoUri(uri);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#4A5568",
                        }}
                      >
                        {"📸 촬영"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#EDF2F7",
                        borderRadius: 8,
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                      onPress={async () => {
                        const uri = await pickPhoto();
                        if (uri) setEmPhotoUri(uri);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#4A5568",
                        }}
                      >
                        {"🖼 갤러리"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={editModalStyles.switchRow}>
                  <Text style={editModalStyles.label}>{"🏃 운동"}</Text>
                  <Switch
                    value={emExercised}
                    onValueChange={setEmExercised}
                    trackColor={{ true: "#4CAF50", false: "#ddd" }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={editModalStyles.switchRow}>
                  <Text style={editModalStyles.label}>{"🍺 음주"}</Text>
                  <Switch
                    value={emDrank}
                    onValueChange={setEmDrank}
                    trackColor={{ true: "#FF9800", false: "#ddd" }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={editModalStyles.btnRow}>
                  <TouchableOpacity
                    style={editModalStyles.saveBtn}
                    onPress={handleEditModalSave}
                  >
                    <Text style={editModalStyles.saveBtnText}>저장</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={editModalStyles.cancelBtn}
                    onPress={() => {
                      setShowEditModal(false);
                      setEditRecord(null);
                    }}
                  >
                    <Text style={editModalStyles.cancelBtnText}>취소</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SwipeableTab>
  );
}

const editModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  card: {
    width: width * 0.9,
    maxHeight: "82%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: "#718096" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 4,
  },

  /* date selector */
  dateSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    gap: 8,
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  dateArrowText: { fontSize: 14, color: "#4A5568" },
  dateTouchable: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    gap: 8,
  },
  dateText: { fontSize: 16, fontWeight: "600", color: "#2D3748" },
  datePickerIcon: { fontSize: 18 },
  todayLink: { alignItems: "center", marginBottom: 12 },
  todayLinkText: { fontSize: 13, color: "#4CAF50", fontWeight: "600" },

  /* card */
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 6,
  },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  unit: {
    marginLeft: 8,
    fontSize: 16,
    color: "#718096",
    fontWeight: "500",
    width: 24,
  },
  switchGroup: { marginBottom: 16, gap: 4 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F7FAFC",
  },
  switchLabel: { fontSize: 15, color: "#4A5568" },
  saveBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  /* photo */
  photoSection: { marginBottom: 16 },
  photoPreviewWrap: { position: "relative", marginBottom: 8 },
  photoPreview: { width: "100%", height: 200, borderRadius: 12 },
  photoRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  photoBtnRow: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  photoBtnText: { fontSize: 14, fontWeight: "600", color: "#4A5568" },

  /* records */
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#A0AEC0",
    fontSize: 15,
    lineHeight: 26,
    marginTop: 40,
  },
  recordCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  recordActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  recordDate: { fontSize: 13, color: "#718096", fontWeight: "500" },
  editBtn: { fontSize: 16, paddingHorizontal: 4, paddingVertical: 2 },
  deleteBtn: {
    fontSize: 15,
    color: "#CBD5E0",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  recordWeight: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 4,
  },
  recordSub: { fontSize: 14, color: "#718096", marginBottom: 2 },
  recordPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeExercise: { backgroundColor: "#E8F5E9" },
  badgeDrank: { backgroundColor: "#FFF3E0" },
  badgeText: { fontSize: 12, fontWeight: "500", color: "#4A5568" },
  stepBtn: {
    width: 40,
    height: 48,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  stepBtnText: { fontSize: 16, color: "#4A5568", fontWeight: "600" },
  bmiRow: { marginTop: 4, marginBottom: 4 },
  bmiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#F7FAFC",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  bmiBadgeText: { fontSize: 12, fontWeight: "600" },
  bmiBarWrap: { position: "relative" as const, marginTop: 4, height: 10 },
  bmiBarTrack: {
    flexDirection: "row" as const,
    height: 8,
    borderRadius: 4,
    overflow: "hidden" as const,
  },
  bmiBarZone: { height: "100%" as const },
  bmiIndicator: {
    position: "absolute" as const,
    top: -1,
    width: 4,
    height: 10,
    backgroundColor: "#2D3748",
    borderRadius: 2,
  },
});
