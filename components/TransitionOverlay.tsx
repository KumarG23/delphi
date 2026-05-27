import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { themeDark } from '@/constants/tokens';
import { useTransitionStore } from '@/store/transition';

const T = themeDark;
const MIN_DURATION_MS = 800;

export function TransitionOverlay() {
  const { isShowing, source, startedAt, hide } = useTransitionStore();

  if (!isShowing || !source) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <LoaderVideo source={source} startedAt={startedAt} onDone={hide} />
    </View>
  );
}

function LoaderVideo({
  source,
  startedAt,
  onDone,
}: {
  source: number;
  startedAt: number;
  onDone: () => void;
}) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const finish = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
      setTimeout(onDone, remaining);
    };
    const sub = player.addListener('playToEnd', finish);
    return () => sub.remove();
  }, [player, startedAt, onDone]);

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.bg,
    zIndex: 9999,
  },
});
