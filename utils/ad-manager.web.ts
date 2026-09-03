/**
 * 광고 카운터 & 전면 광고 관리 (웹 전용 스텁)
 * 웹에는 AdMob 네이티브 SDK가 없으므로 광고 표시 함수는 즉시 완료 처리
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ─── Storage Keys ─── */
const AI_COUNT_KEY = "ad_ai_daily_count";
const WEIGHT_SAVE_COUNT_KEY = "ad_weight_save_count";

/* ─── 상수 ─── */
export const FREE_AI_LIMIT = 2;
const WEIGHT_AD_INTERVAL = 3;

function getKSTDateString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type AiDailyData = { date: string; count: number };

async function loadAiDailyData(): Promise<AiDailyData> {
  try {
    const raw = await AsyncStorage.getItem(AI_COUNT_KEY);
    if (raw) {
      const data: AiDailyData = JSON.parse(raw);
      if (data.date === getKSTDateString()) return data;
    }
  } catch {}
  return { date: getKSTDateString(), count: 0 };
}

export async function getAiRemainingCount(): Promise<number> {
  const data = await loadAiDailyData();
  return Math.max(0, FREE_AI_LIMIT - data.count);
}

export async function getAiUsedCount(): Promise<number> {
  const data = await loadAiDailyData();
  return data.count;
}

export async function recordAiUsage(): Promise<boolean> {
  const data = await loadAiDailyData();
  data.count += 1;
  await AsyncStorage.setItem(AI_COUNT_KEY, JSON.stringify(data));
  return data.count <= FREE_AI_LIMIT;
}

export async function resetAiCount(): Promise<void> {
  await AsyncStorage.removeItem(AI_COUNT_KEY);
}

async function loadWeightSaveCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WEIGHT_SAVE_COUNT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function recordWeightSave(): Promise<boolean> {
  const count = (await loadWeightSaveCount()) + 1;
  await AsyncStorage.setItem(WEIGHT_SAVE_COUNT_KEY, String(count));
  return count % WEIGHT_AD_INTERVAL === 0;
}

export async function getWeightSaveCount(): Promise<number> {
  return loadWeightSaveCount();
}

export async function resetWeightSaveCount(): Promise<void> {
  await AsyncStorage.removeItem(WEIGHT_SAVE_COUNT_KEY);
}

/** 웹에는 전면 광고 SDK가 없으므로 즉시 완료 처리 */
export function showInterstitialAd(): Promise<void> {
  return Promise.resolve();
}

/** 웹에는 리워드 광고 SDK가 없으므로 보상 없이 즉시 완료 처리 */
export function showRewardedAdForAi(): Promise<boolean> {
  return Promise.resolve(false);
}

export async function resetAllAdCounters(): Promise<void> {
  await resetAiCount();
  await resetWeightSaveCount();
}
