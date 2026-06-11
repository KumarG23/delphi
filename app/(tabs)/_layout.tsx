import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { themeDark } from '@/constants/tokens';

import { AskDelphiSheet } from '@/components/AskDelphiSheet';
import DelphiFab from '@/components/DelphiFab';
import { useAskDelphiStore } from '@/store/askDelphi';

const T = themeDark;

export default function TabLayout() {
  const { open, setOpen } = useAskDelphiStore();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: T.card,
            borderTopColor: T.border,
          },
          tabBarActiveTintColor: T.primary,
          tabBarInactiveTintColor: T.textMuted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="accounts"
          options={{
            title: 'Accounts',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="two"
          options={{
            title: 'Spending',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pie-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="goals"
          options={{
            title: 'Goals',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flag-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <DelphiFab />
      <AskDelphiSheet
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
