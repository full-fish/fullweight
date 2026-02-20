import { SwipeableTab } from "@/components/swipeable-tab";
import {
  clearAllRecords,
  loadRecords,
  loadUserSettings,
  saveUserSettings,
  seedDummyData,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
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

/* ───── 유틸 ───── */

const SCREEN_WIDTH = Dimensions.get("window").width;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

function calcAge(birthDate: string): number | null {
  if (!isValidDateString(birthDate)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - by;
  const monthDiff = today.getMonth() + 1 - bm;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd)) {
    age--;
  }
  return age >= 0 ? age : null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_LIST = Array.from(
  { length: CURRENT_YEAR - 1920 + 1 },
  (_, i) => 1920 + i
).reverse();
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/* ───── 캘린더 팝업 컴포넌트 ───── */

type CalendarPopupProps = {
  visible: boolean;
  initialDate?: string;
  onSelect: (date: string) => void;
  onClose: () => void;
};

type PickerMode = "calendar" | "year" | "month";

function CalendarPopup({
  visible,
  initialDate,
  onSelect,
  onClose,
}: CalendarPopupProps) {
  const parseInitial = useCallback(() => {
    if (initialDate && isValidDateString(initialDate)) {
      const [y, m, d] = initialDate.split("-").map(Number);
      return { year: y, month: m, day: d };
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }, [initialDate]);

  const init = parseInitial();
  const [viewYear, setViewYear] = useState(init.year);
  const [viewMonth, setViewMonth] = useState(init.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(init.day);
  const [textValue, setTextValue] = useState(initialDate ?? "");
  const [pickerMode, setPickerMode] = useState<PickerMode>("calendar");
  const yearListRef = useRef<FlatList>(null);

  // sync state when popup opens
  React.useEffect(() => {
    if (visible) {
      const v = parseInitial();
      setViewYear(v.year);
      setViewMonth(v.month);
      setSelectedDay(v.day);
      setTextValue(initialDate ?? "");
      setPickerMode("calendar");
    }
  }, [visible, initialDate, parseInitial]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const dayGrid = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [daysInMonth, firstDay]);

  const handleTextSubmit = () => {
    const v = textValue.trim();
    if (!isValidDateString(v)) {
      Alert.alert("형식 오류", "YYYY-MM-DD 형식으로 입력해주세요.");
      return;
    }
    const [y] = v.split("-").map(Number);
    if (y < 1920 || y > CURRENT_YEAR) {
      Alert.alert("범위 오류", `연도는 1920~${CURRENT_YEAR} 사이여야 합니다.`);
      return;
    }
    onSelect(v);
    onClose();
  };

  const handleDayPress = (day: number) => {
    setSelectedDay(day);
    const mm = String(viewMonth).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${mm}-${dd}`;
    setTextValue(dateStr);
    onSelect(dateStr);
    onClose();
  };

  const handleYearSelect = (year: number) => {
    setViewYear(year);
    setPickerMode("calendar");
  };

  const handleMonthSelect = (month: number) => {
    setViewMonth(month);
    setPickerMode("calendar");
  };

  const goToPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const renderYearPicker = () => {
    const initialIndex = YEAR_LIST.indexOf(viewYear);
    return (
      <FlatList
        ref={yearListRef}
        data={YEAR_LIST}
        keyExtractor={(item) => String(item)}
        initialScrollIndex={Math.max(0, initialIndex)}
        getItemLayout={(_, index) => ({
          length: 48,
          offset: 48 * index,
          index,
        })}
        style={{ maxHeight: 300 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[cs.yearItem, item === viewYear && cs.yearItemSelected]}
            onPress={() => handleYearSelect(item)}
          >
            <Text
              style={[
                cs.yearItemText,
                item === viewYear && cs.yearItemTextSelected,
              ]}
            >
              {item}년
            </Text>
          </TouchableOpacity>
        )}
      />
    );
  };

  const renderMonthPicker = () => (
    <View style={cs.monthGrid}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <TouchableOpacity
          key={m}
          style={[cs.monthCell, m === viewMonth && cs.monthCellSelected]}
          onPress={() => handleMonthSelect(m)}
        >
          <Text
            style={[
              cs.monthCellText,
              m === viewMonth && cs.monthCellTextSelected,
            ]}
          >
            {m}월
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const today = new Date();
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1;
  const todayDay = today.getDate();

  const renderCalendar = () => (
    <View>
      {/* Weekday headers */}
      <View style={cs.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text
            key={label}
            style={[
              cs.weekdayLabel,
              i === 0 && { color: "#E53E3E" },
              i === 6 && { color: "#4299E1" },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
      {/* Day grid */}
      <View style={cs.dayGrid}>
        {dayGrid.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={cs.dayCell} />;
          }
          const isSelected = day === selectedDay;
          const isToday = isCurrentMonth && day === todayDay;
          return (
            <TouchableOpacity
              key={day}
              style={[
                cs.dayCell,
                isSelected && cs.dayCellSelected,
                isToday && !isSelected && cs.dayCellToday,
              ]}
              onPress={() => handleDayPress(day)}
            >
              <Text
                style={[
                  cs.dayCellText,
                  isSelected && cs.dayCellTextSelected,
                  isToday && !isSelected && cs.dayCellTodayText,
                  idx % 7 === 0 && !isSelected && { color: "#E53E3E" },
                  idx % 7 === 6 && !isSelected && { color: "#4299E1" },
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={cs.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={cs.popup}>
          {/* Text input at top */}
          <View style={cs.textInputRow}>
            <TextInput
              style={cs.textInput}
              value={textValue}
              onChangeText={setTextValue}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#A0AEC0"
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={handleTextSubmit}
              maxLength={10}
            />
            <TouchableOpacity
              style={cs.textInputBtn}
              onPress={handleTextSubmit}
            >
              <Text style={cs.textInputBtnText}>확인</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation header */}
          <View style={cs.navRow}>
            <TouchableOpacity onPress={goToPrevMonth} style={cs.navArrow}>
              <Text style={cs.navArrowText}>◀</Text>
            </TouchableOpacity>

            <View style={cs.navCenter}>
              <TouchableOpacity
                onPress={() =>
                  setPickerMode((m) => (m === "year" ? "calendar" : "year"))
                }
              >
                <Text style={cs.navTitle}>{viewYear}년</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setPickerMode((m) => (m === "month" ? "calendar" : "month"))
                }
              >
                <Text style={cs.navTitle}> {viewMonth}월</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={goToNextMonth} style={cs.navArrow}>
              <Text style={cs.navArrowText}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {pickerMode === "year" && renderYearPicker()}
          {pickerMode === "month" && renderMonthPicker()}
          {pickerMode === "calendar" && renderCalendar()}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* ───── 메인 화면 ───── */

export default function SettingsScreen() {
  const [recordCount, setRecordCount] = useState(0);
  const [height, setHeight] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | undefined>(
    undefined
  );
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => setRecordCount(data.length));
      loadUserSettings().then((settings) => {
        setHeight(settings.height != null ? String(settings.height) : "");
        setBirthDate(settings.birthDate ?? "");
        setGender(settings.gender);
        setSwipeEnabled(settings.swipeEnabled ?? false);
      });
    }, [])
  );

  const computedAge = birthDate ? calcAge(birthDate) : null;

  const handleSaveProfile = async () => {
    const h = height.trim() ? parseFloat(height) : undefined;

    if (h !== undefined && (isNaN(h) || h < 50 || h > 300)) {
      Alert.alert("입력 오류", "키는 50~300cm 사이의 숫자를 입력해주세요.");
      return;
    }

    const bd = birthDate.trim() || undefined;
    if (bd !== undefined) {
      if (!isValidDateString(bd)) {
        Alert.alert(
          "입력 오류",
          "생년월일은 YYYY-MM-DD 형식으로 입력해주세요."
        );
        return;
      }
      const [y] = bd.split("-").map(Number);
      if (y < 1920 || y > CURRENT_YEAR) {
        Alert.alert(
          "입력 오류",
          `연도는 1920~${CURRENT_YEAR} 사이여야 합니다.`
        );
        return;
      }
    }

    // age is computed from birthDate for backward compat
    const age = bd ? (calcAge(bd) ?? undefined) : undefined;

    await saveUserSettings({
      height: h,
      birthDate: bd,
      gender,
      age,
      swipeEnabled,
    });
    Alert.alert("저장 완료", "프로필 정보가 저장되었습니다.");
  };

  const handleSeedDummy = () => {
    Alert.alert(
      "더미 데이터 삽입",
      "약 1년치 랜덤 데이터를 생성합니다.\n기존 데이터는 모두 지워집니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "생성",
          onPress: async () => {
            const updated = await seedDummyData();
            setRecordCount(updated.length);
            Alert.alert(
              "완료 ✅",
              `${updated.length}개의 더미 데이터가 생성됐습니다.`
            );
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "전체 데이터 삭제",
      "모든 기록이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            await clearAllRecords();
            setRecordCount(0);
            Alert.alert("삭제 완료", "모든 기록이 삭제되었습니다.");
          },
        },
      ]
    );
  };

  return (
    <SwipeableTab currentIndex={5} enabled={swipeEnabled}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>⚙️ 설정</Text>

        {/* 프로필 정보 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>프로필 정보</Text>

          {/* 키 */}
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>키 (cm)</Text>
            <TextInput
              style={s.input}
              value={height}
              onChangeText={setHeight}
              placeholder="예: 175"
              placeholderTextColor="#A0AEC0"
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* 생년월일 */}
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>생년월일</Text>
            <View style={s.birthDateRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A0AEC0"
                keyboardType={
                  Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
                }
                returnKeyType="done"
                maxLength={10}
              />
              <TouchableOpacity
                style={s.calendarIconBtn}
                onPress={() => setCalendarVisible(true)}
              >
                <Text style={s.calendarIconText}>📅</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 나이 표시 */}
          {computedAge !== null && (
            <View style={s.ageInfoRow}>
              <Text style={s.ageInfoText}>만 {computedAge}세</Text>
            </View>
          )}

          {/* 성별 */}
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>성별</Text>
            <View style={s.genderToggle}>
              <TouchableOpacity
                style={[
                  s.genderBtn,
                  s.genderBtnLeft,
                  gender === "male" && s.genderBtnActive,
                ]}
                onPress={() => setGender("male")}
              >
                <Text
                  style={[
                    s.genderBtnText,
                    gender === "male" && s.genderBtnTextActive,
                  ]}
                >
                  남성
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.genderBtn,
                  s.genderBtnRight,
                  gender === "female" && s.genderBtnActive,
                ]}
                onPress={() => setGender("female")}
              >
                <Text
                  style={[
                    s.genderBtnText,
                    gender === "female" && s.genderBtnTextActive,
                  ]}
                >
                  여성
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={s.saveBtn} onPress={handleSaveProfile}>
            <Text style={s.saveBtnText}>저장</Text>
          </TouchableOpacity>
        </View>

        {/* 환경 설정 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>환경 설정</Text>
          <View style={s.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>좌우 스와이프로 탭 전환</Text>
              <Text style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}>
                화면을 좌우로 밀어 다른 탭으로 이동합니다
              </Text>
            </View>
            <Switch
              value={swipeEnabled}
              onValueChange={async (v) => {
                setSwipeEnabled(v);
                const cur = await loadUserSettings();
                await saveUserSettings({ ...cur, swipeEnabled: v });
              }}
              trackColor={{ false: "#E2E8F0", true: "#68D391" }}
              thumbColor={swipeEnabled ? "#38A169" : "#fff"}
            />
          </View>
        </View>

        {/* 데이터 정보 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>데이터 정보</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>총 기록 수</Text>
            <Text style={s.infoValue}>{recordCount}개</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>저장 위치</Text>
            <Text style={s.infoValue}>로컬 (AsyncStorage)</Text>
          </View>
        </View>

        {/* 개발자 도구 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>개발자 도구</Text>
          <TouchableOpacity style={s.actionBtn} onPress={handleSeedDummy}>
            <Text style={s.actionIcon}>🎲</Text>
            <View style={s.actionTextWrap}>
              <Text style={s.actionTitle}>더미 데이터 생성</Text>
              <Text style={s.actionDesc}>약 1년치 랜덤 테스트 데이터 삽입</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleClearAll}>
            <Text style={s.actionIcon}>🗑</Text>
            <View style={s.actionTextWrap}>
              <Text style={[s.actionTitle, { color: "#E53E3E" }]}>
                전체 데이터 삭제
              </Text>
              <Text style={s.actionDesc}>모든 기록을 영구 삭제합니다</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>앱 정보</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>앱 이름</Text>
            <Text style={s.infoValue}>Full Weight</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>버전</Text>
            <Text style={s.infoValue}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* 생년월일 캘린더 팝업 */}
      <CalendarPopup
        visible={calendarVisible}
        initialDate={birthDate}
        onSelect={(date) => setBirthDate(date)}
        onClose={() => setCalendarVisible(false)}
      />
    </SwipeableTab>
  );
}

/* ───── 메인 스타일 ───── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A202C",
    marginBottom: 24,
  },

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
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 16,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  inputLabel: { fontSize: 15, color: "#4A5568" },
  input: {
    fontSize: 15,
    fontWeight: "500",
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 120,
    textAlign: "right",
  },

  birthDateRow: {
    flexDirection: "row",
    alignItems: "center",
    width: 170,
  },
  calendarIconBtn: {
    marginLeft: 6,
    padding: 6,
  },
  calendarIconText: {
    fontSize: 22,
  },

  ageInfoRow: {
    paddingVertical: 6,
    paddingLeft: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  ageInfoText: {
    fontSize: 13,
    color: "#718096",
    textAlign: "right",
  },

  genderToggle: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  genderBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: "#F7FAFC",
  },
  genderBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
  },
  genderBtnRight: {},
  genderBtnActive: {
    backgroundColor: "#4299E1",
  },
  genderBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A5568",
  },
  genderBtnTextActive: {
    color: "#fff",
  },

  saveBtn: {
    backgroundColor: "#4299E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  infoLabel: { fontSize: 15, color: "#4A5568" },
  infoValue: { fontSize: 15, fontWeight: "500", color: "#2D3748" },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  actionIcon: { fontSize: 24, marginRight: 14 },
  actionTextWrap: { flex: 1 },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 2,
  },
  actionDesc: { fontSize: 12, color: "#A0AEC0" },
});

/* ───── 캘린더 팝업 스타일 ───── */

const POPUP_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);
const DAY_CELL_SIZE = Math.floor((POPUP_WIDTH - 40) / 7);

const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  popup: {
    width: POPUP_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: "80%",
  },

  /* text input */
  textInputRow: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "center",
  },
  textInputBtn: {
    marginLeft: 8,
    backgroundColor: "#4299E1",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textInputBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  /* navigation */
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navArrow: {
    padding: 8,
  },
  navArrowText: {
    fontSize: 14,
    color: "#4A5568",
  },
  navCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  navTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2D3748",
  },

  /* weekday */
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayLabel: {
    width: DAY_CELL_SIZE,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#A0AEC0",
    paddingVertical: 4,
  },

  /* day grid */
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: DAY_CELL_SIZE / 2,
  },
  dayCellSelected: {
    backgroundColor: "#4299E1",
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: "#4299E1",
  },
  dayCellText: {
    fontSize: 14,
    color: "#2D3748",
  },
  dayCellTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },
  dayCellTodayText: {
    color: "#4299E1",
    fontWeight: "600",
  },

  /* year picker */
  yearItem: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  yearItemSelected: {
    backgroundColor: "#EBF8FF",
  },
  yearItemText: {
    fontSize: 16,
    color: "#4A5568",
  },
  yearItemTextSelected: {
    color: "#4299E1",
    fontWeight: "700",
  },

  /* month picker */
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingVertical: 8,
  },
  monthCell: {
    width: "25%",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 8,
  },
  monthCellSelected: {
    backgroundColor: "#EBF8FF",
  },
  monthCellText: {
    fontSize: 15,
    color: "#4A5568",
  },
  monthCellTextSelected: {
    color: "#4299E1",
    fontWeight: "700",
  },
});
