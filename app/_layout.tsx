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
import { performBackup, shouldAutoBackup } from "@/utils/backup";
import { loadUserSettings } from "@/utils/storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, InteractionManager, View } from "react-native";

const LOCK_GRACE_MS = 30_000; // 30초 이내 복귀 시 잠금 안 걸림 (카메라/크롭 등)

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [locked, setLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const bgTime = useRef<number>(0);

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

  /* ── 앱 시작 시 자동 백업 (UI 렌더 완료 후, 백그라운드 실행) ── */
  const backupDone = useRef(false);
  useEffect(() => {
    if (backupDone.current) return;
    // InteractionManager: 애니메이션·렌더 완료 후 실행 → 렉 방지
    const handle = InteractionManager.runAfterInteractions(() => {
      (async () => {
        try {
          const need = await shouldAutoBackup();
          if (need) {
            backupDone.current = true;
            await performBackup();
          }
        } catch {
          // 백업 실패해도 앱 동작에 영향 없음
        }
      })();
    });
    return () => handle.cancel();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background" || state === "inactive") {
        bgTime.current = Date.now();
      } else if (state === "active") {
        const elapsed = Date.now() - bgTime.current;
        if (bgTime.current > 0 && elapsed < LOCK_GRACE_MS) {
          // 짧은 외부 활동 (카메라, 크롭 등) → 잠금 건너뜀
          return;
        }
        checkLock();
      }
    });
    return () => sub.remove();
  }, [checkLock]);

  if (!lockChecked) return null;

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
      {locked && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
        >
          <LockScreen onUnlock={() => setLocked(false)} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
