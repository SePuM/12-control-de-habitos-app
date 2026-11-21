import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Hoy" }} />
      <Tabs.Screen name="semana" options={{ title: "Semana" }} />
    </Tabs>
  );
}
