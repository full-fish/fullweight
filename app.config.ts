import { ConfigContext, ExpoConfig } from "expo/config";

const APP_VARIANT = process.env.APP_VARIANT ?? "production";
const IS_DEV = APP_VARIANT === "development";
const IS_PREVIEW = APP_VARIANT === "preview";
const ANDROID_ADMOB_APP_ID = IS_PREVIEW
  ? "ca-app-pub-3940256099942544~3347511713"
  : "ca-app-pub-1379550026930118~3984155926";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "fullweight (Dev)" : "fullweight",
  slug: "fullweight",
  owner: "choimanseon",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: IS_DEV ? "fullweight-dev" : "fullweight",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: IS_DEV
      ? "com.choimanseon.fullweight.dev"
      : "com.choimanseon.fullweight",
  },
  android: {
    package: IS_DEV
      ? "com.choimanseon.fullweight.dev"
      : "com.choimanseon.fullweight",
    versionCode: 7,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: ANDROID_ADMOB_APP_ID,
        iosAppId: "ca-app-pub-3940256099942544~1458002511",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-web-browser",
    "@react-native-google-signin/google-signin",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appVariant: APP_VARIANT,
    router: {},
    eas: {
      projectId: "7a2e9312-4cca-48e8-a317-ff4f60f651a4",
    },
  },
});
