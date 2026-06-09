import FontAwesome from '@expo/vector-icons/FontAwesome';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { TransitionOverlay } from '@/components/TransitionOverlay';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useTransitionStore } from '@/store/transition';
import { setupNotificationHandler } from '@/lib/notifications';

const queryClient = new QueryClient();
setupNotificationHandler();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const { session, initialized, setSession, setInitialized } = useAuthStore();
  const segments = useSegments();
  const router   = useRouter();
  const pathname = usePathname();
  const showTransition = useTransitionStore((s) => s.show);
  const prevPathname = useRef<string | null>(null);

  // Fire the rotating loader whenever the route actually changes.
  // Skip the very first render so cold start doesn't show one.
  useEffect(() => {
    if (prevPathname.current === null) {
      prevPathname.current = pathname;
      return;
    }
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    showTransition();
  }, [pathname, showTransition]);

  // Subscribe to auth state once on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          // Self-heal a corrupted session — clear it and force sign-in.
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
        } else {
          setSession(session);
        }
      } catch {
        if (!mounted) return;
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
      } finally {
        if (mounted) setInitialized(true);
      }
    })();

    // Keep session in sync as the user signs in/out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Redirect whenever session or route changes
  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not signed in → go to sign-in
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      // Just signed in → go to main app
      router.replace('/(tabs)');
    }
  }, [session, initialized, segments]);

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="modal"  options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/[id]" options={{ headerShown: false }} />
      </Stack>
      <TransitionOverlay />
    </>
  );
}
