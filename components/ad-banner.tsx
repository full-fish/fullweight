import { usePro } from "@/hooks/use-pro";
import React, { useState } from "react";
import { Platform, View } from "react-native";

// 네이티브 모듈이 없는 구버전 dev client에서 크래시 방지
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;
try {
  const m = require("react-native-google-mobile-ads");
  BannerAd = m.BannerAd;
  BannerAdSize = m.BannerAdSize;
  TestIds = m.TestIds;
} catch {}

const getBannerUnitId = () => {
  if (!TestIds) return null;
  if (__DEV__) return TestIds.ADAPTIVE_BANNER;
  return (
    Platform.select({
      android: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
      ios: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
      default: TestIds.ADAPTIVE_BANNER,
    }) ?? null
  );
};

export function AdBanner() {
  const { bannerRemoved } = usePro();
  const [adKey, setAdKey] = useState(0);
  const retryCount = React.useRef(0);

  const unitId = getBannerUnitId();

  // 배너 제거 구매 또는 AI PRO 구독 시 숨김
  if (bannerRemoved || !BannerAd || !unitId) return null;

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
