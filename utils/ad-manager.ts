/**
 * 광고 카운터 & 전면 광고 관리
 *
 * - AI 분석: 하루 2회 무료 (KST 00:00 리셋)
 * - 체중 저장: 누적 3회마다 전면 광고 (리셋 안 됨)
 * - 전면 광고(interstitial) 로드 & 노출
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/* ─── Storage Keys ─── */
const AI_COUNT_KEY = "ad_ai_daily_count"; // { date: "YYYY-MM-DD", count: number }
const WEIGHT_SAVE_COUNT_KEY = "ad_weight_save_count"; // number (누적)

/* ─── 상수 ─── */
export const FREE_AI_LIMIT = 2; // 무료 AI 분석 횟수/일
const WEIGHT_AD_INTERVAL = 3; // 3회마다 전면 광고

/* ─── KST 오늘 날짜 ─── */
function getKSTDateString(): string {
  const now = new Date();
  // UTC + 9시간 = KST
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ═══════════════════════════════════════════════════
   AI 분석 일일 카운터
   ═══════════════════════════════════════════════════ */

type AiDailyData = { date: string; count: number };

async function loadAiDailyData(): Promise<AiDailyData> {
  try {
    const raw = await AsyncStorage.getItem(AI_COUNT_KEY);
    if (raw) {
      const data: AiDailyData = JSON.parse(raw);
      // KST 날짜가 바뀌면 리셋
      if (data.date === getKSTDateString()) return data;
    }
  } catch {}
  return { date: getKSTDateString(), count: 0 };
}

/** 오늘 남은 무료 AI 분석 횟수 */
export async function getAiRemainingCount(): Promise<number> {
  const data = await loadAiDailyData();
  return Math.max(0, FREE_AI_LIMIT - data.count);
}

/** 오늘 사용한 AI 분석 횟수 */
export async function getAiUsedCount(): Promise<number> {
  const data = await loadAiDailyData();
  return data.count;
}

/**
 * AI 분석 1회 사용 기록
 * @returns 무료 범위 내면 true, 초과면 false (전면 광고 필요)
 */
export async function recordAiUsage(): Promise<boolean> {
  const data = await loadAiDailyData();
  data.count += 1;
  await AsyncStorage.setItem(AI_COUNT_KEY, JSON.stringify(data));
  return data.count <= FREE_AI_LIMIT;
}

/** AI 일일 카운터 초기화 */
export async function resetAiCount(): Promise<void> {
  await AsyncStorage.removeItem(AI_COUNT_KEY);
}

/* ═══════════════════════════════════════════════════
   체중 저장 누적 카운터
   ═══════════════════════════════════════════════════ */

async function loadWeightSaveCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WEIGHT_SAVE_COUNT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * 체중 저장 1회 기록
 * @returns 전면 광고를 보여야 하면 true
 */
export async function recordWeightSave(): Promise<boolean> {
  const count = (await loadWeightSaveCount()) + 1;
  await AsyncStorage.setItem(WEIGHT_SAVE_COUNT_KEY, String(count));
  // 3, 6, 9, 12, ... 번째에 광고
  return count % WEIGHT_AD_INTERVAL === 0;
}

/** 누적 체중 저장 횟수 */
export async function getWeightSaveCount(): Promise<number> {
  return loadWeightSaveCount();
}

/** 체중 저장 카운터 초기화 */
export async function resetWeightSaveCount(): Promise<void> {
  await AsyncStorage.removeItem(WEIGHT_SAVE_COUNT_KEY);
}

/* ═══════════════════════════════════════════════════
   전면 광고 (Interstitial)
   ═══════════════════════════════════════════════════ */

let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("react-native-google-mobile-ads");
  InterstitialAd = m.InterstitialAd;
  AdEventType = m.AdEventType;
  TestIds = m.TestIds;
} catch {}

function getInterstitialUnitId(): string | null {
  if (!TestIds) return null;
  if (__DEV__) return TestIds.INTERSTITIAL;
  return (
    Platform.select({
      android: "ca-app-pub-1379550026930118/2889199125",
      ios: "ca-app-pub-1379550026930118/2889199125",
      default: TestIds.INTERSTITIAL,
    }) ?? null
  );
}

/**
 * 전면 광고를 로드하고 즉시 표시
 * 네이티브 모듈이 없거나 로드 실패 시 조용히 무시
 */
export function showInterstitialAd(): Promise<void> {
  return new Promise((resolve) => {
    const unitId = getInterstitialUnitId();
    if (!InterstitialAd || !AdEventType || !unitId) {
      resolve();
      return;
    }

    try {
      const ad = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // 광고 닫힘
      ad.addAdEventListener(AdEventType.CLOSED, done);

      // 로드 실패 → 조용히 넘김
      ad.addAdEventListener(AdEventType.ERROR, () => {
        console.log("[InterstitialAd] 로드 실패, 건너뜀");
        done();
      });

      // 로드 완료 → 표시
      ad.addAdEventListener(AdEventType.LOADED, () => {
        ad.show().catch(done);
      });

      ad.load();

      // 10초 타임아웃 (광고 서버 무응답 대비)
      setTimeout(done, 10000);
    } catch {
      resolve();
    }
  });
}

/**
 * 모든 광고 카운터 초기화 (데이터 삭제 시 호출)
 */
export async function resetAllAdCounters(): Promise<void> {
  await resetAiCount();
  await resetWeightSaveCount();
}
