/**
 * RevenueCat 인앱 결제 유틸리티 (웹 전용 스텁)
 * 웹에는 결제 SDK가 없으므로 모든 구매 관련 동작을 비활성화
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

type PurchasesOffering = any;
type PurchasesPackage = any;

export const ENTITLEMENT_BANNER_REMOVAL = "banner_removal";
export const ENTITLEMENT_AI_PRO = "ai_pro";

const MEMBERSHIP_FREE_OVERRIDE_KEY = "membership_free_override";

export const DEV_BANNER_OVERRIDE_KEY = "dev_banner_removed";
export const DEV_AIPRO_OVERRIDE_KEY = "dev_ai_pro";

export type MembershipStatus = {
  bannerRemoved: boolean;
  aiPro: boolean;
};

export function initPurchases(): Promise<void> {
  return Promise.resolve();
}

export async function getMembershipStatus(): Promise<MembershipStatus> {
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
  return { bannerRemoved: false, aiPro: false };
}

export async function hasAnyPurchase(): Promise<boolean> {
  const s = await getMembershipStatus();
  return s.bannerRemoved || s.aiPro;
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  return null;
}

export async function purchasePackage(
  _pkg: PurchasesPackage
): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: "웹에서는 결제가 지원되지 않습니다. 앱에서 구매해 주세요.",
  };
}

export async function restorePurchases(): Promise<MembershipStatus> {
  return getMembershipStatus();
}

export async function devGrantBannerRemoval(): Promise<void> {
  await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
  await AsyncStorage.setItem(DEV_BANNER_OVERRIDE_KEY, "1");
}

export async function devGrantAiPro(): Promise<void> {
  await AsyncStorage.removeItem(MEMBERSHIP_FREE_OVERRIDE_KEY);
  await AsyncStorage.setItem(DEV_AIPRO_OVERRIDE_KEY, "1");
}

export async function logoutPurchases(): Promise<void> {
  await AsyncStorage.setItem(MEMBERSHIP_FREE_OVERRIDE_KEY, "1");
  await AsyncStorage.removeItem(DEV_BANNER_OVERRIDE_KEY);
  await AsyncStorage.removeItem(DEV_AIPRO_OVERRIDE_KEY);
}
