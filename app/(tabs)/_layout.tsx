import { Tabs } from "expo-router";
import React from "react";
import { Text } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";

function EmojiIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4CAF50",
        tabBarInactiveTintColor: isDark ? "#718096" : "#A0AEC0",
        tabBarStyle: {
          backgroundColor: isDark ? "#1A202C" : "#fff",
          borderTopColor: isDark ? "#2D3748" : "#E2E8F0",
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "\uae30\ub85d",
          tabBarIcon: () => <EmojiIcon emoji={"\u{1F4DD}"} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "\uADF8\uB798\uD504",
          tabBarIcon: () => <EmojiIcon emoji={"\u{1F4CA}"} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "\uCE98\uB9B0\uB354",
          tabBarIcon: () => <EmojiIcon emoji={"\u{1F4C5}"} />,
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: "\uCC4C\uB9B0\uC9C0",
          tabBarIcon: () => <EmojiIcon emoji={"\u{1F3C6}"} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "\uC124\uC815",
          tabBarIcon: () => <EmojiIcon emoji={"\u2699\uFE0F"} />,
        }}
      />
    </Tabs>
  );
}
