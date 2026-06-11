import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import DelphiAvatar from '@/components/DelphiAvatar';
import { useAskDelphiStore } from '@/store/askDelphi';
import {
  components,
  fontSize,
  fontWeight,
  palette,
  radius,
  space,
  themeDark,
  z,
} from '@/constants/tokens';

const T = themeDark;

const TIPS = [
  "How am I doing? Ask me! 🐾",
  "Got a money question? 😸",
  "Let's check your goals! 💰",
  "Paw-se for a money check-in? 🐱",
  "Curious about your spending? 😼",
];

export default function DelphiFab() {
  const { open, setOpen } = useAskDelphiStore();
  const [tipIndex, setTipIndex] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const timers = useRef<{ show?: any; hide?: any }>({});

  if (open) {
    // Hide FAB (and bubble) while sheet is open
    return null;
  }

  const showBubble = () => {
    setBubbleVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const hideBubble = (cb?: () => void) => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setBubbleVisible(false);
      cb?.();
    });
  };

  useEffect(() => {
    const tips = TIPS;

    const scheduleNext = (idx: number) => {
      // Show current tip
      setTipIndex(idx);
      showBubble();

      // After ~6s, hide
      timers.current.show = setTimeout(() => {
        hideBubble(() => {
          // After hide, wait ~50s then show next
          timers.current.hide = setTimeout(() => {
            scheduleNext((idx + 1) % tips.length);
          }, 50000);
        });
      }, 6000);
    };

    // Kick off the rotation
    scheduleNext(0);

    return () => {
      if (timers.current.show) clearTimeout(timers.current.show);
      if (timers.current.hide) clearTimeout(timers.current.hide);
    };
  }, []);

  const handlePress = () => {
    setOpen(true);
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Tip bubble to the LEFT of the FAB */}
      {bubbleVisible && (
        <Animated.View style={[styles.bubble, { opacity }]}>
          <Pressable onPress={handlePress} hitSlop={8}>
            <Text style={styles.bubbleText} numberOfLines={1}>
              {TIPS[tipIndex]}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Floating cat-face button */}
      <View style={styles.fab}>
        <Pressable
          onPress={handlePress}
          style={styles.fabPressable}
          hitSlop={8}
        >
          <View style={styles.fabRing}>
            <View style={styles.fabCircle}>
              <DelphiAvatar size={40} />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 88, // above tab bar + safe area approx
    right: space['4'],
    zIndex: z.fab,
    flexDirection: 'row',
    alignItems: 'center',
    // bubble will be absolutely positioned to the left
  },
  bubble: {
    position: 'absolute',
    right: components.fabSize + space['2'],
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.pill,
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleText: {
    fontSize: fontSize.xs,
    color: T.textMuted,
    fontWeight: fontWeight.medium,
  },
  fab: {
    width: components.fabSize,
    height: components.fabSize,
    borderRadius: components.fabSize / 2,
    // the ring provides the gold accent
  },
  fabPressable: {
    width: '100%',
    height: '100%',
  },
  fabRing: {
    width: '100%',
    height: '100%',
    borderRadius: components.fabSize / 2,
    borderWidth: 2,
    borderColor: palette.gold,
    padding: 2, // creates the ring effect
    backgroundColor: 'transparent',
  },
  fabCircle: {
    flex: 1,
    borderRadius: (components.fabSize - 4) / 2,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
