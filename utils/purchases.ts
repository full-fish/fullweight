/**
 * RevenueCat 인앱 결제 유틸리티
 *
 * RevenueCat 대시보드에서 받은 SDK 키를 아래에 입력하세요.
 * Entitlement identifier는 RevenueCat > Entitlements에서 만든 이름과 일치해야 합니다.
 */
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from "react-native-purchases";

// ─── RevenueCat SDK 키 ───────────────────────────────────────────────────────
const RC_ANDROID_KEY = "test_RGiASMcFasLVSKMYQWCddcZuWmP"; // 현재 받은 키 (Android/공용)
const RC_IOS_KEY = ""; // iOS 앱 추가 후 여기 입력 (appl_xxxx...)

// ─── Entitlement 식별자 (RevenueCat 대시보드의 Entitlements > identifier) ────
export const ENTITLEMENT_PRO = "pro";

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
 * 현재 유저가 PRO 구독 중인지 확인
 */
export async function isPro(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    // 1) entitlement "pro"가 활성화되어 있으면 PRO
    if (info.entitlements.active[ENTITLEMENT_PRO] !== undefined) {
      return true;
    }
    // 2) entitlement 연결 전이라도 활성 구매가 있으면 PRO로 처리
    if (Object.keys(info.entitlements.active).length > 0) {
      return true;
    }
    // 3) 활성 구독이 있으면 PRO
    if (info.activeSubscriptions.length > 0) {
      return true;
    }
    // 4) 비소모성 구매(평생이용권 등)가 있으면 PRO
    if (info.nonSubscriptionTransactions.length > 0) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
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
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const success =
      customerInfo.entitlements.active[ENTITLEMENT_PRO] !== undefined;
    return { success };
  } catch (e: any) {
    if (e.userCancelled) return { success: false };
    return { success: false, error: e.message || "구매에 실패했습니다." };
  }
}

/**
 * 구매 내역 복원 (기기 변경, 재설치 시)
 * @returns 복원 후 PRO 여부
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_PRO] !== undefined;
  } catch {
    return false;
  }
}
