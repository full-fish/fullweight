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

type PurchasesOffering = any;
type PurchasesPackage = any;

const getNativeRequire = () => Function("return require")();

const resolveNativeModule = (pkg: string): any => {
  if (Platform.OS === "web") return null;

  try {
    const nativeRequire = getNativeRequire();
    return nativeRequire(pkg);
  } catch {
    return null;
  }
};

const purchasesModule = resolveNativeModule("react-native-purchases");
const Purchases = purchasesModule?.default ?? purchasesModule ?? null;
const LOG_LEVEL = purchasesModule?.LOG_LEVEL ?? { DEBUG: 3 };

// ─── 개발자 이메일 (프로덕션에서도 무조건 PRO) ──────────────────────────────
const OWNER_EMAIL = "manseon94@gmail.com";

// ─── RevenueCat SDK 키 ───────────────────────────────────────────────────────
const RC_ANDROID_KEY =
  process.env.EXPO_PUBLIC_RC_ANDROID_KEY || "goog_bnVsZuOogtNyxYWxiiUEkZmzlLy";
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? "";

// ─── Entitlement 식별자 ────────────────────────────────────────────────────
export const ENTITLEMENT_BANNER_REMOVAL = "banner_removal";
export const ENTITLEMENT_AI_PRO = "ai_pro";

// ─── 개발자 강제 무료 오버라이드 (멤버십 초기화 버튼용) ───────────────────────
// 이 값이 "1"이면 RevenueCat 응답과 무관하게 무료 유저로 취급
const MEMBERSHIP_FREE_OVERRIDE_KEY = "membership_free_override";

// ─── 개발자 PRO 오버라이드 ─────────────────────────────────────────────────
export const DEV_BANNER_OVERRIDE_KEY = "dev_banner_removed";
export const DEV_AIPRO_OVERRIDE_KEY = "dev_ai_pro";

function shouldSkipPurchasesInDev() {
  return __DEV__ || Platform.OS === "web";
}

// RC 초기화 Promise — getCurrentOffering에서 race condition 방지용
let _rcInitPromise: Promise<void> | null = null;

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
async function _doInitPurchases(userId?: string): Promise<void> {
  try {
    if (shouldSkipPurchasesInDev() || !Purchases) {
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    const apiKey = Platform.select({
      android: RC_ANDROID_KEY,
      ios: RC_IOS_KEY || RC_ANDROID_KEY,
    });

    if (!apiKey) {
      console.warn(
        "[RevenueCat] 지원되지 않는 플랫폼이어서 결제 초기화를 건너뜁니다."
      );
      return;
    }

    await Purchases.configure({ apiKey });

    if (userId) {
      await Purchases.logIn(userId).catch(() => {});
    }
  } catch (e) {
    console.warn("[RevenueCat] initPurchases 실패 (dev client 빌드 필요):", e);
  }
}

export function initPurchases(userId?: string): Promise<void> {
  if (!_rcInitPromise) {
    _rcInitPromise = _doInitPurchases(userId);
  }
  return _rcInitPromise;
}

/**
 * 멤버십 상태를 확인
 */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  try {
    // 앱 소유자 이메일이면 무조건 PRO (프로덕션 빌드에서만)
    if (!__DEV__) {
      const ownerEmail = await AsyncStorage.getItem("google_user_email");
      if (ownerEmail === OWNER_EMAIL) {
        return { bannerRemoved: true, aiPro: true };
      }
    }

    // 개발자 도구로 강제 무료 전환된 경우 → RevenueCat 무시하고 즉시 free 반환
    const override = await AsyncStorage.getItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    if (override === "1") {
      return { bannerRemoved: false, aiPro: false };
    }

    // 개발자 PRO 오버라이드 확인
    const [devBanner, devAiPro] = await Promise.all([
      AsyncStorage.getItem(DEV_BANNER_OVERRIDE_KEY),
      AsyncStorage.getItem(DEV_AIPRO_OVERRIDE_KEY),
    ]);
    if (devBanner === "1" || devAiPro === "1") {
      return {
        bannerRemoved: devBanner === "1" || devAiPro === "1",
        aiPro: devAiPro === "1",
      };
    }

    if (shouldSkipPurchasesInDev()) {
      return { bannerRemoved: false, aiPro: false };
    }

    const info = await Purchases.getCustomerInfo();
    const active = info?.entitlements?.active ?? {};

    const aiPro =
      active[ENTITLEMENT_AI_PRO] !== undefined ||
      // entitlement 연결 전 활성 구독이 있으면 ai_pro로 간주
      (info?.activeSubscriptions?.length ?? 0) > 0;

    const bannerRemoved =
      aiPro || active[ENTITLEMENT_BANNER_REMOVAL] !== undefined;

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
    if (shouldSkipPurchasesInDev()) {
      return null;
    }
    // RC 초기화가 끝날 때까지 대기 (race condition 방지)
    if (_rcInitPromise) await _rcInitPromise.catch(() => {});
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
  if (shouldSkipPurchasesInDev()) {
    return {
      success: false,
      error:
        "개발 빌드에서는 결제가 비활성화됩니다. preview/prod 빌드에서 테스트하세요.",
    };
  }

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
  if (shouldSkipPurchasesInDev()) {
    return getMembershipStatus();
  }

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
 * [개발자 전용] 배너 광고 제거 구매한 것처럼 처리
 */
export async function devGrantBannerRemoval(): Promise<void> {
  await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
  await AsyncStorage.setItem(DEV_BANNER_OVERRIDE_KEY, "1");
}

/**
 * [개발자 전용] AI Pro 연간 구독한 것처럼 처리
 */
export async function devGrantAiPro(): Promise<void> {
  await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
  await AsyncStorage.setItem(DEV_AIPRO_OVERRIDE_KEY, "1");
}

/**
 * 현재 유저를 로그아웃 (데이터 삭제 시)
 * 익명 유저로 전환됨
 */
export async function logoutPurchases(): Promise<void> {
  if (shouldSkipPurchasesInDev()) {
    await AsyncStorage.setItem(MEMBERSHIP_FREE_OVERRIDE_KEY, "1");
    await AsyncStorage.removeItem(DEV_BANNER_OVERRIDE_KEY);
    await AsyncStorage.removeItem(DEV_AIPRO_OVERRIDE_KEY);
    return;
  }

  try {
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) {
      await Purchases.logOut();
    }
  } catch {}
  // RevenueCat 캐시와 무관하게 즉시 무료 상태로 전환
  // (익명 유저이거나 logOut이 실패해도 강제로 free 처리)
  await AsyncStorage.setItem(MEMBERSHIP_FREE_OVERRIDE_KEY, "1");
  // 개발자 override도 함께 초기화
  await AsyncStorage.removeItem(DEV_BANNER_OVERRIDE_KEY);
  await AsyncStorage.removeItem(DEV_AIPRO_OVERRIDE_KEY);
}
