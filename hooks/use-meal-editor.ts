/**
 * 식사 편집 공통 훅
 * index.tsx / calendar.tsx에서 중복되던 식사 추가/수정/삭제/AI분석 로직을 통합
 */
import {
  AiModelOption,
  FoodPhotoQuality,
  MEAL_LABELS,
  MealEntry,
  MealType,
} from "@/types";
import { recordAiUsage, showInterstitialAd } from "@/utils/ad-manager";
import { analyzeFood } from "@/utils/food-ai";
import { captureFoodPhoto, deletePhoto } from "@/utils/photo";
import { addMeal, deleteMeal, loadMeals, saveMeals } from "@/utils/storage";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

type MealEditorOptions = {
  /** AI 분석 시 사용할 모델 */
  aiModel?: AiModelOption;
  /** 음식 사진 화질 */
  foodPhotoQuality?: FoodPhotoQuality;
  /** AI PRO 구독 여부 (true면 제한 없음) */
  aiPro?: boolean;
};

/**
 * 식사 입력 모달의 state와 핸들러를 관리하는 훅
 */
export function useMealInputModal(options: MealEditorOptions = {}) {
  const [visible, setVisible] = useState(false);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [desc, setDesc] = useState("");
  const [carb, setCarb] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [kcal, setKcal] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const open = useCallback((type: MealType) => {
    setMealType(type);
    setPhotoUri(undefined);
    setDesc("");
    setCarb("");
    setProtein("");
    setFat("");
    setKcal("");
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  const handlePhotoSelect = useCallback(
    async (source: "camera" | "gallery") => {
      const captured = await captureFoodPhoto(source, options.foodPhotoQuality);
      if (!captured) return;
      setPhotoUri(captured.savedUri);
      setAiAnalyzing(true);
      try {
        // AI 사용량 기록 (PRO가 아닌 경우)
        if (!options.aiPro) {
          const isFree = await recordAiUsage();
          if (!isFree) {
            // 3회차부터 전면 광고 표시
            await showInterstitialAd();
          }
        }

        const result = await analyzeFood(captured.aiUri, options.aiModel);
        setDesc(result.description);
        setCarb(String(result.carb));
        setProtein(String(result.protein));
        setFat(String(result.fat));
        setKcal(String(result.kcal));
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
    },
    [options.aiModel, options.foodPhotoQuality, options.aiPro]
  );

  /** 탄단지 입력 시 칼로리 자동 계산 */
  const updateMacro = useCallback(
    (key: "carb" | "protein" | "fat", value: string) => {
      const c = key === "carb" ? value : carb;
      const p = key === "protein" ? value : protein;
      const f = key === "fat" ? value : fat;
      if (key === "carb") setCarb(value);
      if (key === "protein") setProtein(value);
      if (key === "fat") setFat(value);
      const auto = Math.round(
        (parseFloat(c) || 0) * 4 +
          (parseFloat(p) || 0) * 4 +
          (parseFloat(f) || 0) * 9
      );
      setKcal(auto > 0 ? String(auto) : "");
    },
    [carb, protein, fat]
  );

  /**
   * 새 식사 항목을 저장하고 반환
   * @param date 기록 대상 날짜
   * @returns 저장된 전체 MealEntry[] (실패 시 null)
   */
  const save = useCallback(
    async (date: string): Promise<MealEntry[] | null> => {
      if (!desc.trim()) {
        Alert.alert("입력 오류", "음식 이름을 입력해주세요.");
        return null;
      }
      const carbVal = parseFloat(carb) || 0;
      const proteinVal = parseFloat(protein) || 0;
      const fatVal = parseFloat(fat) || 0;
      const kcalVal =
        parseFloat(kcal) ||
        Math.round(carbVal * 4 + proteinVal * 4 + fatVal * 9);

      const entry: MealEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date,
        mealType,
        photoUri,
        description: desc.trim(),
        carb: carbVal,
        protein: proteinVal,
        fat: fatVal,
        kcal: kcalVal,
        createdAt: new Date().toISOString(),
      };
      const updated = await addMeal(entry);
      setVisible(false);
      return updated;
    },
    [desc, carb, protein, fat, kcal, mealType, photoUri]
  );

  return {
    visible,
    mealType,
    photoUri,
    setPhotoUri,
    desc,
    setDesc,
    carb,
    protein,
    fat,
    kcal,
    aiAnalyzing,
    open,
    close,
    handlePhotoSelect,
    updateMacro,
    save,
  };
}

/**
 * 편집 모드에서의 식사 목록 관리 (기존 기록 편집 시)
 */
export function useMealListEditor() {
  const [meals, setMeals] = useState<MealEntry[]>([]);

  const load = useCallback(async (date: string) => {
    const all = await loadMeals(date);
    setMeals(all);
  }, []);

  const handleDelete = useCallback((meal: MealEntry) => {
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
            setMeals(updated.filter((m) => m.date === meal.date));
            return updated;
          },
        },
      ]
    );
  }, []);

  const handleFieldEdit = useCallback(
    (mealId: string, field: keyof MealEntry, value: string) => {
      setMeals((prev) =>
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
    },
    []
  );

  /** 편집된 식사 목록을 스토리지에 반영 */
  const saveAll = useCallback(
    async (date: string): Promise<MealEntry[]> => {
      const all = await loadMeals();
      const otherMeals = all.filter((m) => m.date !== date);
      const merged = [...otherMeals, ...meals];
      await saveMeals(merged);
      return merged;
    },
    [meals]
  );

  /** 새로 추가된 meal을 편집 목록에 반영 */
  const addToList = useCallback((allUpdated: MealEntry[], date: string) => {
    setMeals(allUpdated.filter((m) => m.date === date));
  }, []);

  return {
    meals,
    setMeals,
    load,
    handleDelete,
    handleFieldEdit,
    saveAll,
    addToList,
  };
}
