import { loadUserSettings } from "@/utils/storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { ReactNode, useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

const ROUTES: string[] = [
  "/",
  "/explore",
  "/calendar",
  "/challenge",
  "/photos",
  "/settings",
];

export function SwipeableTab({
  currentIndex,
  children,
  enabled,
}: {
  currentIndex: number;
  children: ReactNode;
  enabled?: boolean;
}) {
  const router = useRouter();
  const [swipeEnabled, setSwipeEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUserSettings().then((s) => setSwipeEnabled(s.swipeEnabled ?? false));
    }, [])
  );

  const isEnabled = enabled !== undefined ? enabled : swipeEnabled;

  const navigateLeft = () => {
    if (currentIndex > 0) {
      router.navigate(ROUTES[currentIndex - 1] as any);
    }
  };

  const navigateRight = () => {
    if (currentIndex < ROUTES.length - 1) {
      router.navigate(ROUTES[currentIndex + 1] as any);
    }
  };

  const flingLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      runOnJS(navigateRight)();
    });

  const flingRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      runOnJS(navigateLeft)();
    });

  const gesture = Gesture.Simultaneous(flingLeft, flingRight);

  if (!isEnabled) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
