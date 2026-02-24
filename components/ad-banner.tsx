import React from "react";
import { Platform, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

/**
 * 실제 광고 단위 ID — AdMob 콘솔에서 받은 값으로 교체하세요
 * Android: 광고 단위 ID (ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX)
 * iOS:     광고 단위 ID (ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX)
 */
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Platform.select({
      android: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
      ios: "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX",
      default: TestIds.ADAPTIVE_BANNER,
    })!;

export function AdBanner() {
  return (
    <View style={{ alignItems: "center", backgroundColor: "#F0F4F8" }}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
      />
    </View>
  );
}
