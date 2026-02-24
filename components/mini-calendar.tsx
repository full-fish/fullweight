import { getDaysInMonth, getFirstDayOfWeek, pad2 } from "@/utils/format";
import { getLocalDateString } from "@/utils/storage";
import { useKeyboardOffset } from "@/hooks/use-keyboard-offset";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const CAL_DAY = Math.floor((width - 80) / 7);

export function MiniCalendar({
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
  const kbOffset = useKeyboardOffset();
  const [cYear, setCYear] = useState(now.getFullYear());
  const [cMonth, setCMonth] = useState(now.getMonth());
  const [pickerMode, setPickerMode] = useState<
    "calendar" | "yearPicker" | "monthPicker"
  >("calendar");
  const [textDate, setTextDate] = useState("");

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

  const handleTextConfirm = () => {
    const trimmed = textDate.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      Alert.alert("형식 오류", "YYYY-MM-DD 형식으로 입력해주세요.");
      return;
    }
    const [, yStr, mStr, dStr] = match;
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    if (m < 1 || m > 12) {
      Alert.alert("날짜 오류", "월은 1~12 사이여야 합니다.");
      return;
    }
    const maxD = getDaysInMonth(y, m - 1);
    if (d < 1 || d > maxD) {
      Alert.alert("날짜 오류", `일은 1~${maxD} 사이여야 합니다.`);
      return;
    }
    if (trimmed > todayStr) {
      Alert.alert("날짜 오류", "미래 날짜는 선택할 수 없습니다.");
      return;
    }
    setCYear(y);
    setCMonth(m - 1);
    onSelect(trimmed);
    setTextDate("");
  };

  /* 연도 피커 */
  const currentYear = now.getFullYear();
  const yearList = Array.from(
    { length: currentYear - 1920 + 1 },
    (_, i) => 1920 + i
  ).reverse();

  const MONTHS = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={cs.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[cs.card, { transform: [{ translateY: kbOffset }] }]} onStartShouldSetResponder={() => true}>
          {/* 텍스트 입력 */}
          <View style={cs.textInputRow}>
            <TextInput
              style={cs.textInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A0AEC0"
              value={textDate}
              onChangeText={setTextDate}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={handleTextConfirm}
            />
            <TouchableOpacity
              style={cs.textInputBtn}
              onPress={handleTextConfirm}
            >
              <Text style={cs.textInputBtnText}>이동</Text>
            </TouchableOpacity>
          </View>

          {/* 월 네비 */}
          <View style={cs.navRow}>
            <TouchableOpacity onPress={prevMonth} style={cs.navBtn}>
              <Text style={cs.navBtnText}>◀</Text>
            </TouchableOpacity>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <TouchableOpacity
                onPress={() =>
                  setPickerMode(
                    pickerMode === "yearPicker" ? "calendar" : "yearPicker"
                  )
                }
                style={cs.navTitleBtn}
              >
                <Text
                  style={[
                    cs.navTitle,
                    pickerMode === "yearPicker" && { color: "#4CAF50" },
                  ]}
                >
                  {cYear}년
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setPickerMode(
                    pickerMode === "monthPicker" ? "calendar" : "monthPicker"
                  )
                }
                style={cs.navTitleBtn}
              >
                <Text
                  style={[
                    cs.navTitle,
                    pickerMode === "monthPicker" && { color: "#4CAF50" },
                  ]}
                >
                  {cMonth + 1}월
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={nextMonth} style={cs.navBtn}>
              <Text style={cs.navBtnText}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* 연도 피커 */}
          {pickerMode === "yearPicker" && (
            <View style={cs.pickerWrap}>
              <ScrollView
                style={{ maxHeight: 220 }}
                showsVerticalScrollIndicator
              >
                <View style={cs.pickerGrid}>
                  {yearList.map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        cs.pickerItem,
                        y === cYear && cs.pickerItemActive,
                      ]}
                      onPress={() => {
                        setCYear(y);
                        setPickerMode("calendar");
                      }}
                    >
                      <Text
                        style={[
                          cs.pickerItemText,
                          y === cYear && cs.pickerItemTextActive,
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* 월 피커 */}
          {pickerMode === "monthPicker" && (
            <View style={cs.pickerWrap}>
              <View style={cs.monthGrid}>
                {MONTHS.map((label, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      cs.monthItem,
                      idx === cMonth && cs.pickerItemActive,
                    ]}
                    onPress={() => {
                      setCMonth(idx);
                      setPickerMode("calendar");
                    }}
                  >
                    <Text
                      style={[
                        cs.pickerItemText,
                        idx === cMonth && cs.pickerItemTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 달력 본체 */}
          {pickerMode === "calendar" && (
            <>
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
                    if (day === null)
                      return <View key={di} style={cs.dayCell} />;
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
            </>
          )}

          {/* 오늘 버튼 */}
          <TouchableOpacity
            style={cs.todayBtn}
            onPress={() => {
              setCYear(now.getFullYear());
              setCMonth(now.getMonth());
              setPickerMode("calendar");
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
  textInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  textInputBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  textInputBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  navTitleBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  pickerWrap: { marginBottom: 8 },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F7FAFC",
    minWidth: 60,
    alignItems: "center",
  },
  pickerItemActive: { backgroundColor: "#4CAF50" },
  pickerItemText: { fontSize: 14, fontWeight: "500", color: "#4A5568" },
  pickerItemTextActive: { color: "#fff", fontWeight: "700" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  monthItem: {
    width: "22%",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F7FAFC",
    alignItems: "center",
  },
});
