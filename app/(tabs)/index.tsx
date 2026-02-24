import { MiniCalendar } from "@/components/mini-calendar";
import {
  Challenge,
  MEAL_LABELS,
  MealEntry,
  MealType,
  UserSettings,
  WeightRecord,
} from "@/types";
import { analyzeFood } from "@/utils/food-ai";
import {
  calcDailyNutrition,
  daysBetween,
  fmtDate,
  getBmiInfo,
} from "@/utils/format";
import {
  captureFoodPhoto,
  deletePhoto,
  pickPhoto,
  takePhoto,
} from "@/utils/photo";
import {
  addMeal,
  deleteMeal,
  deleteRecord,
  getLocalDateString,
  loadChallenge,
  loadMeals,
  loadRecords,
  loadUserSettings,
  upsertRecord,
} from "@/utils/storage";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [boolCustomInputs, setBoolCustomInputs] = useState<
    Record<string, boolean>
  >({});

  const [userSettings, setUserSettings] = useState<UserSettings>({});
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  /* 식사 추적 상태 */
  const [meals, setMeals] = useState<MealEntry[]>([]);

  /* 식사 입력 모달 */
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealModalType, setMealModalType] = useState<MealType>("breakfast");
  const [mealPhotoUri, setMealPhotoUri] = useState<string | undefined>(
    undefined
  );
  const [mealDesc, setMealDesc] = useState("");
  const [mealCarb, setMealCarb] = useState("");
  const [mealProtein, setMealProtein] = useState("");
  const [mealFat, setMealFat] = useState("");
  const [mealKcal, setMealKcal] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  /* 사진 확대 모달 */
  const [zoomPhotoUri, setZoomPhotoUri] = useState<string | null>(null);

  /* 전체 식사 기록 (기록 목록용) */
  const [allMeals, setAllMeals] = useState<MealEntry[]>([]);

  /* 편집 모달 상태 */
  const [showEditModal, setShowEditModal] = useState(false);

  /* 기록 목록 페이징 (성능: 초기 7개만 렌더, 더보기로 확장) */
  const RECORDS_PER_PAGE = 7;
  const [visibleRecordCount, setVisibleRecordCount] =
    useState(RECORDS_PER_PAGE);
  const [editRecord, setEditRecord] = useState<WeightRecord | null>(null);
  const [emWeight, setEmWeight] = useState("");
  const [emWaist, setEmWaist] = useState("");
  const [emMuscleMass, setEmMuscleMass] = useState("");
  const [emBodyFatPercent, setEmBodyFatPercent] = useState("");
  const [emBodyFatMass, setEmBodyFatMass] = useState("");
  const [emExercised, setEmExercised] = useState(false);
  const [emDrank, setEmDrank] = useState(false);
  const [emPhotoUri, setEmPhotoUri] = useState<string | undefined>(undefined);
  const [emMeals, setEmMeals] = useState<MealEntry[]>([]);
  const [emCustomInputs, setEmCustomInputs] = useState<Record<string, string>>(
    {}
  );
  const [emBoolCustomInputs, setEmBoolCustomInputs] = useState<
    Record<string, boolean>
  >({});

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
        // 사용자 정의 수치
        const ci: Record<string, string> = {};
        if (existing.customValues) {
          for (const [k, v] of Object.entries(existing.customValues)) {
            ci[k] = v.toString();
          }
        }
        setCustomInputs(ci);
        // 사용자 정의 체크값
        const bi: Record<string, boolean> = {};
        if (existing.customBoolValues) {
          for (const [k, v] of Object.entries(existing.customBoolValues)) {
            bi[k] = v;
          }
        }
        setBoolCustomInputs(bi);
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
        setCustomInputs({});
        setBoolCustomInputs({});
      }
    },
    []
  );

  // 탭 포커스 시 1회만 데이터 로드 (selectedDate 변경 시에는 재로드 안 함)
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  useFocusEffect(
    useCallback(() => {
      const d = selectedDateRef.current;
      Promise.all([
        loadAndSetRecords(),
        loadUserSettings(),
        loadChallenge(),
        loadMeals(),
      ]).then(([data, settings, ch, allMealsData]) => {
        populateForm(d, data);
        setUserSettings(settings);
        setChallenge(ch);
        setAllMeals(allMealsData);
        setMeals(allMealsData.filter((m) => m.date === d));
      });
    }, [loadAndSetRecords, populateForm])
  );

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    populateForm(date, records);
    // 메모리에서 식사 필터링 (AsyncStorage 재호출 없음)
    setMeals(allMeals.filter((m) => m.date === date));
  };

  /* ───── 식사 관련 핸들러 ───── */
  const openMealModal = (mealType: MealType) => {
    setMealModalType(mealType);
    setMealPhotoUri(undefined);
    setMealDesc("");
    setMealCarb("");
    setMealProtein("");
    setMealFat("");
    setMealKcal("");
    setShowMealModal(true);
  };

  const handleMealPhotoSelect = async (source: "camera" | "gallery") => {
    const captured = await captureFoodPhoto(
      source,
      userSettings.foodPhotoQuality
    );
    if (!captured) return;
    setMealPhotoUri(captured.savedUri);
    // AI 자동 분석 시도 — 원본 고화질 파일 전송
    setAiAnalyzing(true);
    try {
      const result = await analyzeFood(captured.aiUri, userSettings.aiModel);
      setMealDesc(result.description);
      setMealCarb(String(result.carb));
      setMealProtein(String(result.protein));
      setMealFat(String(result.fat));
      setMealKcal(String(result.kcal));
    } catch (err: any) {
      Alert.alert(
        "AI 분석 실패",
        (err.message || "서버 연결에 실패했습니다.") +
          "\n\n음식 이름과 영양소를 직접 입력해주세요."
      );
    } finally {
      deletePhoto(captured.aiUri).catch(() => {});
      setAiAnalyzing(false);
    }
  };

  const handleSaveMealEntry = async () => {
    if (!mealDesc.trim()) {
      Alert.alert("입력 오류", "음식 이름을 입력해주세요.");
      return;
    }
    const carb = parseFloat(mealCarb) || 0;
    const protein = parseFloat(mealProtein) || 0;
    const fat = parseFloat(mealFat) || 0;
    const kcal =
      parseFloat(mealKcal) || Math.round(carb * 4 + protein * 4 + fat * 9);

    const entry: MealEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: showEditModal && editRecord ? editRecord.date : selectedDate,
      mealType: mealModalType,
      photoUri: mealPhotoUri,
      description: mealDesc.trim(),
      carb,
      protein,
      fat,
      kcal,
      createdAt: new Date().toISOString(),
    };
    const updated = await addMeal(entry);
    setMeals(updated.filter((m) => m.date === selectedDate));
    loadMeals().then(setAllMeals);
    // 편집 모달이 열려 있으면 편집용 meals도 갱신
    if (showEditModal && editRecord) {
      setEmMeals(updated.filter((m) => m.date === editRecord.date));
    }
    setShowMealModal(false);
  };

  const handleDeleteMeal = (meal: MealEntry) => {
    Alert.alert(
      "삭제",
      `${MEAL_LABELS[meal.mealType]} - ${meal.description ?? "기록"}을 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            if (meal.photoUri) await deletePhoto(meal.photoUri);
            const updated = await deleteMeal(meal.id);
            setMeals(updated.filter((m) => m.date === selectedDate));
            loadMeals().then(setAllMeals);
          },
        },
      ]
    );
  };

  /** 오늘 총 섭취 영양소 */
  const dailyIntake = useMemo(() => {
    const total = { kcal: 0, carb: 0, protein: 0, fat: 0 };
    meals.forEach((m) => {
      total.kcal += m.kcal;
      total.carb += m.carb;
      total.protein += m.protein;
      total.fat += m.fat;
    });
    return total;
  }, [meals]);

  /** 하루 권장 영양소 (챌린지가 있으면 챌린지 기준, 없으면 유지 기준) */
  const dailyNutrition = useMemo(() => {
    const s = userSettings;
    const w = parseFloat(weight);
    if (!s.height || !s.gender || !s.birthDate || isNaN(w) || w <= 0)
      return null;

    const curMuscleMass = muscleMass ? parseFloat(muscleMass) : undefined;
    const curBodyFatPct = bodyFatPercent
      ? parseFloat(bodyFatPercent)
      : undefined;

    // 챌린지가 있고 targetWeight이 설정되어 있으면 챌린지 기준으로 계산
    if (challenge && challenge.targetWeight) {
      const today = getLocalDateString();
      const daysLeft = daysBetween(today, challenge.endDate);
      return calcDailyNutrition({
        weight: w,
        targetWeight: challenge.targetWeight,
        height: s.height,
        gender: s.gender,
        birthDate: s.birthDate,
        periodDays: daysLeft > 0 ? daysLeft : 1,
        exerciseFreq: s.exerciseFreq ?? 0,
        exerciseMins: s.exerciseMins ?? 60,
        exerciseIntensity: s.exerciseIntensity ?? 1,
        muscleMass: curMuscleMass,
        bodyFatPercent: curBodyFatPct,
        targetMuscleMass: challenge.targetMuscleMass,
        targetBodyFatPercent: challenge.targetBodyFatPercent,
      });
    }

    // 챌린지가 없으면 현재 체중 유지 가정
    return calcDailyNutrition({
      weight: w,
      targetWeight: w,
      height: s.height,
      gender: s.gender,
      birthDate: s.birthDate,
      periodDays: 30,
      exerciseFreq: s.exerciseFreq ?? 0,
      exerciseMins: s.exerciseMins ?? 60,
      exerciseIntensity: s.exerciseIntensity ?? 1,
      muscleMass: curMuscleMass,
      bodyFatPercent: curBodyFatPct,
    });
  }, [userSettings, weight, challenge, muscleMass, bodyFatPercent]);

  const handleSave = async () => {
    const w = parseFloat(weight);
    if (!weight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const customValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(customInputs)) {
      const num = parseFloat(v);
      if (v && !isNaN(num)) customValues[k] = num;
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
      customValues:
        Object.keys(customValues).length > 0 ? customValues : undefined,
      customBoolValues:
        Object.keys(boolCustomInputs).length > 0
          ? { ...boolCustomInputs }
          : undefined,
    };
    const updated = await upsertRecord(record);
    setRecords([...updated].sort((a, b) => b.date.localeCompare(a.date)));
    Alert.alert("저장 완료", `${fmtDate(selectedDate)} 기록이 저장되었습니다.`);
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
            setCustomInputs({});
            setBoolCustomInputs({});
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
    const ci: Record<string, string> = {};
    if (record.customValues) {
      for (const [k, v] of Object.entries(record.customValues)) {
        ci[k] = v.toString();
      }
    }
    setEmCustomInputs(ci);
    const bi: Record<string, boolean> = {};
    if (record.customBoolValues) {
      for (const [k, v] of Object.entries(record.customBoolValues)) {
        bi[k] = v;
      }
    }
    setEmBoolCustomInputs(bi);
    loadMeals(record.date).then(setEmMeals);
    setShowEditModal(true);
  };

  const handleDeleteEmMeal = (meal: MealEntry) => {
    Alert.alert(
      "삭제",
      `${MEAL_LABELS[meal.mealType]} - ${meal.description ?? "음식"}을 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            if (meal.photoUri) await deletePhoto(meal.photoUri);
            const updated = await deleteMeal(meal.id);
            setEmMeals(updated.filter((m) => m.date === editRecord?.date));
            loadMeals().then(setAllMeals);
            if (editRecord?.date === selectedDate) {
              setMeals(updated.filter((m) => m.date === selectedDate));
            }
          },
        },
      ]
    );
  };

  const handleEditMealField = (
    mealId: string,
    field: keyof MealEntry,
    value: string
  ) => {
    setEmMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        if (field === "description") return { ...m, description: value };
        const num = parseFloat(value) || 0;
        const updated = { ...m, [field]: num };
        if (field === "carb" || field === "protein" || field === "fat") {
          updated.kcal = Math.round(
            updated.carb * 4 + updated.protein * 4 + updated.fat * 9
          );
        }
        return updated;
      })
    );
  };

  const saveEmMeals = async () => {
    if (!editRecord) return;
    const { saveMeals: saveMealsFn } = await import("@/utils/storage");
    const all = await loadMeals();
    const otherMeals = all.filter((m) => m.date !== editRecord.date);
    await saveMealsFn([...otherMeals, ...emMeals]);
    loadMeals().then(setAllMeals);
    if (editRecord.date === selectedDate) {
      setMeals(emMeals);
    }
  };

  const handleAddMealInEdit = (mealType: MealType) => {
    if (!editRecord) return;
    setMealModalType(mealType);
    setMealPhotoUri(undefined);
    setMealDesc("");
    setMealCarb("");
    setMealProtein("");
    setMealFat("");
    setMealKcal("");
    setShowMealModal(true);
  };

  const handleEditModalSave = async () => {
    if (!editRecord) return;
    const w = parseFloat(emWeight);
    if (!emWeight || isNaN(w) || w <= 0) {
      Alert.alert("입력 오류", "올바른 몸무게를 입력해주세요.");
      return;
    }
    const emCustomValues: Record<string, number> = {};
    for (const [k, v] of Object.entries(emCustomInputs)) {
      const num = parseFloat(v);
      if (v && !isNaN(num)) emCustomValues[k] = num;
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
      customValues:
        Object.keys(emCustomValues).length > 0 ? emCustomValues : undefined,
      customBoolValues:
        Object.keys(emBoolCustomInputs).length > 0
          ? { ...emBoolCustomInputs }
          : undefined,
    };
    const newRecords = await upsertRecord(updated);
    setRecords([...newRecords].sort((a, b) => b.date.localeCompare(a.date)));
    // 식사 변경사항도 저장
    await saveEmMeals();
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
      "저장 완료",
      `${fmtDate(editRecord.date)} 기록이 수정되었습니다.`
    );
  };

  const isToday = selectedDate === getLocalDateString();

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          {/* 입력 카드 */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>
                {isToday ? "오늘의 기록" : "기록"}
              </Text>
            </View>
            <View style={[styles.cardTitleRow, { marginTop: 0 }]}>
              <View />
              <View style={styles.cardDateSelector}>
                {!isToday && (
                  <TouchableOpacity
                    style={styles.todayLink}
                    onPress={() => handleDateSelect(getLocalDateString())}
                  >
                    <Text style={styles.todayLinkText}>오늘 ↩</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 1);
                    handleDateSelect(getLocalDateString(d));
                  }}
                  style={styles.cardDateArrow}
                >
                  <Text style={styles.cardDateArrowText}>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.cardDateTouchable}
                >
                  <Text style={styles.cardDateText}>
                    {fmtDate(selectedDate)}
                  </Text>
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
                  style={[styles.cardDateArrow, isToday && { opacity: 0.3 }]}
                  disabled={isToday}
                >
                  <Text style={styles.cardDateArrowText}>▶</Text>
                </TouchableOpacity>
              </View>
            </View>

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

            {userSettings.metricInputVisibility?.waist !== false && (
              <>
                <Text style={styles.label}>허리둘레</Text>
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
              </>
            )}

            {userSettings.metricInputVisibility?.muscleMass !== false && (
              <>
                <Text style={styles.label}>골격근량</Text>
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
              </>
            )}

            {userSettings.metricInputVisibility?.bodyFatPercent !== false && (
              <>
                <Text style={styles.label}>체지방률</Text>
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
              </>
            )}

            {userSettings.metricInputVisibility?.bodyFatMass !== false && (
              <>
                <Text style={styles.label}>체지방량</Text>
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
              </>
            )}

            {/* 사용자 정의 수치 */}
            {(userSettings.customMetrics ?? [])
              .filter(
                (cm) => userSettings.metricInputVisibility?.[cm.key] !== false
              )
              .map((cm) => (
                <View key={cm.key}>
                  <Text style={styles.label}>{cm.label}</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      value={customInputs[cm.key] ?? ""}
                      onChangeText={(v) =>
                        setCustomInputs((prev) => ({
                          ...prev,
                          [cm.key]: v,
                        }))
                      }
                      placeholder="0.0"
                      placeholderTextColor="#aaa"
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.unit}>{cm.unit}</Text>
                  </View>
                </View>
              ))}

            {/* 사진 */}
            <Text style={styles.label}>바디 사진</Text>
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
                    const uri = await takePhoto(
                      "body",
                      userSettings.bodyPhotoQuality
                    );
                    if (uri) setPhotoUri(uri);
                  }}
                >
                  <Text style={styles.photoBtnText}>촬영</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={async () => {
                    const uri = await pickPhoto(
                      "body",
                      userSettings.bodyPhotoQuality
                    );
                    if (uri) setPhotoUri(uri);
                  }}
                >
                  <Text style={styles.photoBtnText}>갤러리</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.switchGroup}>
              {userSettings.metricInputVisibility?.["exercised"] !== false && (
                <View style={styles.switchRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <View style={{ width: 32, alignItems: "center" }}>
                      <FontAwesome5 name="running" size={24} color="black" />
                    </View>
                    <Text style={styles.switchLabel}>오늘 운동했나요?</Text>
                  </View>
                  <Switch
                    value={exercised}
                    onValueChange={setExercised}
                    trackColor={{ true: "#4CAF50", false: "#ddd" }}
                    thumbColor="#fff"
                  />
                </View>
              )}
              {userSettings.metricInputVisibility?.["drank"] !== false && (
                <View style={styles.switchRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <View style={{ width: 32, alignItems: "center" }}>
                      <Ionicons name="beer-outline" size={24} color="black" />
                    </View>
                    <Text style={styles.switchLabel}>오늘 음주했나요?</Text>
                  </View>
                  <Switch
                    value={drank}
                    onValueChange={setDrank}
                    trackColor={{ true: "#525150", false: "#ddd" }}
                    thumbColor="#fff"
                  />
                </View>
              )}
              {(userSettings.customBoolMetrics ?? [])
                .filter(
                  (cbm) =>
                    userSettings.metricInputVisibility?.[cbm.key] !== false
                )
                .map((cbm) => (
                  <View key={cbm.key} style={styles.switchRow}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <View style={{ width: 32, alignItems: "center" }}>
                        <Text style={{ fontSize: 22 }}>{cbm.emoji || ""}</Text>
                      </View>
                      <Text style={styles.switchLabel}>
                        오늘 {cbm.label}했나요?
                      </Text>
                    </View>
                    <Switch
                      value={boolCustomInputs[cbm.key] ?? false}
                      onValueChange={(v) =>
                        setBoolCustomInputs((prev) => ({
                          ...prev,
                          [cbm.key]: v,
                        }))
                      }
                      trackColor={{ true: cbm.color, false: "#ddd" }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>저장하기</Text>
            </TouchableOpacity>
          </View>

          {/* ───── 오늘의 식사 섹션 ───── */}
          <View style={mealStyles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
              오늘의 식사
            </Text>

            {/* 식사 타입별 카드 */}
            {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map(
              (mealType) => {
                const mealItems = meals.filter((m) => m.mealType === mealType);

                return (
                  <View key={mealType} style={mealStyles.mealCard}>
                    <View style={mealStyles.mealHeader}>
                      <Text style={mealStyles.mealTitle}>
                        {MEAL_LABELS[mealType]}
                      </Text>
                      {mealItems.length > 0 && (
                        <Text style={mealStyles.mealKcalBadge}>
                          {mealItems.reduce((sum, m) => sum + m.kcal, 0)} kcal
                        </Text>
                      )}
                    </View>

                    {/* 기록된 음식들 */}
                    {mealItems.map((meal) => (
                      <View key={meal.id} style={mealStyles.mealItem}>
                        {meal.photoUri && (
                          <TouchableOpacity
                            onPress={() => setZoomPhotoUri(meal.photoUri!)}
                          >
                            <Image
                              source={{ uri: meal.photoUri }}
                              style={mealStyles.mealPhoto}
                            />
                          </TouchableOpacity>
                        )}
                        <View style={mealStyles.mealInfo}>
                          <Text style={mealStyles.mealDesc} numberOfLines={1}>
                            {meal.description || "음식"}
                          </Text>
                          <View style={mealStyles.macroRow}>
                            <Text
                              style={[
                                mealStyles.macroText,
                                { color: "#E53E3E" },
                              ]}
                            >
                              탄 {meal.carb}g
                            </Text>
                            <Text
                              style={[
                                mealStyles.macroText,
                                { color: "#3182CE" },
                              ]}
                            >
                              단 {meal.protein}g
                            </Text>
                            <Text
                              style={[
                                mealStyles.macroText,
                                { color: "#D69E2E" },
                              ]}
                            >
                              지 {meal.fat}g
                            </Text>
                            <Text style={mealStyles.macroKcal}>
                              {meal.kcal}kcal
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={mealStyles.mealDeleteBtn}
                          onPress={() => handleDeleteMeal(meal)}
                        >
                          <Text style={mealStyles.mealDeleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    {/* 추가 버튼 */}
                    <TouchableOpacity
                      style={mealStyles.addBtn}
                      onPress={() => openMealModal(mealType)}
                    >
                      <Text style={mealStyles.addBtnText}>+ 음식 추가</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
            )}

            {/* ───── 섭취량 vs 권장량 비교 ───── */}
            {dailyNutrition && meals.length > 0 && (
              <View style={mealStyles.compCard}>
                <Text style={mealStyles.compTitle}>
                  오늘 섭취 현황
                  {challenge?.targetWeight ? " (챌린지)" : " (유지)"}
                </Text>
                <View style={mealStyles.compTotalRow}>
                  <Text style={mealStyles.compTotalKcal}>
                    {dailyIntake.kcal}
                  </Text>
                  <Text style={mealStyles.compTotalUnit}>
                    {" "}
                    / {dailyNutrition.kcal} kcal
                  </Text>
                </View>
                {/* 칼로리 진행 바 */}
                <View style={mealStyles.barTrack}>
                  <View
                    style={[
                      mealStyles.barFill,
                      {
                        width: `${Math.min(100, (dailyIntake.kcal / dailyNutrition.kcal) * 100)}%`,
                        backgroundColor:
                          dailyIntake.kcal > dailyNutrition.kcal
                            ? "#E53E3E"
                            : "#4CAF50",
                      },
                    ]}
                  />
                </View>

                {/* 탄단지 각각 비교 */}
                {(
                  [
                    { key: "carb", label: "탄수화물", color: "#E53E3E" },
                    { key: "protein", label: "단백질", color: "#3182CE" },
                    { key: "fat", label: "지방", color: "#D69E2E" },
                  ] as const
                ).map(({ key, label, color }) => {
                  const intake = dailyIntake[key];
                  const target = dailyNutrition[key];
                  const pct =
                    target > 0 ? Math.min(100, (intake / target) * 100) : 0;
                  return (
                    <View key={key} style={mealStyles.macroCompRow}>
                      <View style={mealStyles.macroCompLabel}>
                        <View
                          style={[
                            mealStyles.macroDot,
                            { backgroundColor: color },
                          ]}
                        />
                        <Text style={mealStyles.macroCompText}>{label}</Text>
                      </View>
                      <View style={mealStyles.macroBarTrack}>
                        <View
                          style={[
                            mealStyles.macroBarFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={mealStyles.macroCompValue}>
                        {intake} / {target}g
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 기록 목록 */}
          <Text style={styles.sectionTitle}>기록 목록</Text>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>
              아직 기록이 없습니다.{"\n"}첫 번째 기록을 추가해보세요!
            </Text>
          ) : (
            <>
              {records.slice(0, visibleRecordCount).map((record) => (
                <View key={record.id} style={styles.recordCard}>
                  <View style={styles.recordTop}>
                    <Text style={styles.recordDate}>
                      {fmtDate(record.date)}
                    </Text>
                    <View style={styles.recordActions}>
                      <TouchableOpacity
                        style={styles.editBtnContainer}
                        onPress={() => handleEdit(record)}
                      >
                        <Text style={styles.editBtn}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtnContainer}
                        onPress={() => handleDelete(record.date)}
                      >
                        <Text style={styles.deleteBtn}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.recordWeight}>{record.weight} kg</Text>
                  {userSettings.height &&
                    (() => {
                      const info = getBmiInfo(
                        record.weight,
                        userSettings.height
                      );
                      if (!info) return null;
                      return (
                        <View style={styles.bmiRow}>
                          <Text style={styles.recordSub}>BMI: {info.bmi}</Text>
                          <View style={styles.bmiBadge}>
                            <Text
                              style={[
                                styles.bmiBadgeText,
                                { color: info.color },
                              ]}
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
                                  { flex: 4.5, backgroundColor: "#C6F6D5" },
                                ]}
                              />
                              <View
                                style={[
                                  styles.bmiBarZone,
                                  { flex: 2, backgroundColor: "#FEEBC8" },
                                ]}
                              />
                              <View
                                style={[
                                  styles.bmiBarZone,
                                  { flex: 15, backgroundColor: "#FED7D7" },
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
                  {userSettings.metricDisplayVisibility?.waist !== false &&
                    record.waist != null && (
                      <Text style={styles.recordSub}>
                        허리: {record.waist} cm
                      </Text>
                    )}
                  {userSettings.metricDisplayVisibility?.muscleMass !== false &&
                    record.muscleMass != null && (
                      <Text style={styles.recordSub}>
                        골격근: {record.muscleMass} kg
                      </Text>
                    )}
                  {userSettings.metricDisplayVisibility?.bodyFatPercent !==
                    false &&
                    record.bodyFatPercent != null && (
                      <Text style={styles.recordSub}>
                        체지방률: {record.bodyFatPercent} %
                      </Text>
                    )}
                  {userSettings.metricDisplayVisibility?.bodyFatMass !==
                    false &&
                    record.bodyFatMass != null && (
                      <Text style={styles.recordSub}>
                        체지방량: {record.bodyFatMass} kg
                      </Text>
                    )}
                  {/* 사용자 정의 수치 표시 */}
                  {(userSettings.customMetrics ?? [])
                    .filter(
                      (cm) =>
                        userSettings.metricDisplayVisibility?.[cm.key] !== false
                    )
                    .map((cm) => {
                      const val = record.customValues?.[cm.key];
                      if (val == null) return null;
                      return (
                        <Text key={cm.key} style={styles.recordSub}>
                          {cm.label}: {val} {cm.unit}
                        </Text>
                      );
                    })}
                  {record.photoUri && (
                    <Image
                      source={{ uri: record.photoUri }}
                      style={styles.recordPhoto}
                    />
                  )}
                  <View style={styles.badgeRow}>
                    {record.exercised && (
                      <View style={[styles.badge, styles.badgeExercise]}>
                        <Text style={styles.badgeText}>운동</Text>
                      </View>
                    )}
                    {record.drank && (
                      <View style={[styles.badge, styles.badgeDrank]}>
                        <Text style={styles.badgeText}>음주</Text>
                      </View>
                    )}
                  </View>
                  {/* 해당 날짜 식사 기록 */}
                  {(() => {
                    const dayMeals = allMeals.filter(
                      (m) => m.date === record.date
                    );
                    if (dayMeals.length === 0) return null;
                    const mealTypes: MealType[] = [
                      "breakfast",
                      "lunch",
                      "dinner",
                      "snack",
                    ];
                    return (
                      <View style={styles.recordMealsSection}>
                        <Text style={styles.recordMealsTitle}>
                          식사 {dayMeals.reduce((s, m) => s + m.kcal, 0)}kcal
                        </Text>
                        {mealTypes.map((mt) => {
                          const items = dayMeals.filter(
                            (m) => m.mealType === mt
                          );
                          if (items.length === 0) return null;
                          return (
                            <View key={mt} style={mealStyles.mealCard}>
                              <View style={mealStyles.mealHeader}>
                                <Text style={mealStyles.mealTitle}>
                                  {MEAL_LABELS[mt]}
                                </Text>
                                {items.length > 0 && (
                                  <Text style={mealStyles.mealKcalBadge}>
                                    {items.reduce((s, m) => s + m.kcal, 0)} kcal
                                  </Text>
                                )}
                              </View>
                              {items.map((meal) => (
                                <View key={meal.id} style={mealStyles.mealItem}>
                                  {meal.photoUri && (
                                    <TouchableOpacity
                                      onPress={() =>
                                        setZoomPhotoUri(meal.photoUri!)
                                      }
                                    >
                                      <Image
                                        source={{ uri: meal.photoUri }}
                                        style={mealStyles.mealPhoto}
                                      />
                                    </TouchableOpacity>
                                  )}
                                  <View style={mealStyles.mealInfo}>
                                    <Text
                                      style={mealStyles.mealDesc}
                                      numberOfLines={1}
                                    >
                                      {meal.description || "음식"}
                                    </Text>
                                    <View style={mealStyles.macroRow}>
                                      <Text
                                        style={[
                                          mealStyles.macroText,
                                          { color: "#E53E3E" },
                                        ]}
                                      >
                                        탄 {meal.carb}g
                                      </Text>
                                      <Text
                                        style={[
                                          mealStyles.macroText,
                                          { color: "#3182CE" },
                                        ]}
                                      >
                                        단 {meal.protein}g
                                      </Text>
                                      <Text
                                        style={[
                                          mealStyles.macroText,
                                          { color: "#D69E2E" },
                                        ]}
                                      >
                                        지 {meal.fat}g
                                      </Text>
                                      <Text style={mealStyles.macroKcal}>
                                        {meal.kcal}kcal
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              ))}
              {visibleRecordCount < records.length && (
                <TouchableOpacity
                  style={{
                    alignItems: "center",
                    paddingVertical: 14,
                    marginBottom: 8,
                    backgroundColor: "#fff",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                  }}
                  onPress={() =>
                    setVisibleRecordCount((c) => c + RECORDS_PER_PAGE)
                  }
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: "#4CAF50",
                    }}
                  >
                    더보기 ({records.length - visibleRecordCount}개 남음)
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>

        {/* 달력 팝업 */}
        <MiniCalendar
          visible={showDatePicker}
          selectedDate={selectedDate}
          onSelect={handleDateSelect}
          onClose={() => setShowDatePicker(false)}
        />

        {/* 식사 입력 모달 */}
        {showMealModal && (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setShowMealModal(false)}
          >
            <View style={mealModalStyles.overlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ width: "100%" }}
              >
                <View style={mealModalStyles.sheet}>
                  {/* 헤더 */}
                  <View style={mealModalStyles.header}>
                    <Text style={mealModalStyles.title}>
                      {MEAL_LABELS[mealModalType]} 추가
                    </Text>
                    <TouchableOpacity onPress={() => setShowMealModal(false)}>
                      <Text style={mealModalStyles.closeBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 45 }}
                  >
                    {/* 사진 선택 */}
                    <View style={mealModalStyles.photoRow}>
                      {mealPhotoUri ? (
                        <View style={{ position: "relative" }}>
                          <Image
                            source={{ uri: mealPhotoUri }}
                            style={mealModalStyles.photoPreview}
                          />
                          {aiAnalyzing && (
                            <View style={mealModalStyles.photoAnalyzingOverlay}>
                              <ActivityIndicator size="large" color="#fff" />
                              <Text style={mealModalStyles.photoAnalyzingText}>
                                AI 분석 중...
                              </Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={mealModalStyles.photoRemove}
                            onPress={() => setMealPhotoUri(undefined)}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              ✕
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={mealModalStyles.photoBtn}
                            onPress={() => handleMealPhotoSelect("camera")}
                          >
                            <Text style={mealModalStyles.photoBtnText}>
                              촬영
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={mealModalStyles.photoBtn}
                            onPress={() => handleMealPhotoSelect("gallery")}
                          >
                            <Text style={mealModalStyles.photoBtnText}>
                              갤러리
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>

                    {/* 음식 이름 */}
                    <Text style={mealModalStyles.label}>음식 이름 *</Text>
                    <TextInput
                      style={mealModalStyles.input}
                      value={mealDesc}
                      onChangeText={setMealDesc}
                      placeholder="예: 닭가슴살 볶음밥"
                      placeholderTextColor="#CBD5E0"
                    />

                    {/* 영양소 입력 */}
                    <Text style={mealModalStyles.label}>
                      영양소 (먹은 양 전체)
                    </Text>
                    <View style={mealModalStyles.macroGrid}>
                      {(
                        [
                          {
                            label: "탄수화물(g)",
                            value: mealCarb,
                            key: "carb",
                            color: "#E53E3E",
                          },
                          {
                            label: "단백질(g)",
                            value: mealProtein,
                            key: "protein",
                            color: "#3182CE",
                          },
                          {
                            label: "지방(g)",
                            value: mealFat,
                            key: "fat",
                            color: "#D69E2E",
                          },
                        ] as const
                      ).map(({ label, value, key, color }) => (
                        <View key={label} style={mealModalStyles.macroField}>
                          <Text style={[mealModalStyles.macroLabel, { color }]}>
                            {label}
                          </Text>
                          <TextInput
                            style={mealModalStyles.macroInput}
                            value={value}
                            onChangeText={(v) => {
                              const c = key === "carb" ? v : mealCarb;
                              const p = key === "protein" ? v : mealProtein;
                              const f = key === "fat" ? v : mealFat;
                              if (key === "carb") setMealCarb(v);
                              if (key === "protein") setMealProtein(v);
                              if (key === "fat") setMealFat(v);
                              const auto = Math.round(
                                (parseFloat(c) || 0) * 4 +
                                  (parseFloat(p) || 0) * 4 +
                                  (parseFloat(f) || 0) * 9
                              );
                              setMealKcal(auto > 0 ? String(auto) : "");
                            }}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#CBD5E0"
                          />
                        </View>
                      ))}
                      <View style={mealModalStyles.macroField}>
                        <Text
                          style={[
                            mealModalStyles.macroLabel,
                            { color: "#718096" },
                          ]}
                        >
                          칼로리(kcal)
                        </Text>
                        <TextInput
                          style={[
                            mealModalStyles.macroInput,
                            { backgroundColor: "#F0F4F8" },
                          ]}
                          value={mealKcal}
                          editable={false}
                          placeholder="자동 계산"
                          placeholderTextColor="#CBD5E0"
                        />
                      </View>
                    </View>
                    <Text style={mealModalStyles.kcalHint}>
                      * 칼로리는 탄단지 입력 시 자동 계산됩니다
                    </Text>

                    <TouchableOpacity
                      style={mealModalStyles.saveBtn}
                      onPress={handleSaveMealEntry}
                    >
                      <Text style={mealModalStyles.saveBtnText}>저장</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        )}

        {/* 편집 팝업 모달 */}
        {showEditModal && (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => {
              setShowEditModal(false);
              setEditRecord(null);
            }}
          >
            <View style={editModalStyles.overlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setShowEditModal(false);
                  setEditRecord(null);
                }}
              />
              <View style={editModalStyles.card}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <Text style={editModalStyles.title}>
                    {editRecord ? `${fmtDate(editRecord.date)} 수정` : "수정"}
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

                  {userSettings.metricInputVisibility?.waist !== false && (
                    <>
                      <Text style={editModalStyles.label}>허리둘레 (cm)</Text>
                      <TextInput
                        style={editModalStyles.input}
                        value={emWaist}
                        onChangeText={setEmWaist}
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </>
                  )}

                  {userSettings.metricInputVisibility?.muscleMass !== false && (
                    <>
                      <Text style={editModalStyles.label}>골격근량 (kg)</Text>
                      <TextInput
                        style={editModalStyles.input}
                        value={emMuscleMass}
                        onChangeText={setEmMuscleMass}
                        keyboardType="decimal-pad"
                        placeholder="선택"
                        placeholderTextColor="#aaa"
                      />
                    </>
                  )}

                  {userSettings.metricInputVisibility?.bodyFatPercent !==
                    false && (
                    <>
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
                    </>
                  )}

                  {userSettings.metricInputVisibility?.bodyFatMass !==
                    false && (
                    <>
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
                        <Text style={editModalStyles.label}>
                          {cm.label} ({cm.unit})
                        </Text>
                        <TextInput
                          style={editModalStyles.input}
                          value={emCustomInputs[cm.key] ?? ""}
                          onChangeText={(v) =>
                            setEmCustomInputs((prev) => ({
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

                  {/* 사진 */}
                  <Text style={editModalStyles.label}>바디 사진</Text>
                  <View style={{ marginBottom: 12 }}>
                    {emPhotoUri ? (
                      <View style={{ position: "relative", marginBottom: 8 }}>
                        <Image
                          source={{ uri: emPhotoUri }}
                          style={{
                            width: "100%",
                            height: 160,
                            borderRadius: 10,
                          }}
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
                          const uri = await takePhoto(
                            "body",
                            userSettings.bodyPhotoQuality
                          );
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
                          {"촬영"}
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
                          const uri = await pickPhoto(
                            "body",
                            userSettings.bodyPhotoQuality
                          );
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
                          {"갤러리"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {userSettings.metricInputVisibility?.["exercised"] !==
                    false && (
                    <View style={editModalStyles.switchRow}>
                      <Text style={editModalStyles.label}>{"🏃 운동"}</Text>
                      <Switch
                        value={emExercised}
                        onValueChange={setEmExercised}
                        trackColor={{ true: "#4CAF50", false: "#ddd" }}
                        thumbColor="#fff"
                      />
                    </View>
                  )}
                  {userSettings.metricInputVisibility?.["drank"] !== false && (
                    <View style={editModalStyles.switchRow}>
                      <Text style={editModalStyles.label}>{"🍺 음주"}</Text>
                      <Switch
                        value={emDrank}
                        onValueChange={setEmDrank}
                        trackColor={{ true: "#FF9800", false: "#ddd" }}
                        thumbColor="#fff"
                      />
                    </View>
                  )}
                  {(userSettings.customBoolMetrics ?? [])
                    .filter(
                      (cbm) =>
                        userSettings.metricInputVisibility?.[cbm.key] !== false
                    )
                    .map((cbm) => (
                      <View key={cbm.key} style={editModalStyles.switchRow}>
                        <Text style={editModalStyles.label}>
                          {cbm.emoji ? `${cbm.emoji} ` : ""}
                          {cbm.label}
                        </Text>
                        <Switch
                          value={emBoolCustomInputs[cbm.key] ?? false}
                          onValueChange={(v) =>
                            setEmBoolCustomInputs((prev) => ({
                              ...prev,
                              [cbm.key]: v,
                            }))
                          }
                          trackColor={{ true: cbm.color, false: "#ddd" }}
                          thumbColor="#fff"
                        />
                      </View>
                    ))}

                  {/* ── 식사 기록 편집 ── */}
                  <View
                    style={{
                      marginTop: 16,
                      borderTopWidth: 1,
                      borderTopColor: "#F0F4F8",
                      paddingTop: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: "#2D3748",
                        marginBottom: 8,
                      }}
                    >
                      식사 기록
                    </Text>
                    {(
                      ["breakfast", "lunch", "dinner", "snack"] as MealType[]
                    ).map((mealType) => {
                      const mealItems = emMeals.filter(
                        (m) => m.mealType === mealType
                      );
                      return (
                        <View key={mealType} style={mealStyles.mealCard}>
                          <View style={mealStyles.mealHeader}>
                            <Text style={mealStyles.mealTitle}>
                              {MEAL_LABELS[mealType]}
                            </Text>
                            {mealItems.length > 0 && (
                              <Text style={mealStyles.mealKcalBadge}>
                                {mealItems.reduce((sum, m) => sum + m.kcal, 0)}{" "}
                                kcal
                              </Text>
                            )}
                          </View>
                          {mealItems.map((meal) => (
                            <View key={meal.id} style={mealStyles.mealItem}>
                              {meal.photoUri && (
                                <TouchableOpacity
                                  onPress={() =>
                                    setZoomPhotoUri(meal.photoUri!)
                                  }
                                >
                                  <Image
                                    source={{ uri: meal.photoUri }}
                                    style={mealStyles.mealPhoto}
                                  />
                                </TouchableOpacity>
                              )}
                              <View style={mealStyles.mealInfo}>
                                <TextInput
                                  style={[
                                    mealStyles.mealDesc,
                                    { padding: 0, marginBottom: 2 },
                                  ]}
                                  value={meal.description ?? ""}
                                  onChangeText={(v) =>
                                    handleEditMealField(
                                      meal.id,
                                      "description",
                                      v
                                    )
                                  }
                                  placeholder="음식 이름"
                                  placeholderTextColor="#CBD5E0"
                                />
                                <View style={mealStyles.macroRow}>
                                  <Text
                                    style={[
                                      mealStyles.macroText,
                                      { color: "#E53E3E" },
                                    ]}
                                  >
                                    탄 {meal.carb}g
                                  </Text>
                                  <Text
                                    style={[
                                      mealStyles.macroText,
                                      { color: "#3182CE" },
                                    ]}
                                  >
                                    단 {meal.protein}g
                                  </Text>
                                  <Text
                                    style={[
                                      mealStyles.macroText,
                                      { color: "#D69E2E" },
                                    ]}
                                  >
                                    지 {meal.fat}g
                                  </Text>
                                  <Text style={mealStyles.macroKcal}>
                                    {meal.kcal}kcal
                                  </Text>
                                </View>
                              </View>
                              <TouchableOpacity
                                style={mealStyles.mealDeleteBtn}
                                onPress={() => handleDeleteEmMeal(meal)}
                              >
                                <Text style={mealStyles.mealDeleteText}>✕</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={mealStyles.addBtn}
                            onPress={() => handleAddMealInEdit(mealType)}
                          >
                            <Text style={mealStyles.addBtnText}>
                              + 음식 추가
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
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
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>

      {/* 사진 확대 모달 */}
      {zoomPhotoUri && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setZoomPhotoUri(null)}
        >
          <TouchableOpacity
            style={zoomStyles.overlay}
            activeOpacity={1}
            onPress={() => setZoomPhotoUri(null)}
          >
            {zoomPhotoUri && (
              <Image
                source={{ uri: zoomPhotoUri }}
                style={zoomStyles.image}
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const zoomStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: width,
    height: width,
  },
});

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

/* ───── 식사 추적 스타일 ───── */
const mealStyles = StyleSheet.create({
  section: { marginBottom: 24 },
  mealCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mealTitle: { fontSize: 16, fontWeight: "600", color: "#2D3748" },
  mealKcalBadge: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4CAF50",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mealItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  mealPhoto: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 10,
  },
  mealInfo: { flex: 1 },
  mealDesc: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 4,
  },
  macroRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  macroText: { fontSize: 12, fontWeight: "500" },
  macroKcal: { fontSize: 12, color: "#718096", fontWeight: "500" },
  mealDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FED7D7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  mealDeleteText: { fontSize: 12, color: "#E53E3E", fontWeight: "700" },
  addBtn: {
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: "600", color: "#4A5568" },

  /* 섭취 vs 권장 비교 */
  compCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  compTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2D3748",
    marginBottom: 10,
  },
  compTotalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  compTotalKcal: { fontSize: 28, fontWeight: "700", color: "#2D3748" },
  compTotalUnit: { fontSize: 14, color: "#718096" },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EDF2F7",
    marginBottom: 16,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 5 },
  macroCompRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  macroCompLabel: {
    flexDirection: "row",
    alignItems: "center",
    width: 70,
  },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  macroCompText: { fontSize: 12, color: "#4A5568", fontWeight: "500" },
  macroBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EDF2F7",
    marginHorizontal: 8,
    overflow: "hidden",
  },
  macroBarFill: { height: "100%", borderRadius: 4 },
  macroCompValue: {
    fontSize: 12,
    color: "#718096",
    width: 80,
    textAlign: "right",
  },
});

const mealModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#2D3748" },
  closeBtn: { fontSize: 18, color: "#718096", padding: 4 },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  photoPreview: { width: 120, height: 90, borderRadius: 10 },
  photoAnalyzingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoAnalyzingText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBtn: {
    flex: 1,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  photoBtnText: { fontSize: 14, fontWeight: "600", color: "#4A5568" },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4A5568",
    marginBottom: 6,
    marginTop: 12,
  },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
    marginBottom: 4,
  },
  searchBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  resultList: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 4,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F7FAFC",
    backgroundColor: "#fff",
  },
  resultName: { fontSize: 14, fontWeight: "600", color: "#2D3748" },
  resultBrand: { fontSize: 13, color: "#718096", fontWeight: "400" },
  resultMacro: { fontSize: 12, color: "#718096", marginTop: 2 },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  macroField: { width: "47%" },
  macroLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  macroInput: {
    height: 40,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#2D3748",
    backgroundColor: "#F7FAFC",
  },
  kcalHint: { fontSize: 11, color: "#A0AEC0", marginBottom: 16 },
  saveBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
  todayLink: {
    marginRight: 6,
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayLinkText: { fontSize: 11, color: "#4CAF50", fontWeight: "700" },

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
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardDateSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardDateArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EDF2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  cardDateArrowText: {
    fontSize: 12,
    color: "#4A5568",
  },
  cardDateTouchable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F7FAFC",
  },
  cardDateText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2D3748",
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
  editBtnContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#EBF8FF",
  },
  editBtn: { fontSize: 13, fontWeight: "600", color: "#3182CE" },
  deleteBtnContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF5F5",
  },
  deleteBtn: { fontSize: 13, fontWeight: "600", color: "#E53E3E" },
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
  recordMealsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F4F8",
  },
  recordMealsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
    marginBottom: 6,
  },
  recordMealItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 8,
  },
  recordMealPhoto: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  recordMealDesc: {
    flex: 1,
    fontSize: 13,
    color: "#2D3748",
  },
  recordMealKcal: {
    fontSize: 12,
    color: "#718096",
    fontWeight: "500",
  },
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
