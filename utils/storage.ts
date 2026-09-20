import {
  Challenge,
  ChallengeHistory,
  FavoriteFood,
  MealEntry,
  MealType,
  UserSettings,
  WeightRecord,
} from "@/types";
import { deleteAllPhotos } from "@/utils/photo";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "weight_records_v1";
const CHALLENGE_KEY = "weight_challenge_v1";
const CHALLENGE_HISTORY_KEY = "weight_challenge_history_v1";
const USER_SETTINGS_KEY = "user_settings_v1";
const MEAL_STORAGE_KEY = "meal_entries_v1";
const FAVORITE_FOOD_KEY = "favorite_foods_v1";

/** 로컬 날짜를 YYYY-MM-DD 형식으로 반환 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 저장된 모든 기록 불러오기 */
export async function loadRecords(): Promise<WeightRecord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as WeightRecord[];
  } catch {
    return [];
  }
}

/** 기록 전체 저장 */
export async function saveRecords(records: WeightRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** 기록 추가 또는 날짜가 같으면 업데이트 */
export async function upsertRecord(
  record: WeightRecord
): Promise<WeightRecord[]> {
  const records = await loadRecords();
  const idx = records.findIndex((r) => r.date === record.date);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  await saveRecords(records);
  return records;
}

/** 특정 날짜 기록 삭제 */
export async function deleteRecord(date: string): Promise<WeightRecord[]> {
  const records = await loadRecords();
  const filtered = records.filter((r) => r.date !== date);
  await saveRecords(filtered);
  return filtered;
}

/** 전체 기록 삭제 (체중 + 식사 + 챌린지 + 히스토리 + 토글 + 사용자 설정 + 즐겨찾기 음식 전체) */
export async function clearAllRecords(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(MEAL_STORAGE_KEY);
  await AsyncStorage.removeItem(CHALLENGE_KEY);
  await AsyncStorage.removeItem(CHALLENGE_HISTORY_KEY);
  await AsyncStorage.removeItem(FAVORITE_FOOD_KEY);
  // 프로필 포함 사용자 설정 전체 초기화
  await AsyncStorage.removeItem(USER_SETTINGS_KEY);
  await deleteAllPhotos();
}

/* ───── 챌린지 저장/불러오기 ───── */

export async function loadChallenge(): Promise<Challenge | null> {
  try {
    const data = await AsyncStorage.getItem(CHALLENGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as Challenge;
  } catch {
    return null;
  }
}

export async function saveChallenge(challenge: Challenge): Promise<void> {
  await AsyncStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
}

export async function deleteChallenge(): Promise<void> {
  await AsyncStorage.removeItem(CHALLENGE_KEY);
}

/* ───── 챌린지 히스토리 ───── */

export async function loadChallengeHistory(): Promise<ChallengeHistory[]> {
  try {
    const data = await AsyncStorage.getItem(CHALLENGE_HISTORY_KEY);
    if (!data) return [];
    return JSON.parse(data) as ChallengeHistory[];
  } catch {
    return [];
  }
}

export async function saveChallengeHistory(
  history: ChallengeHistory[]
): Promise<void> {
  await AsyncStorage.setItem(CHALLENGE_HISTORY_KEY, JSON.stringify(history));
}

export async function addChallengeToHistory(
  entry: ChallengeHistory
): Promise<ChallengeHistory[]> {
  const history = await loadChallengeHistory();
  history.unshift(entry);
  await saveChallengeHistory(history);
  return history;
}

/* ───── 사용자 설정 ───── */

export async function loadUserSettings(): Promise<UserSettings> {
  try {
    const data = await AsyncStorage.getItem(USER_SETTINGS_KEY);
    if (!data) return {};
    return JSON.parse(data) as UserSettings;
  } catch {
    return {};
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  await AsyncStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
}

/** Delete a metric or bool metric by key. If preserve=false, remove associated values from records and back them up in user settings. */
export async function deleteMetricByKey(
  key: string,
  isBool: boolean,
  preserve: boolean
): Promise<void> {
  const settings = await loadUserSettings();
  const nextSettings = { ...settings } as any;

  // remove from custom lists
  if (isBool) {
    nextSettings.customBoolMetrics = (
      nextSettings.customBoolMetrics ?? []
    ).filter((c: any) => c.key !== key);
    nextSettings.boolMetricConfigs = (
      nextSettings.boolMetricConfigs ?? []
    ).filter((c: any) => c.key !== key);
  } else {
    nextSettings.customMetrics = (nextSettings.customMetrics ?? []).filter(
      (c: any) => c.key !== key
    );
    nextSettings.metricConfigs = (nextSettings.metricConfigs ?? []).filter(
      (c: any) => c.key !== key
    );
  }

  // if preserve=false, remove values from records with backup
  if (!preserve) {
    const records = await loadRecords();
    const backupValues: Record<string, number | boolean> = {};
    const nextRecords = records.map((r) => {
      const nr = { ...r } as any;
      if (isBool) {
        if (nr.customBoolValues && nr.customBoolValues[key] !== undefined) {
          backupValues[nr.date] = nr.customBoolValues[key];
          delete nr.customBoolValues[key];
        }
        // builtin bools
        if (key === "exercised" && nr.exercised !== undefined) {
          backupValues[nr.date] = nr.exercised;
          delete nr.exercised;
        }
        if (key === "drank" && nr.drank !== undefined) {
          backupValues[nr.date] = nr.drank;
          delete nr.drank;
        }
      } else {
        // numeric metrics
        if (nr.customValues && nr.customValues[key] !== undefined) {
          backupValues[nr.date] = nr.customValues[key];
          delete nr.customValues[key];
        }
        // builtin metrics
        if (key === "waist" && nr.waist !== undefined) {
          backupValues[nr.date] = nr.waist;
          delete nr.waist;
        }
        if (key === "muscleMass" && nr.muscleMass !== undefined) {
          backupValues[nr.date] = nr.muscleMass;
          delete nr.muscleMass;
        }
        if (key === "bodyFatPercent" && nr.bodyFatPercent !== undefined) {
          backupValues[nr.date] = nr.bodyFatPercent;
          delete nr.bodyFatPercent;
        }
        if (key === "bodyFatMass" && nr.bodyFatMass !== undefined) {
          backupValues[nr.date] = nr.bodyFatMass;
          delete nr.bodyFatMass;
        }
      }
      return nr;
    });
    // save updated records
    await saveRecords(nextRecords as WeightRecord[]);

    // attach backup to settings
    nextSettings.deletedMetricBackups = {
      ...(nextSettings.deletedMetricBackups ?? {}),
      [key]: { type: isBool ? "bool" : "metric", values: backupValues },
    };
  }

  await saveUserSettings(nextSettings);
}

/* ───── 식사 기록 ───── */

export async function loadMeals(date?: string): Promise<MealEntry[]> {
  try {
    const data = await AsyncStorage.getItem(MEAL_STORAGE_KEY);
    if (!data) return [];
    const all = JSON.parse(data) as MealEntry[];
    if (date) return all.filter((m) => m.date === date);
    return all;
  } catch {
    return [];
  }
}

export async function saveMeals(meals: MealEntry[]): Promise<void> {
  await AsyncStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(meals));
}

export async function addMeal(entry: MealEntry): Promise<MealEntry[]> {
  const all = await loadMeals();
  all.push(entry);
  await saveMeals(all);
  return all;
}

export async function deleteMeal(id: string): Promise<MealEntry[]> {
  const all = await loadMeals();
  const filtered = all.filter((m) => m.id !== id);
  await saveMeals(filtered);
  return filtered;
}

/* ───── 즐겨찾기 음식 ───── */

function normalizeFavoriteFoodName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function loadFavoriteFoods(): Promise<FavoriteFood[]> {
  try {
    const data = await AsyncStorage.getItem(FAVORITE_FOOD_KEY);
    if (!data) return [];
    return JSON.parse(data) as FavoriteFood[];
  } catch {
    return [];
  }
}

export async function saveFavoriteFoods(foods: FavoriteFood[]): Promise<void> {
  await AsyncStorage.setItem(FAVORITE_FOOD_KEY, JSON.stringify(foods));
}

export async function toggleFavoriteFood(id: string): Promise<FavoriteFood[]> {
  const all = await loadFavoriteFoods();
  const updated = all.map((food) =>
    food.id === id ? { ...food, isFavorite: !food.isFavorite } : food
  );
  await saveFavoriteFoods(updated);
  return updated;
}

export async function addFavoriteFood(
  food: Omit<FavoriteFood, "id" | "createdAt">
): Promise<FavoriteFood[]> {
  const all = await loadFavoriteFoods();
  const normalized = normalizeFavoriteFoodName(food.name);
  const exists = all.some(
    (item) => normalizeFavoriteFoodName(item.name) === normalized
  );
  if (exists) {
    throw new Error("이미 저장된 음식입니다.");
  }

  const entry: FavoriteFood = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    isFavorite: Boolean(food.isFavorite),
    ...food,
    name: food.name.trim(),
  };
  all.unshift(entry);
  await saveFavoriteFoods(all);
  return all;
}

export async function setFavoriteFoodOrder(
  foods: FavoriteFood[]
): Promise<FavoriteFood[]> {
  await saveFavoriteFoods(foods);
  return foods;
}

export async function deleteFavoriteFood(id: string): Promise<FavoriteFood[]> {
  const all = await loadFavoriteFoods();
  const filtered = all.filter((f) => f.id !== id);
  await saveFavoriteFoods(filtered);
  return filtered;
}
