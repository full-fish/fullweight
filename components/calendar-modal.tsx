/**
 * CalendarModal — 날짜 선택 캘린더 팝업
 * explore.tsx의 기간 선택, 통계/활동 기간 선택 등에서 공통 사용
 */
import { useKeyboardOffset } from "@/hooks/use-keyboard-offset";
import {
  getDaysInMonth,
  getFirstDayOfWeek,
  isValidDateString,
  normalizeDateString,
  pad2,
} from "@/utils/format";
import { getLocalDateString } from "@/utils/storage";
import React, { useEffect, useState } from "react";
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
const CP_DAY = Math.floor((width * 0.82 - 56) / 7);

type Props = {
  visible: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  /** 선택 가능한 최소 날짜 (YYYY-MM-DD) */
  minDate?: string;
  /** 선택 가능한 최대 날짜 (YYYY-MM-DD) */
  maxDate?: string;
  /** 연도 선택 목록 범위 (기본 1950~올해) */
  yearRange?: { from: number; to: number };
  /** 하단 "오늘" 버튼 표시 */
  showTodayButton?: boolean;
};

export function CalendarModal({
  visible,
  value,
  onChange,
  onClose,
  minDate,
  maxDate,
  yearRange,
  showTodayButton,
}: Props) {
  const now = new Date();
  const parsed = value ? new Date(value) : now;
  const initY = !isNaN(parsed.getTime())
    ? parsed.getFullYear()
    : now.getFullYear();
  const initM = !isNaN(parsed.getTime()) ? parsed.getMonth() : now.getMonth();
  const [cYear, setCYear] = useState(initY);
  const kbOffset = useKeyboardOffset();
  const [cMonth, setCMonth] = useState(initM);
  const [textDate, setTextDate] = useState(value);
  const [pickerMode, setPickerMode] = useState<"calendar" | "year" | "month">(
    "calendar"
  );

  const currYear = new Date().getFullYear();
  const yFrom = yearRange?.from ?? 1950;
  const yTo = yearRange?.to ?? currYear;
  const years = Array.from(
    { length: yTo - yFrom + 1 },
    (_, i) => yFrom + i
  ).reverse();
  const todayStr = getLocalDateString(now);

  useEffect(() => {
    if (visible) {
      const p = value ? new Date(value) : new Date();
      if (!isNaN(p.getTime())) {
        setCYear(p.getFullYear());
        setCMonth(p.getMonth());
      }
      setTextDate(value);
      setPickerMode("calendar");
    }
  }, [visible, value]);

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
    } else setCMonth(cMonth - 1);
  };
  const nextM = () => {
    if (cMonth === 11) {
      setCYear(cYear + 1);
      setCMonth(0);
    } else setCMonth(cMonth + 1);
  };

  const handleTextConfirm = () => {
    const normalized = normalizeDateString(textDate.trim());
    if (!normalized) {
      Alert.alert(
        "형식 오류",
        "YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해주세요."
      );
      return;
    }
    if (!isValidDateString(normalized)) {
      Alert.alert("날짜 오류", "존재하지 않는 날짜입니다.");
      return;
    }
    if (
      (minDate && normalized < minDate) ||
      (maxDate && normalized > maxDate)
    ) {
      Alert.alert(
        "범위 오류",
        `${minDate ?? "제한 없음"} ~ ${maxDate ?? "제한 없음"} 사이여야 합니다.`
      );
      return;
    }
    onChange(normalized);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={cpS.overlay} activeOpacity={1} onPress={onClose}>
        <View
          style={[cpS.card, { transform: [{ translateY: kbOffset }] }]}
          onStartShouldSetResponder={() => true}
        >
          {/* 직접 입력 */}
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
              // YYYYMMDD 8자리가 채워지면 YYYY-MM-DD로 바로 정규화
              onChangeText={(t) => setTextDate(normalizeDateString(t) ?? t)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
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
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                확인
              </Text>
            </TouchableOpacity>
          </View>

          {/* 네비게이션 */}
          <View style={cpS.navRow}>
            <TouchableOpacity onPress={prevM} style={cpS.navBtn}>
              <Text style={cpS.navBtnText}>◀</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() =>
                  setPickerMode((m) => (m === "year" ? "calendar" : "year"))
                }
              >
                <Text
                  style={[
                    cpS.navTitle,
                    pickerMode === "year" && { color: "#4CAF50" },
                  ]}
                >
                  {cYear}년
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setPickerMode((m) => (m === "month" ? "calendar" : "month"))
                }
              >
                <Text
                  style={[
                    cpS.navTitle,
                    pickerMode === "month" && { color: "#4CAF50" },
                  ]}
                >
                  {" "}
                  {cMonth + 1}월
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={nextM} style={cpS.navBtn}>
              <Text style={cpS.navBtnText}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* 연도 선택 */}
          {pickerMode === "year" && (
            <ScrollView style={{ maxHeight: 200, marginBottom: 10 }}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={{
                    paddingVertical: 8,
                    alignItems: "center",
                    backgroundColor: y === cYear ? "#E8F5E9" : undefined,
                    borderRadius: 8,
                  }}
                  onPress={() => {
                    setCYear(y);
                    setPickerMode("calendar");
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: y === cYear ? "700" : "400",
                      color: y === cYear ? "#4CAF50" : "#2D3748",
                    }}
                  >
                    {y}년
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 월 선택 */}
          {pickerMode === "month" && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-around",
                marginBottom: 10,
              }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <TouchableOpacity
                  key={i}
                  style={{
                    width: "23%",
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: i === cMonth ? "#E8F5E9" : undefined,
                    borderRadius: 8,
                    marginBottom: 6,
                  }}
                  onPress={() => {
                    setCMonth(i);
                    setPickerMode("calendar");
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: i === cMonth ? "700" : "400",
                      color: i === cMonth ? "#4CAF50" : "#2D3748",
                    }}
                  >
                    {i + 1}월
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 달력 */}
          {pickerMode === "calendar" && (
            <>
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
                    const isToday = dateStr === todayStr;
                    const isDisabled =
                      (minDate != null && dateStr < minDate) ||
                      (maxDate != null && dateStr > maxDate);
                    return (
                      <TouchableOpacity
                        key={di}
                        style={[
                          cpS.dayCell,
                          isToday && !isSelected && cpS.dayCellToday,
                          isSelected && cpS.dayCellSelected,
                          isDisabled && cpS.dayCellDisabled,
                        ]}
                        onPress={() => {
                          if (isDisabled) return;
                          onChange(dateStr);
                          onClose();
                        }}
                        activeOpacity={isDisabled ? 1 : 0.7}
                      >
                        <Text
                          style={[
                            cpS.dayText,
                            di === 0 && { color: "#E53E3E" },
                            di === 6 && { color: "#3182CE" },
                            isToday && !isSelected && cpS.dayTextToday,
                            isSelected && { color: "#fff" },
                            isDisabled && cpS.dayTextDisabled,
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

          {showTodayButton && (
            <TouchableOpacity
              style={cpS.todayBtn}
              onPress={() => {
                setCYear(now.getFullYear());
                setCMonth(now.getMonth());
                setPickerMode("calendar");
                onChange(todayStr);
                onClose();
              }}
            >
              <Text style={cpS.todayBtnText}>오늘</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
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
  dayCellToday: { borderWidth: 1.5, borderColor: "#4CAF50" },
  dayCellDisabled: { opacity: 0.35 },
  dayText: { fontSize: 13, fontWeight: "500", color: "#2D3748" },
  dayTextToday: { color: "#4CAF50", fontWeight: "700" },
  dayTextDisabled: { color: "#718096" },
  todayBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#F0F4F8",
    borderRadius: 10,
  },
  todayBtnText: { fontSize: 14, fontWeight: "600", color: "#4CAF50" },
});
