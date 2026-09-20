/**
 * 광고 카운터 & 전면 광고 관리
 *
 * - AI 분석: 하루 2회 무료 (KST 00:00 리셋)
 * - 체중 저장: 누적 3회마다 전면 광고 (리셋 안 됨)
 * - 전면 광고(interstitial) 로드 & 노출
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { initMobileAds } from "@/utils/ads-init";

/* ─── Storage Keys ─── */
const AI_COUNT_KEY = "ad_ai_daily_count"; // { date: "YYYY-MM-DD", count: number }
const WEIGHT_SAVE_COUNT_KEY = "ad_weight_save_count"; // number (누적)
const WEIGHT_SAVE_AD_COOLDOWN_KEY = "ad_weight_save_cooldown_ts"; // number (ms, 마지막 광고 노출 시각)

/* ─── 상수 ─── */
const FREE_AI_LIMIT = 2; // 무료 AI 분석 횟수/일
const WEIGHT_AD_INTERVAL = 3; // 3회마다 전면 광고
const WEIGHT_SAVE_AD_COOLDOWN_MS = 15 * 60 * 1000; // 15분 쿨다운

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
async function resetAiCount(): Promise<void> {
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

async function loadWeightSaveAdCooldownTs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WEIGHT_SAVE_AD_COOLDOWN_KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function markWeightSaveAdShown(): Promise<void> {
  await AsyncStorage.setItem(WEIGHT_SAVE_AD_COOLDOWN_KEY, String(Date.now()));
}

/**
 * 체중 저장 1회 기록
 * @returns 전면 광고를 보여야 하면 true
 *
 * 마지막 광고 노출 후 15분 동안은 저장 카운트를 올리지 않는다.
 */
export async function recordWeightSave(): Promise<boolean> {
  const lastShownAt = await loadWeightSaveAdCooldownTs();
  const now = Date.now();

  if (lastShownAt > 0 && now - lastShownAt < WEIGHT_SAVE_AD_COOLDOWN_MS) {
    return false;
  }

  const count = (await loadWeightSaveCount()) + 1;
  await AsyncStorage.setItem(WEIGHT_SAVE_COUNT_KEY, String(count));
  // 3, 6, 9, 12, ... 번째에 광고
  return count % WEIGHT_AD_INTERVAL === 0;
}

/** 체중 저장 카운터 초기화 */
async function resetWeightSaveCount(): Promise<void> {
  await AsyncStorage.removeItem(WEIGHT_SAVE_COUNT_KEY);
  await AsyncStorage.removeItem(WEIGHT_SAVE_AD_COOLDOWN_KEY);
}

/* ═══════════════════════════════════════════════════
   전면 광고 (Interstitial)
   ═══════════════════════════════════════════════════ */

let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;

function isPreviewVariant() {
  const appVariant = (
    Constants.expoConfig?.extra as { appVariant?: string } | undefined
  )?.appVariant;
  return appVariant === "preview";
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("react-native-google-mobile-ads");
  InterstitialAd = m.InterstitialAd;
  AdEventType = m.AdEventType;
  TestIds = m.TestIds;
} catch {}

function getInterstitialUnitId(): string | null {
  const testInterstitialId =
    TestIds?.INTERSTITIAL ?? "ca-app-pub-3940256099942544/1033173712";

  if (__DEV__ || isPreviewVariant()) return testInterstitialId;

  return (
    Platform.select({
      android: "ca-app-pub-1379550026930118/2889199125",
      ios: "ca-app-pub-1379550026930118/2889199125",
      default: testInterstitialId,
    }) ?? null
  );
}

/**
 * 전면 광고를 로드하고 즉시 표시
 * 네이티브 모듈이 없거나 로드 실패 시 조용히 무시
 */
export async function showInterstitialAd(): Promise<boolean> {
  try {
    await initMobileAds();
  } catch {}

  return new Promise((resolve) => {
    const unitId = getInterstitialUnitId();
    if (!InterstitialAd || !AdEventType || !unitId) {
      resolve(false);
      return;
    }

    try {
      const ad = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      let resolved = false;
      const done = (success: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(success);
        }
      };

      // 광고 닫힘
      ad.addAdEventListener(AdEventType.CLOSED, async () => {
        await markWeightSaveAdShown();
        done(true);
      });

      // 로드 실패 → 조용히 넘김
      ad.addAdEventListener(AdEventType.ERROR, () => {
        console.log("[InterstitialAd] 로드 실패, 건너뜀");
        done(false);
      });

      // 로드 완료 → 표시
      ad.addAdEventListener(AdEventType.LOADED, () => {
        ad.show().catch(() => done(false));
      });

      ad.load();

      // 10초 타임아웃 (광고 서버 무응답 대비)
      setTimeout(() => done(false), 10000);
    } catch {
      resolve(false);
    }
  });
}

/* ═══════════════════════════════════════════════════
   리워드 광고 (Rewarded)
   ═══════════════════════════════════════════════════ */

let RewardedAd: any = null;
let RewardedAdEventType: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("react-native-google-mobile-ads");
  RewardedAd = m.RewardedAd;
  RewardedAdEventType = m.RewardedAdEventType;
} catch {}

function getRewardedUnitId(): string | null {
  const testRewardedId = "ca-app-pub-3940256099942544/5224354917";

  if (__DEV__ || isPreviewVariant()) {
    return TestIds?.REWARDED ?? testRewardedId;
  }

  return (
    Platform.select({
      android: "ca-app-pub-1379550026930118/9813815068",
      ios: "ca-app-pub-1379550026930118/9813815068",
      default: testRewardedId,
    }) ?? null
  );
}

/**
 * 리워드 광고를 로드·표시하고, 시청 완료 시 AI 일일 카운터를 리셋
 * @returns 리워드 획득 성공 여부
 */
export async function showRewardedAdForAi(): Promise<boolean> {
  try {
    await initMobileAds();
  } catch {}

  return new Promise((resolve) => {
    const unitId = getRewardedUnitId();
    if (!RewardedAd || !RewardedAdEventType || !AdEventType || !unitId) {
      console.log("[RewardedAd] unavailable", {
        RewardedAd: !!RewardedAd,
        RewardedAdEventType: !!RewardedAdEventType,
        AdEventType: !!AdEventType,
        unitId,
      });
      resolve(false);
      return;
    }

    try {
      const ad = RewardedAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      let resolved = false;
      let rewarded = false;
      const done = (success: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(success);
        }
      };

      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch((error: any) => {
          console.log("[RewardedAd] show failed:", error);
          done(false);
        });
      });

      ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        async (reward: any) => {
          rewarded = true;
          await resetAiCount();
        }
      );

      ad.addAdEventListener(AdEventType.CLOSED, () => {
        done(rewarded);
      });

      ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.log("[RewardedAd] exception while creating/loading ad:", error);
        done(false);
      });

      ad.load();

      setTimeout(() => {
        console.log("[RewardedAd] timeout reached");
        done(false);
      }, 15000);
    } catch (error) {
      console.log("[RewardedAd] exception while creating/loading ad:", error);
      resolve(false);
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
