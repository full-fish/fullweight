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
          title: "기록",
          tabBarIcon: () => <EmojiIcon emoji="📝" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "그래프",
          tabBarIcon: () => <EmojiIcon emoji="📊" />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "캘린더",
          tabBarIcon: () => <EmojiIcon emoji="📅" />,
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: "챌린지",
          tabBarIcon: () => <EmojiIcon emoji="🏆" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          tabBarIcon: () => <EmojiIcon emoji="⚙️" />,
        }}
      />
    </Tabs>
  );
}
