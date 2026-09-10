/** Google Mobile Ads SDK 초기화 (네이티브 전용, v16+ 필수) */
export async function initMobileAds(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: mobileAds } = require("react-native-google-mobile-ads");
    if (typeof mobileAds === "function") {
      await mobileAds().initialize();
    }
  } catch (error) {
    console.log("[MobileAds] initialize failed:", error);
  }
}
