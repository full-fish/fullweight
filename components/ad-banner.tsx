import { usePro } from "@/hooks/use-pro";
import Constants from "expo-constants";
import React, { useState } from "react";
import { Platform, View } from "react-native";

const getNativeRequire = () => Function("return require")();

const getAdModule = () => {
  if (Platform.OS === "web") return null;

  try {
    const nativeRequire = getNativeRequire();
    const mod = nativeRequire("react-native-google-mobile-ads");
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
};

// 네이티브 모듈이 없는 구버전 dev client에서 크래시 방지
const adModule = getAdModule();
const BannerAd = adModule?.BannerAd ?? null;
const BannerAdSize = adModule?.BannerAdSize ?? null;
const TestIds = adModule?.TestIds ?? null;

const getBannerUnitId = () => {
  if (!TestIds) return null;
  const appVariant = (
    Constants.expoConfig?.extra as { appVariant?: string } | undefined
  )?.appVariant;
  if (__DEV__ || appVariant === "preview") return TestIds.ADAPTIVE_BANNER;
  return (
    Platform.select({
      android: "ca-app-pub-1379550026930118/3080770819",
      ios: "ca-app-pub-1379550026930118/3080770819",
      default: TestIds.ADAPTIVE_BANNER,
    }) ?? null
  );
};

export function AdBanner() {
  const { bannerRemoved } = usePro();
  const [adKey, setAdKey] = useState(0);
  const retryCount = React.useRef(0);

  if (Platform.OS === "web") return null;
  if (bannerRemoved) return null;

  const unitId = getBannerUnitId();

  if (!BannerAd || !unitId) {
    return (
      <View
        style={{
          height: 0,
          backgroundColor: "transparent",
        }}
      />
    );
  }

  return (
    <View style={{ alignItems: "center", backgroundColor: "#F0F4F8" }}>
      <BannerAd
        key={adKey}
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={(error: any) => {
          console.log("[AdBanner] 광고 로드 실패 (재시도):", error?.message);
          if (retryCount.current < 3) {
            retryCount.current += 1;
            setTimeout(() => setAdKey((k) => k + 1), 3000);
          }
        }}
      />
    </View>
  );
}
