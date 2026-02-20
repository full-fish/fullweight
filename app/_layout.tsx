import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import LockScreen from "@/components/lock-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { loadUserSettings } from "@/utils/storage";
import React, { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [locked, setLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  const checkLock = useCallback(async () => {
    const settings = await loadUserSettings();
    if (settings.lockEnabled && settings.lockPin) {
      setLocked(true);
    }
    setLockChecked(true);
  }, []);

  useEffect(() => {
    checkLock();
  }, [checkLock]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkLock();
      }
    });
    return () => sub.remove();
  }, [checkLock]);

  if (!lockChecked) return null;

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
