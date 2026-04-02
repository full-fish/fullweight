import { ConfigContext, ExpoConfig } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "fullweight (Dev)" : "fullweight",
  slug: "fullweight",
  owner: "choimanseon",
  version: "1.0.5",
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
    versionCode: 6,
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
        androidAppId: "ca-app-pub-1379550026930118~3984155926",
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
    router: {},
    eas: {
      projectId: "7a2e9312-4cca-48e8-a317-ff4f60f651a4",
    },
  },
});
