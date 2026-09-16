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
import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

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

function getAppPackageName(): string {
  const pkg = Platform.select({
    android: Constants.expoConfig?.android?.package,
    ios: Constants.expoConfig?.ios?.bundleIdentifier,
    default: undefined,
  });
  return pkg ?? "unknown";
}

function shouldSkipPurchasesInDev() {
  return __DEV__;
}

function statusFromCustomerInfo(info: any): MembershipStatus {
  const active = info?.entitlements?.active ?? {};
  const aiEntitlement = active[ENTITLEMENT_AI_PRO];

  // entitlement 연결이 안 되어 있어도 활성 구독이 있으면 ai_pro로 간주
  const hasActiveSubscription = (info?.activeSubscriptions?.length ?? 0) > 0;
  const aiPro = aiEntitlement !== undefined || hasActiveSubscription;

  const rawExpiry =
    aiEntitlement?.expirationDate ?? info?.latestExpirationDate ?? null;
  const aiProExpiresAt = typeof rawExpiry === "string" ? rawExpiry : null;

  const hasBannerByEntitlement =
    active[ENTITLEMENT_BANNER_REMOVAL] !== undefined;

  return {
    aiPro,
    bannerRemoved: aiPro || hasBannerByEntitlement,
    aiProExpiresAt,
  };
}

// RC 초기화 Promise — getCurrentOffering/getMembershipStatus에서 race condition 방지용
let _rcInitPromise: Promise<void> | null = null;

// 구매 직후 짧은 기간은 캐시 무효화를 건너뛰기 위한 타임스탬프
let _lastPurchaseAt = 0;
const PURCHASE_GRACE_MS = 5000;

/** 유저의 현재 구매 상태 */
export type MembershipStatus = {
  /** 배너 광고 제거 여부 (lifetime 또는 AI 구독 포함) */
  bannerRemoved: boolean;
  /** AI PRO 구독 여부 (무제한 AI + gpt-4o + 모든 광고 제거) */
  aiPro: boolean;
  /** AI PRO 만료 시각(ISO). 미확인/비구독은 null */
  aiProExpiresAt: string | null;
};

/**
 * 앱 시작 시 RevenueCat 초기화 (앱 전역에서 1회만 호출)
 * ⚠️ 네이티브 모듈 필요 — Expo Go에서는 작동하지 않음 (dev client 빌드 필요)
 */
async function _doInitPurchases(userId?: string): Promise<void> {
  try {
    if (shouldSkipPurchasesInDev()) {
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
    // 개발자 오버라이드는 개발 빌드에서만 적용
    if (__DEV__) {
      const override = await AsyncStorage.getItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
      if (override === "1") {
        return { bannerRemoved: false, aiPro: false, aiProExpiresAt: null };
      }

      const [devBanner, devAiPro] = await Promise.all([
        AsyncStorage.getItem(DEV_BANNER_OVERRIDE_KEY),
        AsyncStorage.getItem(DEV_AIPRO_OVERRIDE_KEY),
      ]);
      if (devBanner === "1" || devAiPro === "1") {
        return {
          bannerRemoved: devBanner === "1" || devAiPro === "1",
          aiPro: devAiPro === "1",
          aiProExpiresAt: null,
        };
      }
    }

    if (shouldSkipPurchasesInDev()) {
      return { bannerRemoved: false, aiPro: false, aiProExpiresAt: null };
    }

    // SDK configure()가 끝나기 전에 getCustomerInfo가 호출되는 레이스 방지
    // (ProProvider의 초기 refresh가 RootLayout의 initPurchases보다 먼저 실행될 수 있음)
    await initPurchases().catch(() => {});

    // 결제 완료 직후 잠깐은 무효화를 건너뜀 — RevenueCat 서버 반영 전 강제 조회 시
    // 빈 응답이 정상 응답으로 취급되어 방금 받은 영수증이 증발하는 것을 방지
    if (Date.now() - _lastPurchaseAt < PURCHASE_GRACE_MS) {
      const info = await Purchases.getCustomerInfo();
      return statusFromCustomerInfo(info);
    }

    // syncPurchases()는 로컬 영수증을 서버로 push하는 API라 환불 감지에 무의미함.
    // 환불처럼 서버 쪽에서 바뀐 상태를 pull하려면 캐시 무효화 후 재조회해야 함.
    // 무효화 전에 캐시값을 먼저 읽어둬야 함 — 무효화 후엔 캐시가 비어 있어 폴백이 무의미해짐.
    const cachedInfo = await Purchases.getCustomerInfo();
    const fallbackStatus = statusFromCustomerInfo(cachedInfo);

    try {
      await Purchases.invalidateCustomerInfoCache();
      const freshInfo = await Purchases.getCustomerInfo();
      return statusFromCustomerInfo(freshInfo);
    } catch {
      // 캐시 무효화 후 네트워크 실패 시(결제 직후 흔함) 무효화 전 캐시값으로 폴백
      return fallbackStatus;
    }
  } catch {
    return { bannerRemoved: false, aiPro: false, aiProExpiresAt: null };
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
  if (shouldSkipPurchasesInDev()) {
    return null;
  }

  // RC 초기화가 끝날 때까지 대기 (race condition 방지) — 아직 시작 전이면 시작시킴
  await initPurchases().catch(() => {});

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current || (current.availablePackages?.length ?? 0) === 0) {
      const pkg = getAppPackageName();
      throw new Error(
        [
          "스토어 상품을 불러오지 못했습니다.",
          "RevenueCat Offering/Package 또는 Play Console 상품 연결을 확인해 주세요.",
          `패키지명: ${pkg}`,
          "가이드: https://rev.cat/why-are-offerings-empty",
        ].join("\n")
      );
    }

    return current;
  } catch (e: any) {
    const pkg = getAppPackageName();
    const detail = e?.message ? String(e.message) : "unknown";
    throw new Error(
      [
        "스토어 연결에 실패했습니다.",
        `패키지명: ${pkg}`,
        `원인: ${detail}`,
        "가이드: https://rev.cat/why-are-offerings-empty",
      ].join("\n")
    );
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
    _lastPurchaseAt = Date.now();
    try {
      await Purchases.syncPurchases();
    } catch {}
    // 개발자 강제 무료 오버라이드 사용 중이었다면 해제
    if (__DEV__) {
      await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    }
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
    // 복원 전 개발자 오버라이드 해제 → RevenueCat 실제 데이터 읽기
    if (__DEV__) {
      await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    }
    await Purchases.restorePurchases();
    return getMembershipStatus();
  } catch {
    return { bannerRemoved: false, aiPro: false, aiProExpiresAt: null };
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
  // 운영 빌드에서는 로컬 데이터 초기화가 실제 구매 권한을 덮어쓰지 않도록 함
  if (!__DEV__) {
    await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
    await AsyncStorage.removeItem(DEV_BANNER_OVERRIDE_KEY);
    await AsyncStorage.removeItem(DEV_AIPRO_OVERRIDE_KEY);
    return;
  }

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
