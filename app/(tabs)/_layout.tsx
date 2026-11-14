import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContextBar } from "@/components/app-shell";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { COLORS } from "@/lib/ui";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomPadding;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ContextBar />
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.rose,
        tabBarInactiveTintColor: COLORS.textFaint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: COLORS.panel,
          borderTopColor: COLORS.borderStrong,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarActiveTintColor: COLORS.primarySoft,
          title: "Overview",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="heart.text.square.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="crew"
        options={{
          tabBarActiveTintColor: COLORS.teal,
          title: "Crew",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          tabBarActiveTintColor: COLORS.coral,
          title: "Review",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="waveform.path.ecg" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mission"
        options={{
          tabBarActiveTintColor: COLORS.sky,
          title: "Mission",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarActiveTintColor: COLORS.amber,
          title: "More",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="ellipsis.circle.fill" color={color} />,
        }}
      />
      </Tabs>
    </View>
  );
}
