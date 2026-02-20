import { WeightRecord } from "@/types";
import { deleteRecord, loadRecords, upsertRecord } from "@/utils/storage";
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
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<WeightRecord | null>(
    null
  );
  const [editMode, setEditMode] = useState(false);

  /* 편집 폼 상태 */
  const [eWeight, setEWeight] = useState("");
  const [eWaist, setEWaist] = useState("");
  const [eMuscleMass, setEMuscleMass] = useState("");
  const [eBodyFatPercent, setEBodyFatPercent] = useState("");
  const [eBodyFatMass, setEBodyFatMass] = useState("");
  const [eExercised, setEExercised] = useState(false);
  const [eDrank, setEDrank] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then(setRecords);
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

  const monthRecords = useMemo(() => {
    const prefix = `${year}-${pad2(month + 1)}`;
    return records.filter((r) => r.date.startsWith(prefix));
  }, [records, year, month]);

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
    const updated: WeightRecord = {
      ...selectedRecord,
      weight: w,
      waist: eWaist ? parseFloat(eWaist) : undefined,
      muscleMass: eMuscleMass ? parseFloat(eMuscleMass) : undefined,
      bodyFatPercent: eBodyFatPercent ? parseFloat(eBodyFatPercent) : undefined,
      bodyFatMass: eBodyFatMass ? parseFloat(eBodyFatMass) : undefined,
      exercised: eExercised,
      drank: eDrank,
    };
    const newRecords = await upsertRecord(updated);
    setRecords(newRecords);
    setSelectedRecord(updated);
    setEditMode(false);
    Alert.alert("저장 완료 ✅", "기록이 수정되었습니다.");
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
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>📅 캘린더</Text>

      {/* 월 네비게이션 */}
      <View style={s.navRow}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <Text style={s.navBtnText}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday}>
          <Text style={s.navTitle}>
            {year}년 {month + 1}월
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
          <Text style={s.navBtnText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* 이번 달 요약 */}
      <View style={s.monthSummary}>
        <View style={s.summaryChip}>
          <Text style={s.summaryNum}>{monthRecords.length}</Text>
          <Text style={s.summaryLabel}>기록일</Text>
        </View>
        <View style={s.summaryChip}>
          <Text style={s.summaryNum}>
            {monthRecords.filter((r) => r.exercised).length}
          </Text>
          <Text style={s.summaryLabel}>운동</Text>
        </View>
        <View style={s.summaryChip}>
          <Text style={s.summaryNum}>
            {monthRecords.filter((r) => r.drank).length}
          </Text>
          <Text style={s.summaryLabel}>음주</Text>
        </View>
      </View>

      {/* 캘린더 */}
      <View style={s.calendarCard}>
        {/* 요일 헤더 */}
        <View style={s.weekRow}>
          {WEEKDAYS.map((d, i) => (
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

                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      s.dayCell,
                      isToday && s.dayCellToday,
                      rec && s.dayCellHasRecord,
                    ]}
                    onPress={() => rec && openDetail(rec)}
                    disabled={!rec}
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
                        {rec.exercised && (
                          <View
                            style={[s.miniDot, { backgroundColor: "#4CAF50" }]}
                          />
                        )}
                        {rec.drank && (
                          <View
                            style={[s.miniDot, { backgroundColor: "#FF9800" }]}
                          />
                        )}
                        {!rec.exercised && !rec.drank && (
                          <View
                            style={[s.miniDot, { backgroundColor: "#90CAF9" }]}
                          />
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
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#4CAF50" }]} />
            <Text style={s.legendText}>운동</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#FF9800" }]} />
            <Text style={s.legendText}>음주</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: "#90CAF9" }]} />
            <Text style={s.legendText}>기록</Text>
          </View>
        </View>
      </View>

      {/* 상세/수정 모달 */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            {selectedRecord && !editMode && (
              <>
                <Text style={s.modalDate}>{fmtDate(selectedRecord.date)}</Text>
                <View style={s.modalRow}>
                  <Text style={s.modalLabel}>⚖️ 몸무게</Text>
                  <Text style={s.modalValue}>{selectedRecord.weight} kg</Text>
                </View>
                {selectedRecord.waist != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>📏 허리둘레</Text>
                    <Text style={s.modalValue}>{selectedRecord.waist} cm</Text>
                  </View>
                )}
                {selectedRecord.muscleMass != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>💪 골격근량</Text>
                    <Text style={s.modalValue}>
                      {selectedRecord.muscleMass} kg
                    </Text>
                  </View>
                )}
                {selectedRecord.bodyFatPercent != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>🔥 체지방률</Text>
                    <Text style={s.modalValue}>
                      {selectedRecord.bodyFatPercent} %
                    </Text>
                  </View>
                )}
                {selectedRecord.bodyFatMass != null && (
                  <View style={s.modalRow}>
                    <Text style={s.modalLabel}>🟣 체지방량</Text>
                    <Text style={s.modalValue}>
                      {selectedRecord.bodyFatMass} kg
                    </Text>
                  </View>
                )}
                {selectedRecord.photoUri && (
                  <Image
                    source={{ uri: selectedRecord.photoUri }}
                    style={s.modalPhoto}
                  />
                )}
                <View style={s.modalBadges}>
                  {selectedRecord.exercised && (
                    <View style={[s.badge, s.badgeGreen]}>
                      <Text style={s.badgeText}>🏃 운동</Text>
                    </View>
                  )}
                  {selectedRecord.drank && (
                    <View style={[s.badge, s.badgeOrange]}>
                      <Text style={s.badgeText}>🍺 음주</Text>
                    </View>
                  )}
                </View>

                {/* 수정/삭제 버튼 */}
                <View style={s.modalActionRow}>
                  <TouchableOpacity style={s.modalEditBtn} onPress={startEdit}>
                    <Text style={s.modalEditBtnText}>✏️ 수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.modalDeleteBtn}
                    onPress={handleDelete}
                  >
                    <Text style={s.modalDeleteBtnText}>🗑️ 삭제</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={s.modalClose} onPress={closeModal}>
                  <Text style={s.modalCloseText}>닫기</Text>
                </TouchableOpacity>
              </>
            )}

            {/* 편집 모드 */}
            {selectedRecord && editMode && (
              <ScrollView showsVerticalScrollIndicator={false}>
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

                <Text style={s.editLabel}>허리둘레 (cm)</Text>
                <TextInput
                  style={s.editInput}
                  value={eWaist}
                  onChangeText={setEWaist}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                <Text style={s.editLabel}>골격근량 (kg)</Text>
                <TextInput
                  style={s.editInput}
                  value={eMuscleMass}
                  onChangeText={setEMuscleMass}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                <Text style={s.editLabel}>체지방률 (%)</Text>
                <TextInput
                  style={s.editInput}
                  value={eBodyFatPercent}
                  onChangeText={setEBodyFatPercent}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

                <Text style={s.editLabel}>체지방량 (kg)</Text>
                <TextInput
                  style={s.editInput}
                  value={eBodyFatMass}
                  onChangeText={setEBodyFatMass}
                  keyboardType="decimal-pad"
                  placeholder="선택"
                  placeholderTextColor="#aaa"
                />

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

                <View style={s.modalActionRow}>
                  <TouchableOpacity style={s.modalSaveBtn} onPress={handleSave}>
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
        </TouchableOpacity>
      </Modal>
    </ScrollView>
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
    justifyContent: "center",
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

  modalClose: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#F0F4F8",
    borderRadius: 10,
  },
  modalCloseText: { fontSize: 15, fontWeight: "600", color: "#4A5568" },
});
