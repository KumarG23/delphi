import { Stack } from 'expo-router';
import { themeDark } from '@/constants/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: themeDark.bg },
        animation: 'fade',
      }}
    />
  );
}
