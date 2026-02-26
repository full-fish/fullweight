/**
 * RevenueCat 인앱 결제 유틸리티
 *
 * ─── 상품 구조 ───
 * 1. 배너 광고 제거 (lifetime) — $1.49
 * 2. AI 모델 구독 (monthly $1.99 / yearly $19.9)
 *    → 무제한 AI + gpt-4o + 모든 광고 제거
 * 3. 개발자에게 맥주 사주기 (consumable) — $1.49 / $1.99 / $3.49
 *
 * ─── Entitlement 식별자 ───
 * "banner_removal" — 배너 광고 제거 (lifetime 구매 또는 AI 구독 포함)
 * "ai_pro"         — AI 무제한 + gpt-4o + 모든 광고 제거 (구독)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

// ─── RevenueCat SDK 키 ───────────────────────────────────────────────────────
const RC_ANDROID_KEY = "goog_bnVsZuOogtNyxYWxiiUEkZmzlLy";
const RC_IOS_KEY = "";

// ─── Entitlement 식별자 ────────────────────────────────────────────────────
export const ENTITLEMENT_BANNER_REMOVAL = "banner_removal";
export const ENTITLEMENT_AI_PRO = "ai_pro";

// ─── 개발자 강제 무료 오버라이드 (멤버십 초기화 버튼용) ───────────────────────
// 이 값이 "1"이면 RevenueCat 응답과 무관하게 무료 유저로 취급
const MEMBERSHIP_FREE_OVERRIDE_KEY = "membership_free_override";

/** 유저의 현재 구매 상태 */
export type MembershipStatus = {
  /** 배너 광고 제거 여부 (lifetime 또는 AI 구독 포함) */
  bannerRemoved: boolean;
  /** AI PRO 구독 여부 (무제한 AI + gpt-4o + 모든 광고 제거) */
  aiPro: boolean;
};

/**
 * 앱 시작 시 RevenueCat 초기화 (앱 전역에서 1회만 호출)
 * ⚠️ 네이티브 모듈 필요 — Expo Go에서는 작동하지 않음 (dev client 빌드 필요)
 */
export async function initPurchases(userId?: string) {
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    const apiKey = Platform.select({
      android: RC_ANDROID_KEY,
      ios: RC_IOS_KEY || RC_ANDROID_KEY,
    })!;

    await Purchases.configure({ apiKey });

    if (userId) {
      await Purchases.logIn(userId).catch(() => {});
    }
  } catch (e) {
    console.warn("[RevenueCat] initPurchases 실패 (dev client 빌드 필요):", e);
  }
}

/**
 * 멤버십 상태를 확인
 */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  try {
    // 개발자 도구로 강제 무료 전환된 경우 → RevenueCat 무시하고 즉시 free 반환
    const override = await AsyncStorage.getItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    if (override === "1") {
      return { bannerRemoved: false, aiPro: false };
    }

    const info = await Purchases.getCustomerInfo();
    const active = info.entitlements.active;

    const aiPro =
      active[ENTITLEMENT_AI_PRO] !== undefined ||
      // entitlement 연결 전 활성 구독이 있으면 ai_pro로 간주
      info.activeSubscriptions.length > 0;

    const bannerRemoved =
      aiPro ||
      active[ENTITLEMENT_BANNER_REMOVAL] !== undefined ||
      // nonSubscriptionTransactions에 배너 제거 구매가 있을 수 있음
      info.nonSubscriptionTransactions.length > 0;

    return { bannerRemoved, aiPro };
  } catch {
    return { bannerRemoved: false, aiPro: false };
  }
}

/**
 * (하위 호환) 어떤 유료 구매든 있는지 확인
 */
export async function hasAnyPurchase(): Promise<boolean> {
  const s = await getMembershipStatus();
  return s.bannerRemoved || s.aiPro;
}

/**
 * 현재 판매 중인 Offering(상품 묶음) 가져오기
 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

/**
 * 특정 패키지 구매
 * @returns 구매 성공 여부
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<{ success: boolean; error?: string }> {
  try {
    await Purchases.purchasePackage(pkg);
    // 구매 성공 → 강제 무료 오버라이드 해제
    await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    return { success: true };
  } catch (e: any) {
    if (e.userCancelled) return { success: false };
    return { success: false, error: e.message || "구매에 실패했습니다." };
  }
}

/**
 * 구매 내역 복원 (기기 변경, 재설치 시)
 * @returns 복원 후 MembershipStatus
 */
export async function restorePurchases(): Promise<MembershipStatus> {
  try {
    // 복원 전 오버라이드 해제 → RevenueCat 실제 데이터 읽기
    await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    await Purchases.restorePurchases();
    return getMembershipStatus();
  } catch {
    return { bannerRemoved: false, aiPro: false };
  }
}

/**
 * 현재 유저를 로그아웃 (데이터 삭제 시)
 * 익명 유저로 전환됨
 */
export async function logoutPurchases(): Promise<void> {
  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) {
      await Purchases.logOut();
    }
  } catch {}
  // RevenueCat 캐시와 무관하게 즉시 무료 상태로 전환
  // (익명 유저이거나 logOut이 실패해도 강제로 free 처리)
  await AsyncStorage.setItem(MEMBERSHIP_FREE_OVERRIDE_KEY, "1");
}
