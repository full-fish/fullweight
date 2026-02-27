import { PaywallModal } from "@/components/paywall-modal";
import { useKeyboardOffset } from "@/hooks/use-keyboard-offset";
import { usePro } from "@/hooks/use-pro";
import {
  AiModelOption,
  BodyPhotoQuality,
  BUILTIN_OPTIONAL_METRICS,
  CUSTOM_BOOL_COLORS,
  CUSTOM_METRIC_COLORS,
  CustomBoolMetric,
  CustomMetric,
  FoodPhotoQuality,
} from "@/types";
import { getAiRemainingCount, resetAllAdCounters } from "@/utils/ad-manager";
import {
  getBackupIntervalDays,
  getBackupList,
  getLastBackupTime,
  getSignedInEmail,
  googleSignIn,
  isSignedIn,
  performBackup,
  performRestore,
  setBackupIntervalDays,
  shouldAutoBackup,
  signOut,
} from "@/utils/backup";
import { estimatePhotoSize, exportData, ExportFormat } from "@/utils/export";
import {
  calcAge,
  getDaysInMonth,
  getFirstDayOfWeek,
  isValidDateString,
  normalizeDateString,
  WEEKDAY_LABELS,
} from "@/utils/format";
import { importInBodyCSV } from "@/utils/inbody-import";
import {
  devGrantAiPro,
  devGrantBannerRemoval,
  logoutPurchases,
} from "@/utils/purchases";
import {
  clearAllRecords,
  loadRecords,
  loadUserSettings,
  saveUserSettings,
  seedDummyData,
} from "@/utils/storage";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Defs,
  Stop,
  Circle as SvgCircle,
  LinearGradient as SvgLinearGradient,
  Rect as SvgRect,
} from "react-native-svg";
/* ───── 유틸 ───── */

const SCREEN_WIDTH = Dimensions.get("window").width;

