/** Google Mobile Ads SDK 초기화 (네이티브 전용, v16+ 필수) */
export function initMobileAds(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: mobileAds } = require("react-native-google-mobile-ads");
    mobileAds().initialize();
  } catch {}
}
