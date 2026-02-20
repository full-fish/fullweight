import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

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
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="square.and.pencil" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "그래프",
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={26}
              name="chart.line.uptrend.xyaxis"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
