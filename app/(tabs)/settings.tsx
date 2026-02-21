import { SwipeableTab } from "@/components/swipeable-tab";
import {
  BUILTIN_OPTIONAL_METRICS,
  CUSTOM_BOOL_COLORS,
  CUSTOM_METRIC_COLORS,
  CustomBoolMetric,
  CustomMetric,
} from "@/types";
import {
  exchangeCodeForToken,
  getBackupList,
  getLastBackupTime,
  getSignedInEmail,
  isSignedIn,
  performBackup,
  performRestore,
  shouldAutoBackup,
  signOut,
  useGoogleAuth,
} from "@/utils/backup";
import {
  calcAge,
  getDaysInMonth,
  getFirstDayOfWeek,
  isValidDateString,
  WEEKDAY_LABELS,
} from "@/utils/format";
import {
  clearAllRecords,
  loadRecords,
  loadUserSettings,
  saveUserSettings,
  seedDummyData,
} from "@/utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_LIST = Array.from(
  { length: CURRENT_YEAR - 1920 + 1 },
  (_, i) => 1920 + i
).reverse();

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

  const daysInMonth = getDaysInMonth(viewYear, viewMonth - 1);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth - 1);

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
  const [isEditing, setIsEditing] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockPin, setLockPin] = useState("");
  const [lockBiometric, setLockBiometric] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // ── 수치 관리 상태 ──
  const [metricInputVisibility, setMetricInputVisibility] = useState<
    Record<string, boolean>
  >({});
  const [metricDisplayVisibility, setMetricDisplayVisibility] = useState<
    Record<string, boolean>
  >({});
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [newMetricLabel, setNewMetricLabel] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [inputSectionOpen, setInputSectionOpen] = useState(false);
  const [inputMetricSubOpen, setInputMetricSubOpen] = useState(false);
  const [inputBoolSubOpen, setInputBoolSubOpen] = useState(false);
  const [displaySectionOpen, setDisplaySectionOpen] = useState(false);
  const [displayMetricSubOpen, setDisplayMetricSubOpen] = useState(false);
  const [displayBoolSubOpen, setDisplayBoolSubOpen] = useState(false);
  const [customBoolMetrics, setCustomBoolMetrics] = useState<
    CustomBoolMetric[]
  >([]);
  const [showAddBoolMetric, setShowAddBoolMetric] = useState(false);
  const [newBoolLabel, setNewBoolLabel] = useState("");
  const [newBoolEmoji, setNewBoolEmoji] = useState("");
  const [editingBoolEmojiKey, setEditingBoolEmojiKey] = useState<string | null>(
    null
  );
  const [editBoolEmoji, setEditBoolEmoji] = useState("");

  // ── Google Drive 백업 상태 ──
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [lastBackupStr, setLastBackupStr] = useState<string | null>(null);
  const [backupList, setBackupList] = useState<
    { id: string; name: string; createdTime: string; size?: string }[]
  >([]);
  const [showBackupList, setShowBackupList] = useState(false);
  const autoBackupTriggered = useRef(false);

  const { request, response, promptAsync, redirectUri } = useGoogleAuth();

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => setRecordCount(data.length));
      loadUserSettings().then((settings) => {
        setHeight(settings.height != null ? String(settings.height) : "");
        setBirthDate(settings.birthDate ?? "");
        setGender(settings.gender);
        setSwipeEnabled(settings.swipeEnabled ?? false);
        setLockEnabled(settings.lockEnabled ?? false);
        setLockPin(settings.lockPin ?? "");
        setLockBiometric(settings.lockBiometric ?? false);
        setMetricInputVisibility(settings.metricInputVisibility ?? {});
        setMetricDisplayVisibility(settings.metricDisplayVisibility ?? {});
        setCustomMetrics(settings.customMetrics ?? []);
        setCustomBoolMetrics(settings.customBoolMetrics ?? []);
      });

      // Google 로그인 상태 & 마지막 백업 시간 불러오기
      refreshGoogleState();
    }, [])
  );

  /** Google 로그인 상태 & 마지막 백업 시간 갱신 */
  const refreshGoogleState = async () => {
    const signedIn = await isSignedIn();
    setIsGoogleSignedIn(signedIn);
    if (signedIn) {
      const email = await getSignedInEmail();
      setGoogleEmail(email);
      const lastTs = await getLastBackupTime();
      if (lastTs) {
        const d = new Date(lastTs);
        setLastBackupStr(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
        );
      } else {
        setLastBackupStr(null);
      }
    } else {
      setGoogleEmail(null);
      setLastBackupStr(null);
    }
  };

  // Google OAuth 응답 처리
  useEffect(() => {
    if (response?.type === "success" && response.params?.code) {
      const code = response.params.code;
      const codeVerifier = request?.codeVerifier;
      if (codeVerifier) {
        (async () => {
          try {
            setBackupLoading(true);
            const { email } = await exchangeCodeForToken(
              code,
              codeVerifier,
              redirectUri
            );
            setIsGoogleSignedIn(true);
            setGoogleEmail(email);
            Alert.alert("로그인 성공", `${email}로 로그인했습니다.`);
            await refreshGoogleState();
          } catch (e: any) {
            Alert.alert("로그인 실패", e?.message ?? "알 수 없는 오류");
          } finally {
            setBackupLoading(false);
          }
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // 자동 백업 (24시간 간격, 탭 포커스 시 1회)
  useFocusEffect(
    useCallback(() => {
      if (autoBackupTriggered.current) return;
      (async () => {
        const needBackup = await shouldAutoBackup();
        if (needBackup) {
          autoBackupTriggered.current = true;
          const result = await performBackup();
          if (result.success) {
            await refreshGoogleState();
          }
        }
      })();
    }, [])
  );

  /** 수동 백업 */
  const handleManualBackup = async () => {
    setBackupLoading(true);
    const result = await performBackup();
    setBackupLoading(false);
    if (result.success) {
      Alert.alert("백업 완료", "Google Drive에 데이터가 백업되었습니다.");
      await refreshGoogleState();
    } else {
      Alert.alert("백업 실패", result.error ?? "알 수 없는 오류");
    }
  };

  /** 백업 목록 조회 & 표시 */
  const handleShowBackups = async () => {
    setBackupLoading(true);
    const result = await getBackupList();
    setBackupLoading(false);
    if (result.error) {
      Alert.alert("오류", result.error);
      return;
    }
    setBackupList(result.backups);
    setShowBackupList(true);
  };

  /** 복원 */
  const handleRestore = (fileId: string, fileName: string) => {
    Alert.alert(
      "데이터 복원",
      `"${fileName}" 백업에서 복원합니다.\n현재 데이터가 모두 덮어쓰기됩니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "복원",
          style: "destructive",
          onPress: async () => {
            setRestoreLoading(true);
            setShowBackupList(false);
            const result = await performRestore(fileId);
            setRestoreLoading(false);
            if (result.success) {
              // UI 새로고침
              const data = await loadRecords();
              setRecordCount(data.length);
              const settings = await loadUserSettings();
              setHeight(settings.height != null ? String(settings.height) : "");
              setBirthDate(settings.birthDate ?? "");
              setGender(settings.gender);
              Alert.alert(
                "복원 완료",
                "데이터가 성공적으로 복원되었습니다.\n앱을 다시 시작하면 모든 변경사항이 반영됩니다."
              );
            } else {
              Alert.alert("복원 실패", result.error ?? "알 수 없는 오류");
            }
          },
        },
      ]
    );
  };

  /** Google 로그아웃 */
  const handleGoogleSignOut = () => {
    Alert.alert("Google 로그아웃", "로그아웃하면 자동 백업이 중지됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await signOut();
          setIsGoogleSignedIn(false);
          setGoogleEmail(null);
          setLastBackupStr(null);
          setBackupList([]);
        },
      },
    ]);
  };

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

    const cur = await loadUserSettings();
    await saveUserSettings({
      ...cur,
      height: h,
      birthDate: bd,
      gender,
      age,
      swipeEnabled,
    });
    setIsEditing(false);
    Alert.alert("저장 완료", "프로필 정보가 저장되었습니다.");
  };

  const handleSeedDummy = () => {
    Alert.alert(
      "더미 데이터 삽입",
      "약 3년치 랜덤 데이터 + 챌린지 히스토리 10개를 생성합니다.\n기존 데이터는 모두 지워집니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "생성",
          onPress: async () => {
            const updated = await seedDummyData();
            setRecordCount(updated.length);
            Alert.alert(
              "완료",
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
            setCustomMetrics([]);
            setCustomBoolMetrics([]);
            Alert.alert(
              "삭제 완료",
              "모든 기록 및 사용자 정의 항목이 삭제되었습니다."
            );
          },
        },
      ]
    );
  };

  return (
    <SwipeableTab currentIndex={5} enabled={swipeEnabled}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* 프로필 정보 */}
        <View style={s.card}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={[s.cardTitle, { marginBottom: 0 }]}>프로필 정보</Text>
            {!isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                style={s.editIconBtn}
              >
                <Text style={s.editIconText}>수정</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 키 */}
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>키 (cm)</Text>
            {isEditing ? (
              <TextInput
                style={s.input}
                value={height}
                onChangeText={setHeight}
                placeholder="예: 175"
                placeholderTextColor="#A0AEC0"
                keyboardType="numeric"
                returnKeyType="done"
              />
            ) : (
              <Text style={s.readonlyValue}>
                {height ? `${height} cm` : "미설정"}
              </Text>
            )}
          </View>

          {/* 생년월일 */}
          <View style={s.inputRow}>
            <Text style={s.inputLabel}>생년월일</Text>
            {isEditing ? (
              <View style={s.birthDateRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A0AEC0"
                  keyboardType={
                    Platform.OS === "ios"
                      ? "numbers-and-punctuation"
                      : "default"
                  }
                  returnKeyType="done"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={s.calendarIconBtn}
                  onPress={() => setCalendarVisible(true)}
                >
                  <Text style={s.calendarIconText}></Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={s.readonlyValue}>{birthDate || "미설정"}</Text>
            )}
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
            {isEditing ? (
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
            ) : (
              <Text style={s.readonlyValue}>
                {gender === "male"
                  ? "남성"
                  : gender === "female"
                    ? "여성"
                    : "미설정"}
              </Text>
            )}
          </View>

          {isEditing && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1 }]}
                onPress={handleSaveProfile}
              >
                <Text style={s.saveBtnText}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { flex: 1, backgroundColor: "#EDF2F7" }]}
                onPress={() => {
                  setIsEditing(false);
                  // 원래 값 복원
                  loadUserSettings().then((settings) => {
                    setHeight(
                      settings.height != null ? String(settings.height) : ""
                    );
                    setBirthDate(settings.birthDate ?? "");
                    setGender(settings.gender);
                  });
                }}
              >
                <Text style={[s.saveBtnText, { color: "#718096" }]}>취소</Text>
              </TouchableOpacity>
            </View>
          )}
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

          {/* 앱 잠금 */}
          <View style={s.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>🔒 앱 잠금</Text>
              <Text style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}>
                {lockEnabled
                  ? "PIN 잠금이 활성화되어 있습니다"
                  : "앱 실행 시 PIN을 요구합니다"}
              </Text>
            </View>
            <Switch
              value={lockEnabled}
              onValueChange={async (v) => {
                if (v) {
                  setShowPinSetup(true);
                  setNewPin("");
                  setConfirmPin("");
                } else {
                  setLockEnabled(false);
                  setLockPin("");
                  const cur = await loadUserSettings();
                  await saveUserSettings({
                    ...cur,
                    lockEnabled: false,
                    lockPin: undefined,
                    lockBiometric: false,
                  });
                  setLockBiometric(false);
                  Alert.alert("잠금 해제", "앱 잠금이 비활성화되었습니다.");
                }
              }}
              trackColor={{ false: "#E2E8F0", true: "#F6AD55" }}
              thumbColor={lockEnabled ? "#DD6B20" : "#fff"}
            />
          </View>

          {lockEnabled && (
            <>
              <View style={s.infoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoLabel}>생체인증 (Face ID/지문)</Text>
                  <Text
                    style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}
                  >
                    PIN 대신 생체인증으로 잠금 해제
                  </Text>
                </View>
                <Switch
                  value={lockBiometric}
                  onValueChange={async (v) => {
                    setLockBiometric(v);
                    const cur = await loadUserSettings();
                    await saveUserSettings({ ...cur, lockBiometric: v });
                  }}
                  trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                  thumbColor={lockBiometric ? "#38A169" : "#fff"}
                />
              </View>
              <TouchableOpacity
                style={{ paddingVertical: 10 }}
                onPress={() => {
                  setShowPinSetup(true);
                  setNewPin("");
                  setConfirmPin("");
                }}
              >
                <Text
                  style={{ fontSize: 14, color: "#4299E1", fontWeight: "600" }}
                >
                  PIN 변경
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 수치 입력 설정 */}
        <View style={s.card}>
          <TouchableOpacity
            onPress={() => setInputSectionOpen((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            activeOpacity={0.7}
          >
            <Text style={s.cardTitle}>수치 입력 설정</Text>
            <Text style={{ fontSize: 16, color: "#A0AEC0", marginBottom: 2 }}>
              {inputSectionOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>
          {inputSectionOpen && (
            <Text
              style={{
                fontSize: 12,
                color: "#A0AEC0",
                marginBottom: 12,
                marginTop: 4,
              }}
            >
              기록 작성 시 표시할 입력란을 선택합니다
            </Text>
          )}

          {/* 서브: 기본 수치 + 사용자 정의 수치 */}
          {inputSectionOpen && (
            <View style={{ marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setInputMetricSubOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: inputMetricSubOpen ? 1 : 0,
                  borderBottomColor: "#EDF2F7",
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "#2D3748" }}
                >
                  수치 항목
                </Text>
                <Text style={{ fontSize: 14, color: "#A0AEC0" }}>
                  {inputMetricSubOpen ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>
              {inputMetricSubOpen && (
                <View style={{ marginTop: 8 }}>
                  {BUILTIN_OPTIONAL_METRICS.map((m) => (
                    <View key={m.key} style={s.infoRow}>
                      <Text style={s.infoLabel}>
                        {m.label} ({m.unit})
                      </Text>
                      <Switch
                        value={metricInputVisibility[m.key] !== false}
                        onValueChange={async (v) => {
                          const next = { ...metricInputVisibility, [m.key]: v };
                          setMetricInputVisibility(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            metricInputVisibility: next,
                          });
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                        thumbColor={
                          metricInputVisibility[m.key] !== false
                            ? "#38A169"
                            : "#fff"
                        }
                      />
                    </View>
                  ))}
                  {customMetrics.map((cm) => (
                    <View key={cm.key} style={s.infoRow}>
                      <Text style={s.infoLabel}>
                        {cm.label} ({cm.unit})
                      </Text>
                      <Switch
                        value={metricInputVisibility[cm.key] !== false}
                        onValueChange={async (v) => {
                          const next = {
                            ...metricInputVisibility,
                            [cm.key]: v,
                          };
                          setMetricInputVisibility(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            metricInputVisibility: next,
                          });
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                        thumbColor={
                          metricInputVisibility[cm.key] !== false
                            ? "#38A169"
                            : "#fff"
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 서브: 체크 항목 */}
          {inputSectionOpen && (
            <View>
              <TouchableOpacity
                onPress={() => setInputBoolSubOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: inputBoolSubOpen ? 1 : 0,
                  borderBottomColor: "#EDF2F7",
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "#2D3748" }}
                >
                  체크 항목
                </Text>
                <Text style={{ fontSize: 14, color: "#A0AEC0" }}>
                  {inputBoolSubOpen ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>
              {inputBoolSubOpen && (
                <View style={{ marginTop: 8 }}>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>🏃 운동</Text>
                    <Switch
                      value={metricInputVisibility["exercised"] !== false}
                      onValueChange={async (v) => {
                        const next = { ...metricInputVisibility, exercised: v };
                        setMetricInputVisibility(next);
                        const cur = await loadUserSettings();
                        await saveUserSettings({
                          ...cur,
                          metricInputVisibility: next,
                        });
                      }}
                      trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                      thumbColor={
                        metricInputVisibility["exercised"] !== false
                          ? "#38A169"
                          : "#fff"
                      }
                    />
                  </View>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>🍺 음주</Text>
                    <Switch
                      value={metricInputVisibility["drank"] !== false}
                      onValueChange={async (v) => {
                        const next = { ...metricInputVisibility, drank: v };
                        setMetricInputVisibility(next);
                        const cur = await loadUserSettings();
                        await saveUserSettings({
                          ...cur,
                          metricInputVisibility: next,
                        });
                      }}
                      trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                      thumbColor={
                        metricInputVisibility["drank"] !== false
                          ? "#38A169"
                          : "#fff"
                      }
                    />
                  </View>
                  {customBoolMetrics.map((cbm) => (
                    <View key={cbm.key} style={s.infoRow}>
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
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: cbm.color,
                          }}
                        />
                        <Text style={s.infoLabel}>
                          {cbm.emoji ? `${cbm.emoji} ` : ""}
                          {cbm.label}
                        </Text>
                      </View>
                      <Switch
                        value={metricInputVisibility[cbm.key] !== false}
                        onValueChange={async (v) => {
                          const next = {
                            ...metricInputVisibility,
                            [cbm.key]: v,
                          };
                          setMetricInputVisibility(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            metricInputVisibility: next,
                          });
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                        thumbColor={
                          metricInputVisibility[cbm.key] !== false
                            ? "#38A169"
                            : "#fff"
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 수치 표시 설정 */}
        <View style={s.card}>
          <TouchableOpacity
            onPress={() => setDisplaySectionOpen((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            activeOpacity={0.7}
          >
            <Text style={s.cardTitle}>수치 표시 설정</Text>
            <Text style={{ fontSize: 16, color: "#A0AEC0", marginBottom: 2 }}>
              {displaySectionOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>
          {displaySectionOpen && (
            <Text
              style={{
                fontSize: 12,
                color: "#A0AEC0",
                marginBottom: 12,
                marginTop: 4,
              }}
            >
              기록 목록, 그래프, 캘린더에서 표시할 수치를 선택합니다
            </Text>
          )}

          {/* 서브: 수치 항목 */}
          {displaySectionOpen && (
            <View style={{ marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setDisplayMetricSubOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: displayMetricSubOpen ? 1 : 0,
                  borderBottomColor: "#EDF2F7",
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "#2D3748" }}
                >
                  수치 항목
                </Text>
                <Text style={{ fontSize: 14, color: "#A0AEC0" }}>
                  {displayMetricSubOpen ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>
              {displayMetricSubOpen && (
                <View style={{ marginTop: 8 }}>
                  {BUILTIN_OPTIONAL_METRICS.map((m) => (
                    <View key={m.key} style={s.infoRow}>
                      <Text style={s.infoLabel}>
                        {m.label} ({m.unit})
                      </Text>
                      <Switch
                        value={metricDisplayVisibility[m.key] !== false}
                        onValueChange={async (v) => {
                          const next = {
                            ...metricDisplayVisibility,
                            [m.key]: v,
                          };
                          setMetricDisplayVisibility(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            metricDisplayVisibility: next,
                          });
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                        thumbColor={
                          metricDisplayVisibility[m.key] !== false
                            ? "#38A169"
                            : "#fff"
                        }
                      />
                    </View>
                  ))}
                  {customMetrics.map((cm) => (
                    <View key={cm.key} style={s.infoRow}>
                      <Text style={s.infoLabel}>
                        {cm.label} ({cm.unit})
                      </Text>
                      <Switch
                        value={metricDisplayVisibility[cm.key] !== false}
                        onValueChange={async (v) => {
                          const next = {
                            ...metricDisplayVisibility,
                            [cm.key]: v,
                          };
                          setMetricDisplayVisibility(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            metricDisplayVisibility: next,
                          });
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                        thumbColor={
                          metricDisplayVisibility[cm.key] !== false
                            ? "#38A169"
                            : "#fff"
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 서브: 체크 항목 */}
          {displaySectionOpen && (
            <View>
              <TouchableOpacity
                onPress={() => setDisplayBoolSubOpen((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: displayBoolSubOpen ? 1 : 0,
                  borderBottomColor: "#EDF2F7",
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "600", color: "#2D3748" }}
                >
                  체크 항목
                </Text>
                <Text style={{ fontSize: 14, color: "#A0AEC0" }}>
                  {displayBoolSubOpen ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>
              {displayBoolSubOpen && (
                <View style={{ marginTop: 8 }}>
                  {customBoolMetrics.map((cbm) => (
                    <View key={cbm.key} style={s.infoRow}>
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
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: cbm.color,
                          }}
                        />
                        <Text style={s.infoLabel}>
                          {cbm.emoji ? `${cbm.emoji} ` : ""}
                          {cbm.label}
                        </Text>
                      </View>
                      <Switch
                        value={metricDisplayVisibility[cbm.key] !== false}
                        onValueChange={async (v) => {
                          const next = {
                            ...metricDisplayVisibility,
                            [cbm.key]: v,
                          };
                          setMetricDisplayVisibility(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            metricDisplayVisibility: next,
                          });
                        }}
                        trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                        thumbColor={
                          metricDisplayVisibility[cbm.key] !== false
                            ? "#38A169"
                            : "#fff"
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 사용자 정의 수치 관리 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>사용자 정의 수치항목</Text>
          <Text
            style={{
              fontSize: 12,
              color: "#A0AEC0",
              marginBottom: 12,
              marginTop: -8,
            }}
          >
            원하는 수치를 직접 추가할 수 있습니다
          </Text>
          {customMetrics.map((cm) => (
            <View key={cm.key} style={s.infoRow}>
              <Text style={[s.infoLabel, { flex: 1 }]}>
                {cm.label} ({cm.unit})
              </Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    "수치 삭제",
                    `"${cm.label}" 수치를 삭제하시겠습니까?\n이미 입력된 데이터는 유지됩니다.`,
                    [
                      { text: "취소", style: "cancel" },
                      {
                        text: "삭제",
                        style: "destructive",
                        onPress: async () => {
                          const next = customMetrics.filter(
                            (c) => c.key !== cm.key
                          );
                          setCustomMetrics(next);
                          const cur = await loadUserSettings();
                          await saveUserSettings({
                            ...cur,
                            customMetrics: next,
                          });
                        },
                      },
                    ]
                  );
                }}
              >
                <Text
                  style={{ fontSize: 13, color: "#E53E3E", fontWeight: "600" }}
                >
                  삭제
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={{
              marginTop: 8,
              backgroundColor: "#EBF8FF",
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
            }}
            onPress={() => {
              setNewMetricLabel("");
              setNewMetricUnit("");
              setShowAddMetric(true);
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#3182CE" }}>
              + 수치 추가
            </Text>
          </TouchableOpacity>
        </View>

        {/* 사용자 정의 체크항목 관리 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>사용자 정의 체크항목</Text>
          <Text
            style={{
              fontSize: 12,
              color: "#A0AEC0",
              marginBottom: 12,
              marginTop: -8,
            }}
          >
            운동·음주처럼 체크(✓/✗)로 기록할 항목을 추가할 수 있습니다
          </Text>
          {customBoolMetrics.map((cbm) => (
            <View key={cbm.key} style={s.infoRow}>
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
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: cbm.color,
                  }}
                />
                <Text style={s.infoLabel}>
                  {cbm.emoji ? `${cbm.emoji} ` : ""}
                  {cbm.label}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setEditingBoolEmojiKey(cbm.key);
                    setEditBoolEmoji(cbm.emoji || "");
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#3182CE",
                      fontWeight: "600",
                    }}
                  >
                    {cbm.emoji ? "이모지 변경" : "이모지 추가"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      "항목 삭제",
                      `"${cbm.label}" 항목을 삭제하시겠습니까?\n이미 입력된 데이터는 유지됩니다.`,
                      [
                        { text: "취소", style: "cancel" },
                        {
                          text: "삭제",
                          style: "destructive",
                          onPress: async () => {
                            const next = customBoolMetrics.filter(
                              (c) => c.key !== cbm.key
                            );
                            setCustomBoolMetrics(next);
                            const cur = await loadUserSettings();
                            await saveUserSettings({
                              ...cur,
                              customBoolMetrics: next,
                            });
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#E53E3E",
                      fontWeight: "600",
                    }}
                  >
                    삭제
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={{
              marginTop: 8,
              backgroundColor: "#FFF5F5",
              borderRadius: 10,
              paddingVertical: 12,
              alignItems: "center",
            }}
            onPress={() => {
              setNewBoolLabel("");
              setNewBoolEmoji("");
              setShowAddBoolMetric(true);
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#E53E3E" }}>
              + 체크항목 추가
            </Text>
          </TouchableOpacity>
        </View>

        {/* 사용자 정의 체크항목 추가 모달 */}
        <Modal
          visible={showAddBoolMetric}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddBoolMetric(false)}
        >
          <TouchableOpacity
            style={s.pinModalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddBoolMetric(false)}
          >
            <View style={s.pinModalCard} onStartShouldSetResponder={() => true}>
              <Text style={s.pinModalTitle}>체크항목 추가</Text>
              <Text style={s.pinModalDesc}>
                체크로 기록할 항목의 이름을 입력하세요
              </Text>
              <View style={{ width: "100%", marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  이름
                </Text>
                <TextInput
                  style={[s.input, { width: "100%", textAlign: "left" }]}
                  value={newBoolLabel}
                  onChangeText={setNewBoolLabel}
                  placeholder="예: 스트레칭, 명상, 금연"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="next"
                />
              </View>
              <View style={{ width: "100%", marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  이모지 (선택)
                </Text>
                <TextInput
                  style={[s.input, { width: "100%", textAlign: "left" }]}
                  value={newBoolEmoji}
                  onChangeText={(t) => setNewBoolEmoji(t.slice(0, 2))}
                  placeholder="예: 🧘 💊 🚭"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="done"
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <TouchableOpacity
                  style={[s.saveBtn, { flex: 1, marginTop: 0 }]}
                  onPress={async () => {
                    const label = newBoolLabel.trim();
                    if (!label) {
                      Alert.alert("입력 오류", "항목 이름을 입력해주세요.");
                      return;
                    }
                    const key = `bool_${label}`;
                    if (customBoolMetrics.some((c) => c.key === key)) {
                      Alert.alert(
                        "입력 오류",
                        "같은 이름의 항목이 이미 존재합니다."
                      );
                      return;
                    }
                    const colorIdx =
                      customBoolMetrics.length % CUSTOM_BOOL_COLORS.length;
                    const color = CUSTOM_BOOL_COLORS[colorIdx];
                    const emoji = newBoolEmoji.trim() || undefined;
                    const newCbm: CustomBoolMetric = {
                      key,
                      label,
                      color,
                      emoji,
                    };
                    const next = [...customBoolMetrics, newCbm];
                    setCustomBoolMetrics(next);
                    const cur = await loadUserSettings();
                    await saveUserSettings({ ...cur, customBoolMetrics: next });
                    setShowAddBoolMetric(false);
                    Alert.alert(
                      "추가 완료",
                      `"${label}" 항목이 추가되었습니다.`
                    );
                  }}
                >
                  <Text style={s.saveBtnText}>추가</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.saveBtn,
                    { flex: 1, marginTop: 0, backgroundColor: "#EDF2F7" },
                  ]}
                  onPress={() => setShowAddBoolMetric(false)}
                >
                  <Text style={[s.saveBtnText, { color: "#718096" }]}>
                    취소
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 이모지 편집 모달 */}
        <Modal
          visible={editingBoolEmojiKey !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingBoolEmojiKey(null)}
        >
          <TouchableOpacity
            style={s.pinModalOverlay}
            activeOpacity={1}
            onPress={() => setEditingBoolEmojiKey(null)}
          >
            <View style={s.pinModalCard} onStartShouldSetResponder={() => true}>
              <Text style={s.pinModalTitle}>이모지 변경</Text>
              <Text style={s.pinModalDesc}>
                {customBoolMetrics.find((c) => c.key === editingBoolEmojiKey)
                  ?.label || ""}{" "}
                항목의 이모지를 변경합니다
              </Text>
              <View style={{ width: "100%", marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  이모지
                </Text>
                <TextInput
                  style={[s.input, { width: "100%", textAlign: "left" }]}
                  value={editBoolEmoji}
                  onChangeText={(t) => setEditBoolEmoji(t.slice(0, 2))}
                  placeholder="예: 🧘 💊 🚭 (비우면 제거)"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="done"
                  autoFocus
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <TouchableOpacity
                  style={[s.saveBtn, { flex: 1, marginTop: 0 }]}
                  onPress={async () => {
                    if (!editingBoolEmojiKey) return;
                    const emoji = editBoolEmoji.trim() || undefined;
                    const next = customBoolMetrics.map((c) =>
                      c.key === editingBoolEmojiKey ? { ...c, emoji } : c
                    );
                    setCustomBoolMetrics(next);
                    const cur = await loadUserSettings();
                    await saveUserSettings({ ...cur, customBoolMetrics: next });
                    setEditingBoolEmojiKey(null);
                  }}
                >
                  <Text style={s.saveBtnText}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.saveBtn,
                    { flex: 1, marginTop: 0, backgroundColor: "#EDF2F7" },
                  ]}
                  onPress={() => setEditingBoolEmojiKey(null)}
                >
                  <Text style={[s.saveBtnText, { color: "#718096" }]}>
                    취소
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 사용자 정의 수치 추가 모달 */}
        <Modal
          visible={showAddMetric}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddMetric(false)}
        >
          <TouchableOpacity
            style={s.pinModalOverlay}
            activeOpacity={1}
            onPress={() => setShowAddMetric(false)}
          >
            <View style={s.pinModalCard} onStartShouldSetResponder={() => true}>
              <Text style={s.pinModalTitle}>수치 추가</Text>
              <Text style={s.pinModalDesc}>
                기록할 수치의 이름과 단위를 입력하세요
              </Text>

              <View style={{ width: "100%", marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  이름
                </Text>
                <TextInput
                  style={[s.input, { width: "100%", textAlign: "left" }]}
                  value={newMetricLabel}
                  onChangeText={setNewMetricLabel}
                  placeholder="예: 악력, 혈압, 혈당"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="next"
                />
              </View>
              <View style={{ width: "100%", marginBottom: 20 }}>
                <Text
                  style={{ fontSize: 13, color: "#4A5568", marginBottom: 4 }}
                >
                  단위
                </Text>
                <TextInput
                  style={[s.input, { width: "100%", textAlign: "left" }]}
                  value={newMetricUnit}
                  onChangeText={setNewMetricUnit}
                  placeholder="예: kg, mmHg, mg/dL"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="done"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <TouchableOpacity
                  style={[s.saveBtn, { flex: 1, marginTop: 0 }]}
                  onPress={async () => {
                    const label = newMetricLabel.trim();
                    const unit = newMetricUnit.trim();
                    if (!label) {
                      Alert.alert("입력 오류", "수치 이름을 입력해주세요.");
                      return;
                    }
                    if (!unit) {
                      Alert.alert("입력 오류", "단위를 입력해주세요.");
                      return;
                    }
                    const key = `custom_${label}`;
                    if (customMetrics.some((c) => c.key === key)) {
                      Alert.alert(
                        "입력 오류",
                        "같은 이름의 수치가 이미 존재합니다."
                      );
                      return;
                    }
                    const colorIdx =
                      customMetrics.length % CUSTOM_METRIC_COLORS.length;
                    const color = CUSTOM_METRIC_COLORS[colorIdx];
                    const newCm: CustomMetric = { key, label, unit, color };
                    const next = [...customMetrics, newCm];
                    setCustomMetrics(next);
                    const cur = await loadUserSettings();
                    await saveUserSettings({ ...cur, customMetrics: next });
                    setShowAddMetric(false);
                    Alert.alert(
                      "추가 완료",
                      `"${label}" 수치가 추가되었습니다.`
                    );
                  }}
                >
                  <Text style={s.saveBtnText}>추가</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.saveBtn,
                    { flex: 1, marginTop: 0, backgroundColor: "#EDF2F7" },
                  ]}
                  onPress={() => setShowAddMetric(false)}
                >
                  <Text style={[s.saveBtnText, { color: "#718096" }]}>
                    취소
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* PIN 설정 모달 */}
        <Modal
          visible={showPinSetup}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPinSetup(false)}
        >
          <TouchableOpacity
            style={s.pinModalOverlay}
            activeOpacity={1}
            onPress={() => setShowPinSetup(false)}
          >
            <View style={s.pinModalCard} onStartShouldSetResponder={() => true}>
              <Text style={s.pinModalTitle}>
                {confirmPin !== "" || newPin.length === 4
                  ? "PIN 확인"
                  : "새 PIN 설정"}
              </Text>
              <Text style={s.pinModalDesc}>
                {newPin.length < 4
                  ? "4자리 숫자를 입력하세요"
                  : "한 번 더 입력하세요"}
              </Text>

              <View style={s.pinDotsRow}>
                {Array.from({ length: 4 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      s.pinDot,
                      i <
                        (newPin.length < 4
                          ? newPin.length
                          : confirmPin.length) && s.pinDotFilled,
                    ]}
                  />
                ))}
              </View>

              <View style={s.pinPadContainer}>
                {[
                  ["1", "2", "3"],
                  ["4", "5", "6"],
                  ["7", "8", "9"],
                  ["", "0", "del"],
                ].map((row, ri) => (
                  <View key={ri} style={s.pinPadRow}>
                    {row.map((key, ki) => {
                      if (key === "")
                        return <View key={ki} style={s.pinPadKey} />;
                      if (key === "del") {
                        return (
                          <TouchableOpacity
                            key={ki}
                            style={s.pinPadKey}
                            onPress={() => {
                              if (newPin.length < 4) {
                                setNewPin((p) => p.slice(0, -1));
                              } else {
                                setConfirmPin((p) => p.slice(0, -1));
                              }
                            }}
                          >
                            <Text style={s.pinPadSpecial}>⌫</Text>
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={ki}
                          style={s.pinPadKey}
                          onPress={async () => {
                            if (newPin.length < 4) {
                              const next = newPin + key;
                              setNewPin(next);
                            } else {
                              const next = confirmPin + key;
                              setConfirmPin(next);
                              if (next.length === 4) {
                                if (next === newPin) {
                                  setLockEnabled(true);
                                  setLockPin(newPin);
                                  const cur = await loadUserSettings();
                                  await saveUserSettings({
                                    ...cur,
                                    lockEnabled: true,
                                    lockPin: newPin,
                                  });
                                  setShowPinSetup(false);
                                  Alert.alert(
                                    "설정 완료",
                                    "앱 잠금이 활성화되었습니다."
                                  );
                                } else {
                                  Alert.alert(
                                    "불일치",
                                    "PIN이 일치하지 않습니다. 다시 시도하세요."
                                  );
                                  setNewPin("");
                                  setConfirmPin("");
                                }
                              }
                            }
                          }}
                        >
                          <Text style={s.pinPadText}>{key}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={{
                  marginTop: 12,
                  alignItems: "center",
                  paddingVertical: 8,
                }}
                onPress={() => setShowPinSetup(false)}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#718096" }}
                >
                  취소
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

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

        {/* Google 드라이브 백업 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Google 드라이브 백업</Text>

          {!isGoogleSignedIn ? (
            // 로그인 안 된 상태
            <View>
              <Text style={s.backupDesc}>
                Google 계정에 로그인하면 데이터와 사진이{"\n"}자동으로
                백업됩니다 (매일 1회).
              </Text>
              <TouchableOpacity
                style={s.googleSignInBtn}
                onPress={() => promptAsync()}
                disabled={!request || backupLoading}
              >
                {backupLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.googleSignInBtnText}>
                    Google 계정으로 로그인
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // 로그인 된 상태
            <View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>계정</Text>
                <Text style={[s.infoValue, { fontSize: 13 }]} numberOfLines={1}>
                  {googleEmail ?? "알 수 없음"}
                </Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>마지막 백업</Text>
                <Text style={s.infoValue}>{lastBackupStr ?? "없음"}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>자동 백업</Text>
                <Text style={[s.infoValue, { color: "#38A169" }]}>
                  매일 1회
                </Text>
              </View>

              <View style={s.backupBtnRow}>
                <TouchableOpacity
                  style={[s.backupActionBtn, { flex: 1 }]}
                  onPress={handleManualBackup}
                  disabled={backupLoading || restoreLoading}
                >
                  {backupLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.backupActionBtnText}>지금 백업</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.backupActionBtn,
                    { flex: 1, backgroundColor: "#48BB78" },
                  ]}
                  onPress={handleShowBackups}
                  disabled={backupLoading || restoreLoading}
                >
                  {restoreLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.backupActionBtnText}>복원</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={s.signOutBtn}
                onPress={handleGoogleSignOut}
              >
                <Text style={s.signOutBtnText}>로그아웃</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 백업 목록 모달 */}
        <Modal
          visible={showBackupList}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBackupList(false)}
        >
          <TouchableOpacity
            style={s.pinModalOverlay}
            activeOpacity={1}
            onPress={() => setShowBackupList(false)}
          >
            <View
              style={[s.pinModalCard, { width: SCREEN_WIDTH * 0.9 }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[s.pinModalTitle, { marginBottom: 16 }]}>
                백업 파일 목록
              </Text>

              {backupList.length === 0 ? (
                <Text
                  style={{
                    fontSize: 14,
                    color: "#A0AEC0",
                    textAlign: "center",
                    paddingVertical: 24,
                  }}
                >
                  백업 파일이 없습니다
                </Text>
              ) : (
                <View style={{ maxHeight: 300 }}>
                  {backupList.map((item) => {
                    const d = new Date(item.createdTime);
                    const dateLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                    const sizeKB = item.size
                      ? `${(parseInt(item.size, 10) / 1024).toFixed(1)}KB`
                      : "";
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={s.backupListItem}
                        onPress={() => handleRestore(item.id, item.name)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.backupListDate}>{dateLabel}</Text>
                          {sizeKB ? (
                            <Text style={s.backupListSize}>{sizeKB}</Text>
                          ) : null}
                        </View>
                        <Text style={s.backupListRestore}>복원</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={{
                  marginTop: 16,
                  alignItems: "center",
                  paddingVertical: 10,
                }}
                onPress={() => setShowBackupList(false)}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "600", color: "#718096" }}
                >
                  닫기
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 개발자 도구 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>개발자 도구</Text>
          <TouchableOpacity style={s.actionBtn} onPress={handleSeedDummy}>
            <Text style={s.actionIcon}></Text>
            <View style={s.actionTextWrap}>
              <Text style={s.actionTitle}>더미 데이터 생성</Text>
              <Text style={s.actionDesc}>약 1년치 랜덤 테스트 데이터 삽입</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleClearAll}>
            <Text style={s.actionIcon}></Text>
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

  editIconBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EBF8FF",
  },
  editIconText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3182CE",
  },
  readonlyValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#2D3748",
  },

  /* PIN 모달 */
  pinModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  pinModalCard: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    marginBottom: 4,
  },
  pinModalDesc: {
    fontSize: 13,
    color: "#718096",
    marginBottom: 20,
  },
  pinDotsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 24,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#CBD5E0",
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: "#4299E1",
    borderColor: "#4299E1",
  },
  pinPadContainer: {
    gap: 10,
  },
  pinPadRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  pinPadKey: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F7FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  pinPadText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#2D3748",
  },
  pinPadSpecial: {
    fontSize: 20,
    color: "#718096",
  },

  /* 백업 관련 */
  backupDesc: {
    fontSize: 13,
    color: "#718096",
    lineHeight: 20,
    marginBottom: 16,
  },
  googleSignInBtn: {
    backgroundColor: "#4285F4",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  googleSignInBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  backupBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  backupActionBtn: {
    backgroundColor: "#4299E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  backupActionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  signOutBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  signOutBtnText: {
    fontSize: 13,
    color: "#A0AEC0",
    fontWeight: "500",
  },
  backupListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4F8",
  },
  backupListDate: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2D3748",
  },
  backupListSize: {
    fontSize: 11,
    color: "#A0AEC0",
    marginTop: 2,
  },
  backupListRestore: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4299E1",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
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