/* ───── HSV ↔ Hex 변환 유틸 ───── */
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(5))}${toHex(f(3))}${toHex(f(1))}`.toUpperCase();
}
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}
const ICON_GRID_COLS = 6;
const ICON_GRID_GAP = 8;
const ICON_CARD_CONTENT_W = SCREEN_WIDTH * 0.85 - 48;
const ICON_ITEM_SIZE = Math.floor(
  (ICON_CARD_CONTENT_W - (ICON_GRID_COLS - 1) * ICON_GRID_GAP) / ICON_GRID_COLS
);
const CP_W = ICON_CARD_CONTENT_W; // color picker width
const SV_H = Math.round(CP_W * 0.55); // SV panel height
const HUE_H = 24; // hue bar height

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_LIST = Array.from(
  { length: CURRENT_YEAR - 1920 + 1 },
  (_, i) => 1920 + i
).reverse();

/* ───── 아이콘 선택 목록 ───── */
const POPULAR_ICONS: { name: string; label: string; library?: "mci" }[] = [
  { name: "fitness-outline", label: "운동" },
  { name: "barbell-outline", label: "바벨" },
  { name: "bicycle-outline", label: "자전거" },
  { name: "walk-outline", label: "걷기" },
  { name: "water-outline", label: "물" },
  { name: "cafe-outline", label: "커피" },
  { name: "restaurant-outline", label: "식사" },
  { name: "bed-outline", label: "수면" },
  { name: "moon-outline", label: "달" },
  { name: "sunny-outline", label: "태양" },
  { name: "heart-outline", label: "하트" },
  { name: "medkit-outline", label: "약" },
  { name: "bandage-outline", label: "반창고" },
  { name: "book-outline", label: "책" },
  { name: "school-outline", label: "학교" },
  { name: "musical-notes-outline", label: "음악" },
  { name: "game-controller-outline", label: "게임" },
  { name: "happy-outline", label: "행복" },
  { name: "sad-outline", label: "슬픔" },
  { name: "flash-outline", label: "번개" },
  { name: "leaf-outline", label: "잎" },
  { name: "flower-outline", label: "꽃" },
  { name: "paw-outline", label: "발자국" },
  { name: "timer-outline", label: "타이머" },
  { name: "alarm-outline", label: "알람" },
  { name: "brush-outline", label: "브러시" },
  { name: "color-palette-outline", label: "팔레트" },
  { name: "camera-outline", label: "카메라" },
  { name: "beer-outline", label: "맥주" },
  { name: "wine-outline", label: "와인" },
  { name: "pizza-outline", label: "피자" },
  { name: "ice-cream-outline", label: "아이스크림" },
  { name: "star-outline", label: "별" },
  { name: "trophy-outline", label: "트로피" },
  { name: "flag-outline", label: "깃발" },
  { name: "checkmark-circle-outline", label: "체크" },
  { name: "snow-outline", label: "눈" },
  { name: "sparkles", label: "반짝" },
  { name: "rocket-outline", label: "로켓" },
  { name: "body-outline", label: "몸" },
  { name: "eye-outline", label: "눈(eye)" },
  { name: "thumbs-up-outline", label: "좋아요" },
  { name: "globe-outline", label: "지구" },
  { name: "smoking", label: "담배", library: "mci" },
  { name: "smoking-off", label: "금연", library: "mci" },
  { name: "pill", label: "알약", library: "mci" },
  { name: "meditation", label: "명상", library: "mci" },
  { name: "yoga", label: "요가", library: "mci" },
];

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
    const normalized = normalizeDateString(v);
    if (!normalized || !isValidDateString(normalized)) {
      Alert.alert(
        "형식 오류",
        "YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해주세요."
      );
      return;
    }
    const [y] = normalized.split("-").map(Number);
    if (y < 1920 || y > CURRENT_YEAR) {
      Alert.alert("범위 오류", `연도는 1920~${CURRENT_YEAR} 사이여야 합니다.`);
      return;
    }
    onSelect(normalized);
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
  const {
    aiPro,
    bannerRemoved,
    loading: proLoading,
    refresh: refreshPro,
  } = usePro();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [aiRemaining, setAiRemaining] = useState(2); // AI 남은 횟수
  const [height, setHeight] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | undefined>(
    undefined
  );
  const [calendarVisible, setCalendarVisible] = useState(false);
  const kbOffset = useKeyboardOffset();
  const [isEditing, setIsEditing] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
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
  const [newBoolIconName, setNewBoolIconName] = useState<string | undefined>(
    undefined
  );
  const [newBoolIconColor, setNewBoolIconColor] = useState<string>("#718096");
  const [newBoolColor, setNewBoolColor] = useState<string>(
    CUSTOM_BOOL_COLORS[0]
  );
  const [newPickerHue, setNewPickerHue] = useState(0);
  const [newPickerSat, setNewPickerSat] = useState(1);
  const [newPickerVal, setNewPickerVal] = useState(1);
  const [newHexInput, setNewHexInput] = useState("E91E63");
  const [newRInput, setNewRInput] = useState("233");
  const [newGInput, setNewGInput] = useState("30");
  const [newBInput, setNewBInput] = useState("99");
  const [editingBoolEmojiKey, setEditingBoolEmojiKey] = useState<string | null>(
    null
  );
  const [editBoolEmoji, setEditBoolEmoji] = useState("");
  const [editBoolIconName, setEditBoolIconName] = useState<string | undefined>(
    undefined
  );
  const [editBoolIconColor, setEditBoolIconColor] = useState<string>("#718096");
  const [editBoolColor, setEditBoolColor] = useState<string>(
    CUSTOM_BOOL_COLORS[0]
  );
  const [editPickerHue, setEditPickerHue] = useState(0);
  const [editPickerSat, setEditPickerSat] = useState(1);
  const [editPickerVal, setEditPickerVal] = useState(1);
  const [editHexInput, setEditHexInput] = useState("718096");
  const [editRInput, setEditRInput] = useState("113");
  const [editGInput, setEditGInput] = useState("128");
  const [editBInput, setEditBInput] = useState("150");

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
  const intervalRef = useRef<number | null>(null);
  const [backupIntervalDays, setBackupIntervalDaysState] = useState(1);
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  // ── 내보내기 상태 ──
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportIncludePhotos, setExportIncludePhotos] = useState(false);
  const [exportPhotoInfo, setExportPhotoInfo] = useState<{
    count: number;
    sizeBytes: number;
  } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [inbodyLoading, setInbodyLoading] = useState(false);

  // ── AI 모델 & 사진 화질 설정 ──
  const [aiModel, setAiModel] = useState<AiModelOption>("gpt-4o-mini");
  const [bodyPhotoQuality, setBodyPhotoQuality] =
    useState<BodyPhotoQuality>("compressed");
  const [foodPhotoQuality, setFoodPhotoQuality] =
    useState<FoodPhotoQuality>("compressed");

  useFocusEffect(
    useCallback(() => {
      loadRecords().then((data) => {
        setRecordCount(data.length);
      });
      // AI 남은 횟수 로드
      getAiRemainingCount().then(setAiRemaining);
      loadUserSettings().then((settings) => {
        setHeight(settings.height != null ? String(settings.height) : "");
        setBirthDate(settings.birthDate ?? "");
        setGender(settings.gender);
        setLockEnabled(settings.lockEnabled ?? false);
        setLockBiometric(settings.lockBiometric ?? false);
        setMetricInputVisibility(settings.metricInputVisibility ?? {});
        setMetricDisplayVisibility(settings.metricDisplayVisibility ?? {});
        setCustomMetrics(settings.customMetrics ?? []);
        setCustomBoolMetrics(settings.customBoolMetrics ?? []);
        setAiModel(settings.aiModel ?? "gpt-4o-mini");
        setBodyPhotoQuality(settings.bodyPhotoQuality ?? "compressed");
        setFoodPhotoQuality(settings.foodPhotoQuality ?? "compressed");
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
    // 백업 주기 로드
    const interval = await getBackupIntervalDays();
    setBackupIntervalDaysState(interval);
  };

  // Google 로그인 핸들러 (네이티브 Google Sign-In)
  const handleGoogleLogin = async () => {
    try {
      setBackupLoading(true);
      const { email } = await googleSignIn();
      setIsGoogleSignedIn(true);
      setGoogleEmail(email);
      Alert.alert("로그인 성공", `${email}로 로그인했습니다.`);
      await refreshGoogleState();
    } catch (e: any) {
      console.error("[settings] Google 로그인 실패:", e);
      Alert.alert("로그인 실패", e?.message ?? "알 수 없는 오류");
    } finally {
      setBackupLoading(false);
    }
  };

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
    Alert.alert(
      "백업 확인",
      "Google Drive에 데이터를 백업합니다.\n\n" +
        "• 최대 5개까지 저장되며, 초과 시 가장 오래된 파일부터 자동 삭제됩니다.\n" +
        "• Google Drive에 남은 저장 공간이 필요합니다.\n\n" +
        "백업을 진행할까요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "백업",
          onPress: async () => {
            setBackupLoading(true);
            const result = await performBackup();
            setBackupLoading(false);
            if (result.success) {
              Alert.alert(
                "백업 완료",
                "Google Drive에 데이터가 백업되었습니다."
              );
              await refreshGoogleState();
            } else {
              Alert.alert("백업 실패", result.error ?? "알 수 없는 오류");
            }
          },
        },
      ]
    );
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

    let bd = birthDate.trim() || undefined;
    if (bd !== undefined) {
      // YYYYMMDD → YYYY-MM-DD 자동 변환
      const normalized = normalizeDateString(bd);
      if (!normalized || !isValidDateString(normalized)) {
        Alert.alert(
          "입력 오류",
          "생년월일은 YYYYMMDD 또는 YYYY-MM-DD 형식으로 입력해주세요."
        );
        return;
      }
      bd = normalized;
      setBirthDate(bd);
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
    });
    setIsEditing(false);
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

  /* ── 내보내기 ── */
  const handleOpenExport = async () => {
    setShowExportModal(true);
    setExportIncludePhotos(false);
    try {
      const info = await estimatePhotoSize();
      setExportPhotoInfo(info);
    } catch {
      setExportPhotoInfo({ count: 0, sizeBytes: 0 });
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExportLoading(true);
    try {
      const fileName = await exportData(format, exportIncludePhotos);
      setShowExportModal(false);
      Alert.alert(
        "저장 완료 ✅",
        `${fileName}\n\n다운로드 폴더에 저장되었습니다.`
      );
    } catch (e: any) {
      if (e?.message === "CANCELED") return; // 사용자 취소 → 알림 없음
      Alert.alert(
        "내보내기 실패",
        e?.message ?? "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setExportLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ── 인바디 가져오기 ── */
  const handleInBodyImport = async () => {
    setInbodyLoading(true);
    try {
      const result = await importInBodyCSV();
      Alert.alert(
        "가져오기 완료",
        `인바디 데이터 ${result.totalInBody}건 처리\n` +
          `\u2022 새로 추가: ${result.newCount}건\n` +
          `\u2022 기존 기록 업데이트: ${result.updatedCount}건`
      );
      // 기록 수 새로고침
      loadRecords().then((data) => setRecordCount(data.length));
    } catch (e: any) {
      if (e?.message?.includes("취소")) return; // 사용자 취소는 알림 없음
      Alert.alert(
        "가져오기 실패",
        e?.message ?? "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setInbodyLoading(false);
    }
  };

  const handleClearAll = async () => {
    // 1) 체중·식사·챌린지·사용자정의 삭제
    await clearAllRecords();
    // 2) 광고 카운터 초기화 (AI 일일횟수, 체중저장 누적)
    await resetAllAdCounters();
    // 3) RevenueCat 로그아웃 (익명으로 전환)
    await logoutPurchases();
    // 4) Google 로그인 해제
    try {
      await signOut();
    } catch {}
    // 5) 상태 초기화
    setRecordCount(0);
    setCustomMetrics([]);
    setCustomBoolMetrics([]);
    setAiRemaining(2);
    // 프로필 UI 초기화
    setHeight("");
    setBirthDate("");
    setGender(undefined);
    setAiModel("gpt-4o-mini");
    setLockEnabled(false);
    await refreshPro();
    setShowDeleteConfirm(false);
    setDeleteInput("");
    Alert.alert("삭제 완료", "모든 기록, 프로필, 멤버십이 초기화되었습니다.");
  };

  return (
    <View style={{ flex: 1 }}>
      <PaywallModal
        visible={paywallVisible}
        onClose={() => {
          setPaywallVisible(false);
          refreshPro();
        }}
      />
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        {/* ─── 멤버십 상태 ─── */}
        {!proLoading && (
          <>
            {aiPro ? (
              /* AI PRO 구독 중 */
              <View
                style={[
                  s.card,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: "#F0FFF4",
                    borderWidth: 1,
                    borderColor: "#68D391",
                    marginBottom: 16,
                  },
                ]}
              >
                <Text style={{ fontSize: 28 }}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#276749",
                    }}
                  >
                    AI PRO 구독 중
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: "#48BB78", marginTop: 2 }}
                  >
                    무제한 AI · gpt-4o · 모든 광고 제거
                  </Text>
                </View>
              </View>
            ) : bannerRemoved ? (
              /* 배너 광고 제거만 구매 */
              <TouchableOpacity
                style={[
                  s.card,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: "#EBF8FF",
                    borderWidth: 1,
                    borderColor: "#90CDF4",
                    marginBottom: 16,
                  },
                ]}
                onPress={() => setPaywallVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 28 }}>🚫</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#2B6CB0",
                    }}
                  >
                    배너 광고 제거됨
                  </Text>
                  <Text
                    style={{ fontSize: 13, color: "#4299E1", marginTop: 2 }}
                  >
                    AI PRO 구독으로 더 많은 혜택을 받아보세요
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#90CDF4" />
              </TouchableOpacity>
            ) : (
              /* 미구매 — 스토어 배너 */
              <TouchableOpacity
                style={[
                  s.card,
                  {
                    backgroundColor: "#1A202C",
                    marginBottom: 16,
                    overflow: "hidden",
                  },
                ]}
                onPress={() => setPaywallVisible(true)}
                activeOpacity={0.85}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Ionicons name="storefront-outline" size={28} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "800",
                        color: "#fff",
                      }}
                    >
                      스토어
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.65)",
                        marginTop: 3,
                      }}
                    >
                      광고 제거 · AI 구독 · 개발자 응원
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="rgba(255,255,255,0.5)"
                  />
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ─── 프로필 ─── */}
        <Text style={s.sectionHeader}>프로필</Text>

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
                  placeholder="YYYYMMDD 또는 YYYY-MM-DD"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="number-pad"
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
          <Text style={s.cardTitle}>보안</Text>

          {/* 앱 잠금 */}
          <View style={s.infoRow}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
              }}
            >
              <View style={{ marginRight: 8 }}>
                <Entypo
                  name={lockEnabled ? "lock" : "lock-open"}
                  size={20}
                  color="#bfb41f"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infoLabel}>앱 잠금</Text>
                <Text style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}>
                  {lockEnabled
                    ? "PIN 잠금이 활성화되어 있습니다"
                    : "앱 실행 시 PIN을 요구합니다"}
                </Text>
              </View>
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
              trackColor={{ false: "#E2E8F0", true: "#bfb41f" }}
              thumbColor={lockEnabled ? "#bfb41f" : "#fff"}
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

        {/* ─── 항목 관리 ─── */}
        <Text style={s.sectionHeader}>항목 관리</Text>

        {/* 항목 입력 설정 */}
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
            <Text style={s.cardTitle}>항목 입력 설정</Text>
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
                        {cbm.iconName ? (
                          cbm.iconLibrary === "mci" ? (
                            <MaterialCommunityIcons
                              name={cbm.iconName as any}
                              size={16}
                              color={cbm.iconColor || cbm.color}
                            />
                          ) : (
                            <Ionicons
                              name={cbm.iconName as any}
                              size={16}
                              color={cbm.iconColor || cbm.color}
                            />
                          )
                        ) : (
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: cbm.color,
                            }}
                          />
                        )}
                        <Text style={s.infoLabel}>
                          {!cbm.iconName && cbm.emoji ? `${cbm.emoji} ` : ""}
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

        {/* 항목 표시 설정 */}
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
            <Text style={s.cardTitle}>항목 표시 설정</Text>
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
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>🏃 운동</Text>
                    <Switch
                      value={metricDisplayVisibility["exercised"] !== false}
                      onValueChange={async (v) => {
                        const next = {
                          ...metricDisplayVisibility,
                          exercised: v,
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
                        metricDisplayVisibility["exercised"] !== false
                          ? "#38A169"
                          : "#fff"
                      }
                    />
                  </View>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>🍺 음주</Text>
                    <Switch
                      value={metricDisplayVisibility["drank"] !== false}
                      onValueChange={async (v) => {
                        const next = { ...metricDisplayVisibility, drank: v };
                        setMetricDisplayVisibility(next);
                        const cur = await loadUserSettings();
                        await saveUserSettings({
                          ...cur,
                          metricDisplayVisibility: next,
                        });
                      }}
                      trackColor={{ false: "#E2E8F0", true: "#68D391" }}
                      thumbColor={
                        metricDisplayVisibility["drank"] !== false
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
                        {cbm.iconName ? (
                          cbm.iconLibrary === "mci" ? (
                            <MaterialCommunityIcons
                              name={cbm.iconName as any}
                              size={16}
                              color={cbm.iconColor || cbm.color}
                            />
                          ) : (
                            <Ionicons
                              name={cbm.iconName as any}
                              size={16}
                              color={cbm.iconColor || cbm.color}
                            />
                          )
                        ) : (
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: cbm.color,
                            }}
                          />
                        )}
                        <Text style={s.infoLabel}>
                          {!cbm.iconName && cbm.emoji ? `${cbm.emoji} ` : ""}
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
            운동·음주처럼 ✓로 기록할 항목을 추가할 수 있습니다
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
                {cbm.iconName ? (
                  cbm.iconLibrary === "mci" ? (
                    <MaterialCommunityIcons
                      name={cbm.iconName as any}
                      size={18}
                      color={cbm.iconColor || cbm.color}
                    />
                  ) : (
                    <Ionicons
                      name={cbm.iconName as any}
                      size={18}
                      color={cbm.iconColor || cbm.color}
                    />
                  )
                ) : (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: cbm.color,
                    }}
                  />
                )}
                <Text style={s.infoLabel}>
                  {!cbm.iconName && cbm.emoji ? `${cbm.emoji} ` : ""}
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
                    setEditBoolIconName(cbm.iconName);
                    const initColor = cbm.iconColor || cbm.color || "#718096";
                    setEditBoolIconColor(initColor);
                    setEditBoolColor(cbm.color);
                    const [h, s, v] = hexToHsv(initColor);
                    setEditPickerHue(h);
                    setEditPickerSat(s);
                    setEditPickerVal(v);
                    setEditHexInput(initColor.slice(1));
                    const [r0, g0, b0] = hexToRgb(initColor);
                    setEditRInput(String(r0));
                    setEditGInput(String(g0));
                    setEditBInput(String(b0));
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#3182CE",
                      fontWeight: "600",
                    }}
                  >
                    수정
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
              setNewBoolIconName(undefined);
              const initColor =
                CUSTOM_BOOL_COLORS[
                  customBoolMetrics.length % CUSTOM_BOOL_COLORS.length
                ];
              setNewBoolIconColor(initColor);
              setNewBoolColor(initColor);
              const [h, s, v] = hexToHsv(initColor);
              setNewPickerHue(h);
              setNewPickerSat(s);
              setNewPickerVal(v);
              setNewHexInput(initColor.slice(1));
              const [r0, g0, b0] = hexToRgb(initColor);
              setNewRInput(String(r0));
              setNewGInput(String(g0));
              setNewBInput(String(b0));
              setShowAddBoolMetric(true);
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#E53E3E" }}>
              + 체크항목 추가
            </Text>
          </TouchableOpacity>
        </View>

        {/* 사용자 정의 체크항목 추가 모달 */}
        {showAddBoolMetric && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setShowAddBoolMetric(false)}
          >
            <View style={s.pinModalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setShowAddBoolMetric(false)}
              />
              <View
                style={[
                  s.pinModalCard,
                  { maxHeight: "85%", transform: [{ translateY: kbOffset }] },
                ]}
              >
                <ScrollView
                  style={{ width: "100%" }}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  <Text style={s.pinModalTitle}>체크항목 추가</Text>
                  <Text style={s.pinModalDesc}>
                    체크로 기록할 항목의 이름을 입력하세요
                  </Text>

                  {/* 미리보기 */}
                  <View style={{ alignItems: "center", marginBottom: 16 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor:
                          (newBoolIconName ? newBoolIconColor : newBoolColor) +
                          "22",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {newBoolIconName ? (
                        POPULAR_ICONS.find((i) => i.name === newBoolIconName)
                          ?.library === "mci" ? (
                          <MaterialCommunityIcons
                            name={newBoolIconName as any}
                            size={28}
                            color={newBoolIconColor}
                          />
                        ) : (
                          <Ionicons
                            name={newBoolIconName as any}
                            size={28}
                            color={newBoolIconColor}
                          />
                        )
                      ) : newBoolEmoji ? (
                        <Text style={{ fontSize: 28 }}>{newBoolEmoji}</Text>
                      ) : (
                        <Text style={{ fontSize: 28, color: "#CBD5E0" }}>
                          ?
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* 이름 */}
                  <View style={{ width: "100%", marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 4,
                      }}
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

                  {/* 이모지 직접 입력 */}
                  <View style={{ width: "100%", marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 4,
                      }}
                    >
                      이모지 직접 입력 (선택)
                    </Text>
                    <TextInput
                      style={[s.input, { width: "100%", textAlign: "left" }]}
                      value={newBoolEmoji}
                      onChangeText={(t) => {
                        setNewBoolEmoji(t.slice(0, 2));
                        if (t.trim()) setNewBoolIconName(undefined);
                      }}
                      placeholder="예: 🧘 💊 🚭"
                      placeholderTextColor="#A0AEC0"
                      returnKeyType="done"
                    />
                  </View>

                  {/* 아이콘 선택 */}
                  <View style={{ width: "100%", marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 8,
                      }}
                    >
                      또는 아이콘 선택
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: ICON_GRID_GAP,
                      }}
                    >
                      {POPULAR_ICONS.map((icon) => (
                        <TouchableOpacity
                          key={icon.name}
                          onPress={() => {
                            setNewBoolIconName(icon.name);
                            setNewBoolEmoji("");
                          }}
                          style={{
                            width: ICON_ITEM_SIZE,
                            height: ICON_ITEM_SIZE,
                            borderRadius: 12,
                            backgroundColor:
                              newBoolIconName === icon.name
                                ? newBoolIconColor + "22"
                                : "#F7FAFC",
                            borderWidth: newBoolIconName === icon.name ? 2 : 1,
                            borderColor:
                              newBoolIconName === icon.name
                                ? newBoolIconColor
                                : "#E2E8F0",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          {icon.library === "mci" ? (
                            <MaterialCommunityIcons
                              name={icon.name as any}
                              size={22}
                              color={
                                newBoolIconName === icon.name
                                  ? newBoolIconColor
                                  : "#718096"
                              }
                            />
                          ) : (
                            <Ionicons
                              name={icon.name as any}
                              size={22}
                              color={
                                newBoolIconName === icon.name
                                  ? newBoolIconColor
                                  : "#718096"
                              }
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 색상 선택 — 컬러 피커 */}
                  <View style={{ width: "100%", marginBottom: 20 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 8,
                      }}
                    >
                      색상
                    </Text>
                    {/* SV 패널 */}
                    <View
                      style={{
                        width: CP_W,
                        height: SV_H,
                        borderRadius: 10,
                        overflow: "hidden",
                        marginBottom: 12,
                      }}
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={(e) => {
                        const { locationX, locationY } = e.nativeEvent;
                        const s2 = Math.max(0, Math.min(1, locationX / CP_W));
                        const v2 = Math.max(
                          0,
                          Math.min(1, 1 - locationY / SV_H)
                        );
                        setNewPickerSat(s2);
                        setNewPickerVal(v2);
                        const hex = hsvToHex(newPickerHue, s2, v2);
                        setNewBoolIconColor(hex);
                        setNewBoolColor(hex);
                        setNewHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setNewRInput(String(r0));
                        setNewGInput(String(g0));
                        setNewBInput(String(b0));
                      }}
                      onResponderMove={(e) => {
                        const { locationX, locationY } = e.nativeEvent;
                        const s2 = Math.max(0, Math.min(1, locationX / CP_W));
                        const v2 = Math.max(
                          0,
                          Math.min(1, 1 - locationY / SV_H)
                        );
                        setNewPickerSat(s2);
                        setNewPickerVal(v2);
                        const hex = hsvToHex(newPickerHue, s2, v2);
                        setNewBoolIconColor(hex);
                        setNewBoolColor(hex);
                        setNewHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setNewRInput(String(r0));
                        setNewGInput(String(g0));
                        setNewBInput(String(b0));
                      }}
                    >
                      <Svg width={CP_W} height={SV_H}>
                        <Defs>
                          <SvgLinearGradient
                            id="newSat"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <Stop offset="0" stopColor="#FFFFFF" />
                            <Stop
                              offset="1"
                              stopColor={`hsl(${newPickerHue}, 100%, 50%)`}
                            />
                          </SvgLinearGradient>
                          <SvgLinearGradient
                            id="newVal"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <Stop
                              offset="0"
                              stopColor="rgba(0,0,0,0)"
                              stopOpacity="0"
                            />
                            <Stop offset="1" stopColor="#000" stopOpacity="1" />
                          </SvgLinearGradient>
                        </Defs>
                        <SvgRect
                          width={CP_W}
                          height={SV_H}
                          fill="url(#newSat)"
                        />
                        <SvgRect
                          width={CP_W}
                          height={SV_H}
                          fill="url(#newVal)"
                        />
                        <SvgCircle
                          cx={newPickerSat * CP_W}
                          cy={(1 - newPickerVal) * SV_H}
                          r={9}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={3}
                        />
                      </Svg>
                    </View>
                    {/* 휴 슬라이더 */}
                    <View
                      style={{
                        width: CP_W,
                        height: HUE_H,
                        borderRadius: HUE_H / 2,
                        overflow: "hidden",
                        marginBottom: 12,
                      }}
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={(e) => {
                        const h2 = Math.max(
                          0,
                          Math.min(360, (e.nativeEvent.locationX / CP_W) * 360)
                        );
                        setNewPickerHue(h2);
                        const hex = hsvToHex(h2, newPickerSat, newPickerVal);
                        setNewBoolIconColor(hex);
                        setNewBoolColor(hex);
                        setNewHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setNewRInput(String(r0));
                        setNewGInput(String(g0));
                        setNewBInput(String(b0));
                      }}
                      onResponderMove={(e) => {
                        const h2 = Math.max(
                          0,
                          Math.min(360, (e.nativeEvent.locationX / CP_W) * 360)
                        );
                        setNewPickerHue(h2);
                        const hex = hsvToHex(h2, newPickerSat, newPickerVal);
                        setNewBoolIconColor(hex);
                        setNewBoolColor(hex);
                        setNewHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setNewRInput(String(r0));
                        setNewGInput(String(g0));
                        setNewBInput(String(b0));
                      }}
                    >
                      <Svg width={CP_W} height={HUE_H}>
                        <Defs>
                          <SvgLinearGradient
                            id="newHue"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <Stop offset="0" stopColor="hsl(0,100%,50%)" />
                            <Stop offset="0.167" stopColor="hsl(60,100%,50%)" />
                            <Stop
                              offset="0.333"
                              stopColor="hsl(120,100%,50%)"
                            />
                            <Stop offset="0.5" stopColor="hsl(180,100%,50%)" />
                            <Stop
                              offset="0.667"
                              stopColor="hsl(240,100%,50%)"
                            />
                            <Stop
                              offset="0.833"
                              stopColor="hsl(300,100%,50%)"
                            />
                            <Stop offset="1" stopColor="hsl(360,100%,50%)" />
                          </SvgLinearGradient>
                        </Defs>
                        <SvgRect
                          width={CP_W}
                          height={HUE_H}
                          rx={HUE_H / 2}
                          fill="url(#newHue)"
                        />
                        <SvgCircle
                          cx={Math.max(
                            HUE_H / 2,
                            Math.min(
                              CP_W - HUE_H / 2,
                              (newPickerHue / 360) * CP_W
                            )
                          )}
                          cy={HUE_H / 2}
                          r={HUE_H / 2 - 2}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={3}
                        />
                      </Svg>
                    </View>
                    {/* 미리보기 + Hex + RGB 입력 */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: newBoolIconColor,
                          borderWidth: 2,
                          borderColor: "#E2E8F0",
                        }}
                      />
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          height: 36,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#E2E8F0",
                          paddingHorizontal: 8,
                          width: 100,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#718096",
                            fontFamily: "monospace",
                          }}
                        >
                          #
                        </Text>
                        <TextInput
                          style={{
                            flex: 1,
                            height: 36,
                            fontSize: 13,
                            fontFamily: "monospace",
                            color: "#2D3748",
                            paddingVertical: 0,
                          }}
                          value={newHexInput}
                          onChangeText={(text) => {
                            const cleaned = text
                              .replace(/[^0-9A-Fa-f]/g, "")
                              .slice(0, 6);
                            setNewHexInput(cleaned);
                            if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
                              const full = "#" + cleaned;
                              const [h, s2, v2] = hexToHsv(full);
                              setNewPickerHue(h);
                              setNewPickerSat(s2);
                              setNewPickerVal(v2);
                              setNewBoolIconColor(full.toUpperCase());
                              setNewBoolColor(full.toUpperCase());
                              const [r0, g0, b0] = hexToRgb(full);
                              setNewRInput(String(r0));
                              setNewGInput(String(g0));
                              setNewBInput(String(b0));
                            }
                          }}
                          onBlur={() =>
                            setNewHexInput(newBoolIconColor.slice(1))
                          }
                          placeholder="RRGGBB"
                          placeholderTextColor="#A0AEC0"
                          autoCapitalize="characters"
                          maxLength={6}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(
                        [
                          {
                            label: "R",
                            val: newRInput,
                            set: setNewRInput,
                            ch: 0,
                          },
                          {
                            label: "G",
                            val: newGInput,
                            set: setNewGInput,
                            ch: 1,
                          },
                          {
                            label: "B",
                            val: newBInput,
                            set: setNewBInput,
                            ch: 2,
                          },
                        ] as {
                          label: string;
                          val: string;
                          set: (v: string) => void;
                          ch: number;
                        }[]
                      ).map(({ label, val, set, ch }) => (
                        <View
                          key={label}
                          style={{ flex: 1, alignItems: "center" }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#718096",
                              marginBottom: 2,
                            }}
                          >
                            {label}
                          </Text>
                          <TextInput
                            style={{
                              width: "100%",
                              height: 40,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: "#E2E8F0",
                              textAlign: "center",
                              fontSize: 13,
                              color: "#2D3748",
                              paddingVertical: 0,
                            }}
                            value={val}
                            onChangeText={(t) => {
                              set(t);
                              const n = parseInt(t, 10);
                              if (!isNaN(n) && n >= 0 && n <= 255) {
                                const rgb: [number, number, number] = [
                                  ch === 0 ? n : parseInt(newRInput, 10),
                                  ch === 1 ? n : parseInt(newGInput, 10),
                                  ch === 2 ? n : parseInt(newBInput, 10),
                                ];
                                if (rgb.every((v) => !isNaN(v))) {
                                  const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
                                  const [h, s2, v2] = hexToHsv(hex);
                                  setNewPickerHue(h);
                                  setNewPickerSat(s2);
                                  setNewPickerVal(v2);
                                  setNewBoolIconColor(hex);
                                  setNewBoolColor(hex);
                                  setNewHexInput(hex.slice(1).slice(1));
                                }
                              }
                            }}
                            onBlur={() => {
                              const [r0, g0, b0] = hexToRgb(newBoolIconColor);
                              setNewRInput(String(r0));
                              setNewGInput(String(g0));
                              setNewBInput(String(b0));
                            }}
                            keyboardType="number-pad"
                            maxLength={3}
                          />
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* 버튼 */}
                  <View
                    style={{ flexDirection: "row", gap: 10, width: "100%" }}
                  >
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
                        const emoji = newBoolEmoji.trim() || undefined;
                        const iconName = newBoolIconName || undefined;
                        const iconColor = newBoolIconName
                          ? newBoolIconColor
                          : undefined;
                        const iconLibrary = newBoolIconName
                          ? POPULAR_ICONS.find(
                              (i) => i.name === newBoolIconName
                            )?.library || undefined
                          : undefined;
                        const newCbm: CustomBoolMetric = {
                          key,
                          label,
                          color: newBoolColor,
                          emoji: iconName ? undefined : emoji,
                          iconName,
                          iconColor,
                          iconLibrary,
                        };
                        const next = [...customBoolMetrics, newCbm];
                        setCustomBoolMetrics(next);
                        const cur = await loadUserSettings();
                        await saveUserSettings({
                          ...cur,
                          customBoolMetrics: next,
                        });
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
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* 이모지/아이콘 편집 모달 */}
        {editingBoolEmojiKey !== null && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setEditingBoolEmojiKey(null)}
          >
            <View style={s.pinModalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setEditingBoolEmojiKey(null)}
              />
              <View
                style={[
                  s.pinModalCard,
                  { maxHeight: "85%", transform: [{ translateY: kbOffset }] },
                ]}
              >
                <ScrollView
                  style={{ width: "100%" }}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  <Text style={s.pinModalTitle}>항목 수정</Text>
                  <Text style={s.pinModalDesc}>
                    {customBoolMetrics.find(
                      (c) => c.key === editingBoolEmojiKey
                    )?.label || ""}{" "}
                    항목의 아이콘과 색상을 변경합니다
                  </Text>

                  {/* 미리보기 */}
                  <View style={{ alignItems: "center", marginBottom: 16 }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor:
                          (editBoolIconName
                            ? editBoolIconColor
                            : editBoolColor) + "22",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {editBoolIconName ? (
                        POPULAR_ICONS.find((i) => i.name === editBoolIconName)
                          ?.library === "mci" ? (
                          <MaterialCommunityIcons
                            name={editBoolIconName as any}
                            size={28}
                            color={editBoolIconColor}
                          />
                        ) : (
                          <Ionicons
                            name={editBoolIconName as any}
                            size={28}
                            color={editBoolIconColor}
                          />
                        )
                      ) : editBoolEmoji ? (
                        <Text style={{ fontSize: 28 }}>{editBoolEmoji}</Text>
                      ) : (
                        <Text style={{ fontSize: 28, color: "#CBD5E0" }}>
                          ?
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* 이모지 직접 입력 */}
                  <View style={{ width: "100%", marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 4,
                      }}
                    >
                      이모지 직접 입력 (선택)
                    </Text>
                    <TextInput
                      style={[s.input, { width: "100%", textAlign: "left" }]}
                      value={editBoolEmoji}
                      onChangeText={(t) => {
                        setEditBoolEmoji(t.slice(0, 2));
                        if (t.trim()) setEditBoolIconName(undefined);
                      }}
                      placeholder="예: 🧘 💊 🚭 (비우면 제거)"
                      placeholderTextColor="#A0AEC0"
                      returnKeyType="done"
                    />
                  </View>

                  {/* 아이콘 선택 */}
                  <View style={{ width: "100%", marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 8,
                      }}
                    >
                      또는 아이콘 선택
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: ICON_GRID_GAP,
                      }}
                    >
                      {/* 아이콘 해제 버튼 */}
                      <TouchableOpacity
                        onPress={() => setEditBoolIconName(undefined)}
                        style={{
                          width: ICON_ITEM_SIZE,
                          height: ICON_ITEM_SIZE,
                          borderRadius: 12,
                          backgroundColor: !editBoolIconName
                            ? "#FED7D7"
                            : "#F7FAFC",
                          borderWidth: !editBoolIconName ? 2 : 1,
                          borderColor: !editBoolIconName
                            ? "#FC8181"
                            : "#E2E8F0",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Ionicons
                          name="close"
                          size={20}
                          color={!editBoolIconName ? "#E53E3E" : "#A0AEC0"}
                        />
                      </TouchableOpacity>
                      {POPULAR_ICONS.map((icon) => (
                        <TouchableOpacity
                          key={icon.name}
                          onPress={() => {
                            setEditBoolIconName(icon.name);
                            setEditBoolEmoji("");
                          }}
                          style={{
                            width: ICON_ITEM_SIZE,
                            height: ICON_ITEM_SIZE,
                            borderRadius: 12,
                            backgroundColor:
                              editBoolIconName === icon.name
                                ? editBoolIconColor + "22"
                                : "#F7FAFC",
                            borderWidth: editBoolIconName === icon.name ? 2 : 1,
                            borderColor:
                              editBoolIconName === icon.name
                                ? editBoolIconColor
                                : "#E2E8F0",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          {icon.library === "mci" ? (
                            <MaterialCommunityIcons
                              name={icon.name as any}
                              size={22}
                              color={
                                editBoolIconName === icon.name
                                  ? editBoolIconColor
                                  : "#718096"
                              }
                            />
                          ) : (
                            <Ionicons
                              name={icon.name as any}
                              size={22}
                              color={
                                editBoolIconName === icon.name
                                  ? editBoolIconColor
                                  : "#718096"
                              }
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 색상 선택 — 컬러 피커 */}
                  <View style={{ width: "100%", marginBottom: 20 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#4A5568",
                        marginBottom: 8,
                      }}
                    >
                      색상
                    </Text>
                    {/* SV 패널 */}
                    <View
                      style={{
                        width: CP_W,
                        height: SV_H,
                        borderRadius: 10,
                        overflow: "hidden",
                        marginBottom: 12,
                      }}
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={(e) => {
                        const { locationX, locationY } = e.nativeEvent;
                        const s2 = Math.max(0, Math.min(1, locationX / CP_W));
                        const v2 = Math.max(
                          0,
                          Math.min(1, 1 - locationY / SV_H)
                        );
                        setEditPickerSat(s2);
                        setEditPickerVal(v2);
                        const hex = hsvToHex(editPickerHue, s2, v2);
                        setEditBoolIconColor(hex);
                        setEditBoolColor(hex);
                        setEditHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setEditRInput(String(r0));
                        setEditGInput(String(g0));
                        setEditBInput(String(b0));
                      }}
                      onResponderMove={(e) => {
                        const { locationX, locationY } = e.nativeEvent;
                        const s2 = Math.max(0, Math.min(1, locationX / CP_W));
                        const v2 = Math.max(
                          0,
                          Math.min(1, 1 - locationY / SV_H)
                        );
                        setEditPickerSat(s2);
                        setEditPickerVal(v2);
                        const hex = hsvToHex(editPickerHue, s2, v2);
                        setEditBoolIconColor(hex);
                        setEditBoolColor(hex);
                        setEditHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setEditRInput(String(r0));
                        setEditGInput(String(g0));
                        setEditBInput(String(b0));
                      }}
                    >
                      <Svg width={CP_W} height={SV_H}>
                        <Defs>
                          <SvgLinearGradient
                            id="editSat"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <Stop offset="0" stopColor="#FFFFFF" />
                            <Stop
                              offset="1"
                              stopColor={`hsl(${editPickerHue}, 100%, 50%)`}
                            />
                          </SvgLinearGradient>
                          <SvgLinearGradient
                            id="editVal"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <Stop
                              offset="0"
                              stopColor="rgba(0,0,0,0)"
                              stopOpacity="0"
                            />
                            <Stop offset="1" stopColor="#000" stopOpacity="1" />
                          </SvgLinearGradient>
                        </Defs>
                        <SvgRect
                          width={CP_W}
                          height={SV_H}
                          fill="url(#editSat)"
                        />
                        <SvgRect
                          width={CP_W}
                          height={SV_H}
                          fill="url(#editVal)"
                        />
                        <SvgCircle
                          cx={editPickerSat * CP_W}
                          cy={(1 - editPickerVal) * SV_H}
                          r={9}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={3}
                        />
                      </Svg>
                    </View>
                    {/* 휴 슬라이더 */}
                    <View
                      style={{
                        width: CP_W,
                        height: HUE_H,
                        borderRadius: HUE_H / 2,
                        overflow: "hidden",
                        marginBottom: 12,
                      }}
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={(e) => {
                        const h2 = Math.max(
                          0,
                          Math.min(360, (e.nativeEvent.locationX / CP_W) * 360)
                        );
                        setEditPickerHue(h2);
                        const hex = hsvToHex(h2, editPickerSat, editPickerVal);
                        setEditBoolIconColor(hex);
                        setEditBoolColor(hex);
                        setEditHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setEditRInput(String(r0));
                        setEditGInput(String(g0));
                        setEditBInput(String(b0));
                      }}
                      onResponderMove={(e) => {
                        const h2 = Math.max(
                          0,
                          Math.min(360, (e.nativeEvent.locationX / CP_W) * 360)
                        );
                        setEditPickerHue(h2);
                        const hex = hsvToHex(h2, editPickerSat, editPickerVal);
                        setEditBoolIconColor(hex);
                        setEditBoolColor(hex);
                        setEditHexInput(hex.slice(1));
                        const [r0, g0, b0] = hexToRgb(hex);
                        setEditRInput(String(r0));
                        setEditGInput(String(g0));
                        setEditBInput(String(b0));
                      }}
                    >
                      <Svg width={CP_W} height={HUE_H}>
                        <Defs>
                          <SvgLinearGradient
                            id="editHue"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                          >
                            <Stop offset="0" stopColor="hsl(0,100%,50%)" />
                            <Stop offset="0.167" stopColor="hsl(60,100%,50%)" />
                            <Stop
                              offset="0.333"
                              stopColor="hsl(120,100%,50%)"
                            />
                            <Stop offset="0.5" stopColor="hsl(180,100%,50%)" />
                            <Stop
                              offset="0.667"
                              stopColor="hsl(240,100%,50%)"
                            />
                            <Stop
                              offset="0.833"
                              stopColor="hsl(300,100%,50%)"
                            />
                            <Stop offset="1" stopColor="hsl(360,100%,50%)" />
                          </SvgLinearGradient>
                        </Defs>
                        <SvgRect
                          width={CP_W}
                          height={HUE_H}
                          rx={HUE_H / 2}
                          fill="url(#editHue)"
                        />
                        <SvgCircle
                          cx={Math.max(
                            HUE_H / 2,
                            Math.min(
                              CP_W - HUE_H / 2,
                              (editPickerHue / 360) * CP_W
                            )
                          )}
                          cy={HUE_H / 2}
                          r={HUE_H / 2 - 2}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={3}
                        />
                      </Svg>
                    </View>
                    {/* 미리보기 + Hex + RGB 입력 */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: editBoolIconColor,
                          borderWidth: 2,
                          borderColor: "#E2E8F0",
                        }}
                      />
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          height: 36,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "#E2E8F0",
                          paddingHorizontal: 8,
                          width: 100,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#718096",
                            fontFamily: "monospace",
                          }}
                        >
                          #
                        </Text>
                        <TextInput
                          style={{
                            flex: 1,
                            height: 36,
                            fontSize: 13,
                            fontFamily: "monospace",
                            color: "#2D3748",
                            paddingVertical: 0,
                          }}
                          value={editHexInput}
                          onChangeText={(text) => {
                            const cleaned = text
                              .replace(/[^0-9A-Fa-f]/g, "")
                              .slice(0, 6);
                            setEditHexInput(cleaned);
                            if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
                              const full = "#" + cleaned;
                              const [h, s2, v2] = hexToHsv(full);
                              setEditPickerHue(h);
                              setEditPickerSat(s2);
                              setEditPickerVal(v2);
                              setEditBoolIconColor(full.toUpperCase());
                              setEditBoolColor(full.toUpperCase());
                              const [r0, g0, b0] = hexToRgb(full);
                              setEditRInput(String(r0));
                              setEditGInput(String(g0));
                              setEditBInput(String(b0));
                            }
                          }}
                          onBlur={() =>
                            setEditHexInput(editBoolIconColor.slice(1))
                          }
                          placeholder="RRGGBB"
                          placeholderTextColor="#A0AEC0"
                          autoCapitalize="characters"
                          maxLength={6}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {(
                        [
                          {
                            label: "R",
                            val: editRInput,
                            set: setEditRInput,
                            ch: 0,
                          },
                          {
                            label: "G",
                            val: editGInput,
                            set: setEditGInput,
                            ch: 1,
                          },
                          {
                            label: "B",
                            val: editBInput,
                            set: setEditBInput,
                            ch: 2,
                          },
                        ] as {
                          label: string;
                          val: string;
                          set: (v: string) => void;
                          ch: number;
                        }[]
                      ).map(({ label, val, set, ch }) => (
                        <View
                          key={label}
                          style={{ flex: 1, alignItems: "center" }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#718096",
                              marginBottom: 2,
                            }}
                          >
                            {label}
                          </Text>
                          <TextInput
                            style={{
                              width: "100%",
                              height: 40,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: "#E2E8F0",
                              textAlign: "center",
                              fontSize: 13,
                              color: "#2D3748",
                              paddingVertical: 0,
                            }}
                            value={val}
                            onChangeText={(t) => {
                              set(t);
                              const n = parseInt(t, 10);
                              if (!isNaN(n) && n >= 0 && n <= 255) {
                                const rgb: [number, number, number] = [
                                  ch === 0 ? n : parseInt(editRInput, 10),
                                  ch === 1 ? n : parseInt(editGInput, 10),
                                  ch === 2 ? n : parseInt(editBInput, 10),
                                ];
                                if (rgb.every((v) => !isNaN(v))) {
                                  const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
                                  const [h, s2, v2] = hexToHsv(hex);
                                  setEditPickerHue(h);
                                  setEditPickerSat(s2);
                                  setEditPickerVal(v2);
                                  setEditBoolIconColor(hex);
                                  setEditBoolColor(hex);
                                  setEditHexInput(hex.slice(1).slice(1));
                                }
                              }
                            }}
                            onBlur={() => {
                              const [r0, g0, b0] = hexToRgb(editBoolIconColor);
                              setEditRInput(String(r0));
                              setEditGInput(String(g0));
                              setEditBInput(String(b0));
                            }}
                            keyboardType="number-pad"
                            maxLength={3}
                          />
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* 버튼 */}
                  <View
                    style={{ flexDirection: "row", gap: 10, width: "100%" }}
                  >
                    <TouchableOpacity
                      style={[s.saveBtn, { flex: 1, marginTop: 0 }]}
                      onPress={async () => {
                        if (!editingBoolEmojiKey) return;
                        const emoji = editBoolEmoji.trim() || undefined;
                        const iconName = editBoolIconName || undefined;
                        const iconColor = editBoolIconName
                          ? editBoolIconColor
                          : undefined;
                        const iconLibrary = editBoolIconName
                          ? POPULAR_ICONS.find(
                              (i) => i.name === editBoolIconName
                            )?.library || undefined
                          : undefined;
                        const next = customBoolMetrics.map((c) =>
                          c.key === editingBoolEmojiKey
                            ? {
                                ...c,
                                emoji: iconName ? undefined : emoji,
                                iconName,
                                iconColor,
                                iconLibrary,
                                color: editBoolColor,
                              }
                            : c
                        );
                        setCustomBoolMetrics(next);
                        const cur = await loadUserSettings();
                        await saveUserSettings({
                          ...cur,
                          customBoolMetrics: next,
                        });
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
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* 사용자 정의 수치 추가 모달 */}
        {showAddMetric && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setShowAddMetric(false)}
          >
            <TouchableOpacity
              style={s.pinModalOverlay}
              activeOpacity={1}
              onPress={() => setShowAddMetric(false)}
            >
              <View
                style={[
                  s.pinModalCard,
                  { transform: [{ translateY: kbOffset }] },
                ]}
                onStartShouldSetResponder={() => true}
              >
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
        )}

        {/* PIN 설정 모달 */}
        {showPinSetup && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setShowPinSetup(false)}
          >
            <TouchableOpacity
              style={s.pinModalOverlay}
              activeOpacity={1}
              onPress={() => setShowPinSetup(false)}
            >
              <View
                style={s.pinModalCard}
                onStartShouldSetResponder={() => true}
              >
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
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#718096",
                    }}
                  >
                    취소
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* ─── 데이터 관리 ─── */}
        <Text style={s.sectionHeader}>데이터 관리</Text>

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

          <TouchableOpacity
            style={[s.actionBtn, { marginTop: 8 }]}
            onPress={() => {
              setDeleteInput("");
              setShowDeleteConfirm(true);
            }}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color="#E53E3E"
              style={{ marginRight: 14 }}
            />
            <View style={s.actionTextWrap}>
              <Text style={[s.actionTitle, { color: "#E53E3E" }]}>
                전체 데이터 삭제
              </Text>
              <Text style={s.actionDesc}>모든 기록을 영구 삭제합니다</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 전체 데이터 삭제 확인 모달 */}
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: "#1E2A3A",
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 340,
              }}
            >
              <Text
                style={{
                  color: "#E53E3E",
                  fontSize: 18,
                  fontWeight: "700",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                ⚠️ 전체 데이터 삭제
              </Text>
              <Text
                style={{
                  color: "#A0AEC0",
                  fontSize: 14,
                  textAlign: "center",
                  lineHeight: 20,
                  marginBottom: 20,
                }}
              >
                모든 기록, 프로필, 광고 카운터, 멤버십 상태가{"\n"}영구적으로
                삭제됩니다.{"\n"}이 작업은 되돌릴 수 없습니다.
              </Text>
              <Text
                style={{
                  color: "#CBD5E0",
                  fontSize: 13,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                확인을 위해 아래에{" "}
                <Text style={{ color: "#E53E3E", fontWeight: "700" }}>
                  삭제
                </Text>
                를 입력하세요
              </Text>
              <TextInput
                style={{
                  backgroundColor: "#2D3748",
                  borderRadius: 10,
                  padding: 12,
                  color: "#fff",
                  fontSize: 16,
                  textAlign: "center",
                  borderWidth: 1,
                  borderColor: deleteInput === "삭제" ? "#E53E3E" : "#4A5568",
                  marginBottom: 20,
                }}
                placeholder='"삭제" 입력'
                placeholderTextColor="#4A5568"
                value={deleteInput}
                onChangeText={setDeleteInput}
                autoCorrect={false}
              />
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#2D3748",
                    borderRadius: 10,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setDeleteInput("");
                  }}
                >
                  <Text
                    style={{
                      color: "#A0AEC0",
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    취소
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor:
                      deleteInput === "삭제" ? "#E53E3E" : "#4A5568",
                    borderRadius: 10,
                    paddingVertical: 14,
                    alignItems: "center",
                    opacity: deleteInput === "삭제" ? 1 : 0.5,
                  }}
                  disabled={deleteInput !== "삭제"}
                  onPress={handleClearAll}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    삭제
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                onPress={handleGoogleLogin}
                disabled={backupLoading}
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
                <Text style={s.infoLabel}>백업 주기</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <TouchableOpacity
                    onPress={async () => {
                      const next = Math.max(1, backupIntervalDays - 1);
                      setBackupIntervalDaysState(next);
                      await setBackupIntervalDays(next);
                    }}
                    onPressIn={() => {
                      const id = setInterval(async () => {
                        setBackupIntervalDaysState((prev) => {
                          const next = Math.max(1, prev - 1);
                          setBackupIntervalDays(next);
                          return next;
                        });
                      }, 120);
                      intervalRef.current = id as unknown as number;
                    }}
                    onPressOut={() => {
                      if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                      }
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: "#EDF2F7",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#2D3748",
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      −
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      s.infoValue,
                      { color: "#38A169", minWidth: 60, textAlign: "center" },
                    ]}
                  >
                    {backupIntervalDays === 1
                      ? "매일"
                      : `${backupIntervalDays}일마다`}
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      const next = Math.min(30, backupIntervalDays + 1);
                      setBackupIntervalDaysState(next);
                      await setBackupIntervalDays(next);
                    }}
                    onPressIn={() => {
                      const id = setInterval(async () => {
                        setBackupIntervalDaysState((prev) => {
                          const next = Math.min(30, prev + 1);
                          setBackupIntervalDays(next);
                          return next;
                        });
                      }, 120);
                      intervalRef.current = id as unknown as number;
                    }}
                    onPressOut={() => {
                      if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                      }
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: "#EDF2F7",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#2D3748",
                        fontSize: 16,
                        fontWeight: "bold",
                      }}
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
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
        {showBackupList && (
          <Modal
            visible
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
                  <View style={{ maxHeight: 300, width: "100%" }}>
                    {backupList.map((item, idx) => {
                      const d = new Date(item.createdTime);
                      const dateLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
                      const sizeKB = item.size
                        ? `${(parseInt(item.size, 10) / 1024).toFixed(1)}KB`
                        : "";
                      const isNewest = idx === 0;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            s.backupListItem,
                            isNewest && {
                              backgroundColor: "#EBF8FF",
                            },
                          ]}
                          onPress={() => handleRestore(item.id, item.name)}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text style={s.backupListDate}>{dateLabel}</Text>
                              {isNewest && (
                                <View
                                  style={{
                                    backgroundColor: "#4299E1",
                                    borderRadius: 4,
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "700",
                                      color: "#fff",
                                    }}
                                  >
                                    최신
                                  </Text>
                                </View>
                              )}
                            </View>
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
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#718096",
                    }}
                  >
                    닫기
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* 가져오기·내보내기 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>가져오기 · 내보내기</Text>

          <Text style={s.subSectionLabel}>데이터 내보내기</Text>
          <Text style={[s.backupDesc, { marginBottom: 12 }]}>
            기록 데이터를 다양한 형식으로 로컬에 저장하거나{"\n"}다른 앱으로
            공유할 수 있습니다.
          </Text>
          <TouchableOpacity
            style={[s.backupActionBtn, { backgroundColor: "#667EEA" }]}
            onPress={handleOpenExport}
          >
            <Text style={s.backupActionBtnText}>내보내기</Text>
          </TouchableOpacity>

          <View style={s.cardDivider} />

          <Text style={s.subSectionLabel}>인바디 CSV 가져오기</Text>
          <Text style={[s.backupDesc, { marginBottom: 12 }]}>
            InBody 앱에서 내보낸 CSV 파일을 선택하면{"\n"}체중, 골격근량,
            체지방량/체지방률을 가져옵니다.{"\n"}같은 날짜 기록은 인바디
            데이터로 업데이트됩니다.
          </Text>
          <TouchableOpacity
            style={[s.backupActionBtn, { backgroundColor: "#ED8936" }]}
            onPress={handleInBodyImport}
            disabled={inbodyLoading}
          >
            {inbodyLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.backupActionBtnText}>CSV 파일 선택</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── 앱 설정 ─── */}
        <Text style={s.sectionHeader}>앱 설정</Text>

        {/* 앱 설정 (AI 모델 + 사진 화질) */}
        <View style={s.card}>
          <Text style={s.cardTitle}>앱 설정</Text>

          <Text style={s.subSectionLabel}>AI 음식 분석 모델</Text>
          <Text style={[s.backupDesc, { marginBottom: 12 }]}>
            음식 사진 분석 시 사용할 AI 모델을 선택합니다.
            {!aiPro && `\n오늘 남은 무료 분석: ${aiRemaining}/2회`}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  aiModel === "gpt-4o-mini" ? "#4299E1" : "#EDF2F7",
              }}
              onPress={async () => {
                setAiModel("gpt-4o-mini");
                const settings = await loadUserSettings();
                await saveUserSettings({
                  ...settings,
                  aiModel: "gpt-4o-mini",
                });
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: aiModel === "gpt-4o-mini" ? "#fff" : "#2D3748",
                }}
              >
                저성능 모델
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: aiModel === "gpt-4o-mini" ? "#BEE3F8" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                gpt-4o-mini
                {!aiPro && ` (${aiRemaining}/2)`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  aiModel === "gpt-4o"
                    ? "#667EEA"
                    : aiPro
                      ? "#EDF2F7"
                      : "#F7F7F7",
                opacity: !aiPro && aiModel !== "gpt-4o" ? 0.75 : 1,
              }}
              onPress={async () => {
                if (!aiPro) {
                  setPaywallVisible(true);
                  return;
                }
                setAiModel("gpt-4o");
                const settings = await loadUserSettings();
                await saveUserSettings({ ...settings, aiModel: "gpt-4o" });
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: aiModel === "gpt-4o" ? "#fff" : "#2D3748",
                  }}
                >
                  고성능 모델
                </Text>
                {!aiPro && (
                  <Ionicons name="sparkles-outline" size={13} color="#667EEA" />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: aiModel === "gpt-4o" ? "#C3DAFE" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                gpt-4o
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.cardDivider} />

          {/* 사진 화질 */}
          <Text style={s.subSectionLabel}>사진 화질</Text>

          {/* 눈바디 사진 */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: "#4A5568",
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            눈바디 사진
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  bodyPhotoQuality === "compressed" ? "#48BB78" : "#EDF2F7",
              }}
              onPress={async () => {
                setBodyPhotoQuality("compressed");
                const settings = await loadUserSettings();
                await saveUserSettings({
                  ...settings,
                  bodyPhotoQuality: "compressed",
                });
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: bodyPhotoQuality === "compressed" ? "#fff" : "#2D3748",
                }}
              >
                압축 화질
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color:
                    bodyPhotoQuality === "compressed" ? "#C6F6D5" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                ~700KB
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  bodyPhotoQuality === "original" ? "#ED8936" : "#EDF2F7",
              }}
              onPress={async () => {
                setBodyPhotoQuality("original");
                const settings = await loadUserSettings();
                await saveUserSettings({
                  ...settings,
                  bodyPhotoQuality: "original",
                });
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: bodyPhotoQuality === "original" ? "#fff" : "#2D3748",
                }}
              >
                원본 화질
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color:
                    bodyPhotoQuality === "original" ? "#FEEBC8" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                용량 큼
              </Text>
            </TouchableOpacity>
          </View>

          {/* 음식 사진 */}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: "#4A5568",
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            음식 사진
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  foodPhotoQuality === "low" ? "#4299E1" : "#EDF2F7",
              }}
              onPress={async () => {
                setFoodPhotoQuality("low");
                const settings = await loadUserSettings();
                await saveUserSettings({
                  ...settings,
                  foodPhotoQuality: "low",
                });
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: foodPhotoQuality === "low" ? "#fff" : "#2D3748",
                }}
              >
                저화질
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: foodPhotoQuality === "low" ? "#BEE3F8" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                썸네일 수준
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  foodPhotoQuality === "compressed" ? "#48BB78" : "#EDF2F7",
              }}
              onPress={async () => {
                setFoodPhotoQuality("compressed");
                const settings = await loadUserSettings();
                await saveUserSettings({
                  ...settings,
                  foodPhotoQuality: "compressed",
                });
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: foodPhotoQuality === "compressed" ? "#fff" : "#2D3748",
                }}
              >
                압축 화질
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color:
                    foodPhotoQuality === "compressed" ? "#C6F6D5" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                ~700KB
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor:
                  foodPhotoQuality === "original" ? "#ED8936" : "#EDF2F7",
              }}
              onPress={async () => {
                setFoodPhotoQuality("original");
                const settings = await loadUserSettings();
                await saveUserSettings({
                  ...settings,
                  foodPhotoQuality: "original",
                });
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: foodPhotoQuality === "original" ? "#fff" : "#2D3748",
                }}
              >
                원본 화질
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color:
                    foodPhotoQuality === "original" ? "#FEEBC8" : "#A0AEC0",
                  marginTop: 2,
                }}
              >
                용량 큼
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 내보내기 모달 */}
        {showExportModal && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setShowExportModal(false)}
          >
            <TouchableOpacity
              style={s.pinModalOverlay}
              activeOpacity={1}
              onPress={() => !exportLoading && setShowExportModal(false)}
            >
              <View
                style={[s.pinModalCard, { width: SCREEN_WIDTH * 0.9 }]}
                onStartShouldSetResponder={() => true}
              >
                <Text style={[s.pinModalTitle, { marginBottom: 16 }]}>
                  내보내기 형식 선택
                </Text>

                {/* 형식 버튼들 */}
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    style={[s.exportFormatBtn, { backgroundColor: "#4299E1" }]}
                    onPress={() => handleExport("json")}
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={{ alignItems: "center" }}>
                        <Text style={s.exportFormatBtnText}>JSON</Text>
                        <Text style={s.exportFormatBtnDesc}>
                          전체 데이터 · 다른 앱에서 재사용 가능
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.exportFormatBtn, { backgroundColor: "#48BB78" }]}
                    onPress={() => handleExport("csv")}
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={{ alignItems: "center" }}>
                        <Text style={s.exportFormatBtnText}>CSV</Text>
                        <Text style={s.exportFormatBtnDesc}>
                          엑셀 호환 · 체중/식사 기록 스프레드시트
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.exportFormatBtn, { backgroundColor: "#667EEA" }]}
                    onPress={() => handleExport("zip")}
                    disabled={exportLoading}
                  >
                    {exportLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={{ alignItems: "center" }}>
                        <Text style={s.exportFormatBtnText}>
                          ZIP (전체 백업)
                        </Text>
                        <Text style={s.exportFormatBtnDesc}>
                          JSON + CSV + 사진 · 완전한 백업
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 사진 포함 토글 (ZIP 전용) */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    paddingHorizontal: 4,
                    marginTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: "#F0F4F8",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#2D3748",
                      }}
                    >
                      ZIP에 사진 포함
                    </Text>
                    {exportPhotoInfo && exportPhotoInfo.count > 0 ? (
                      <Text
                        style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}
                      >
                        사진 {exportPhotoInfo.count}장 ·{" "}
                        {formatBytes(exportPhotoInfo.sizeBytes)}
                      </Text>
                    ) : (
                      <Text
                        style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}
                      >
                        저장된 사진이 없습니다
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={exportIncludePhotos}
                    onValueChange={setExportIncludePhotos}
                    disabled={!exportPhotoInfo || exportPhotoInfo.count === 0}
                    trackColor={{ false: "#E2E8F0", true: "#90CDF4" }}
                    thumbColor={exportIncludePhotos ? "#4299E1" : "#fff"}
                  />
                </View>

                <TouchableOpacity
                  style={{
                    marginTop: 16,
                    alignItems: "center",
                    paddingVertical: 10,
                  }}
                  onPress={() => setShowExportModal(false)}
                  disabled={exportLoading}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#718096",
                    }}
                  >
                    닫기
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* ─── 기타 ─── */}
        <Text style={s.sectionHeader}>기타</Text>

        {/* 개발자 도구 */}
        <View style={s.card}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              const next = devTapCount + 1;
              setDevTapCount(next);
              if (next >= 10) {
                setShowDevTools(true);
              }
            }}
          >
            <Text style={s.cardTitle}>개발자 정보</Text>
          </TouchableOpacity>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>이메일</Text>
            <Text style={s.infoValue}>manseon94@gmail.com</Text>
          </View>
        </View>

        {/* 개발자 도구 (숨김 - 개발자 10회 탭 후 표시) */}
        {showDevTools && (
          <View style={s.card}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={s.cardTitle}>개발자 도구</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDevTools(false);
                  setDevTapCount(0);
                }}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text
                  style={{ fontSize: 13, color: "#A0AEC0", fontWeight: "600" }}
                >
                  닫기 ✕
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.actionBtn} onPress={handleSeedDummy}>
              <Text style={s.actionIcon}></Text>
              <View style={s.actionTextWrap}>
                <Text style={s.actionTitle}>더미 데이터 생성</Text>
                <Text style={s.actionDesc}>
                  약 3년치 랜덤 테스트 데이터 삽입
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={async () => {
                await devGrantBannerRemoval();
                await refreshPro();
                Alert.alert(
                  "개발자 모드",
                  "배너 광고 제거 활성화됨 (재시작 시 유지)"
                );
              }}
            >
              <Text style={s.actionIcon}>🚩</Text>
              <View style={s.actionTextWrap}>
                <Text style={[s.actionTitle, { color: "#48BB78" }]}>
                  배너 광고 제거 활성화
                </Text>
                <Text style={s.actionDesc}>
                  배너 광고 제거를 구매한 것처럼 시뮬레이션
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={async () => {
                await devGrantAiPro();
                setAiModel("gpt-4o");
                await saveUserSettings({
                  ...(await loadUserSettings()),
                  aiModel: "gpt-4o",
                });
                await refreshPro();
                Alert.alert(
                  "개발자 모드",
                  "AI Pro 연간 구독 활성화됨 (재시작 시 유지)"
                );
              }}
            >
              <Text style={s.actionIcon}>🤖</Text>
              <View style={s.actionTextWrap}>
                <Text style={[s.actionTitle, { color: "#63B3ED" }]}>
                  AI Pro 연간 구독 활성화
                </Text>
                <Text style={s.actionDesc}>
                  gpt-4o + 광고 전체 제거를 구독한 것처럼 시뮬레이션
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => {
                Alert.alert(
                  "멤버십 초기화",
                  "배너 제거, AI 구독 등 모든 유료 결제 상태를 비구독자로 되돌립니다.\n(실제 구독 취소는 Google Play/App Store에서 해야 합니다)",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "초기화",
                      style: "destructive",
                      onPress: async () => {
                        // RevenueCat 로그아웃 → 익명 전환 (bannerRemoved, aiPro 모두 false)
                        await logoutPurchases();
                        // 광고 카운터도 리셋 (AI 일일횟수, 체중저장 누적)
                        await resetAllAdCounters();
                        setAiRemaining(2);
                        // gpt-4o → gpt-4o-mini 전환 (PRO 모델 잠금)
                        setAiModel("gpt-4o-mini");
                        await saveUserSettings({
                          ...(await loadUserSettings()),
                          aiModel: "gpt-4o-mini",
                        });
                        await refreshPro();
                        Alert.alert(
                          "완료",
                          "배너 제거·AI 구독 등 모든 유료 결제가 비구독자 상태로 초기화되었습니다."
                        );
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={s.actionIcon}>🔄</Text>
              <View style={s.actionTextWrap}>
                <Text style={[s.actionTitle, { color: "#D69E2E" }]}>
                  멤버십 초기화
                </Text>
                <Text style={s.actionDesc}>비구독자 상태로 되돌립니다</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 생년월일 캘린더 팝업 */}
      <CalendarPopup
        visible={calendarVisible}
        initialDate={birthDate}
        onSelect={(date) => setBirthDate(date)}
        onClose={() => setCalendarVisible(false)}
      />
    </View>
  );
}

/* ───── 메인 스타일 ───── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  content: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#718096",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  subSectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A5568",
    marginBottom: 10,
    marginTop: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#F0F4F8",
    marginVertical: 16,
  },
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
  exportFormatBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  exportFormatBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  exportFormatBtnDesc: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
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
    paddingLeft: 12,
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
