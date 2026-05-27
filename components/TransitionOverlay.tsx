import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { themeDark } from '@/constants/tokens';
import { useTransitionStore } from '@/store/transition';

const T = themeDark;
const MIN_DURATION_MS = 800;
const MAX_DURATION_MS = 3500; // hard cap so the overlay can never get stuck

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
  });

  const finished = useRef(false);

  useEffect(() => {
    finished.current = false;
    // Start playback explicitly after mount — calling play() inside the
    // setup callback is unreliable on web because the source isn't loaded yet.
    try {
      player.play();
    } catch {}

    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
      setTimeout(onDone, remaining);
    };

    const sub = player.addListener('playToEnd', finish);
    // Safety net: if playToEnd never fires (autoplay blocked, codec hiccup,
    // etc.), still hide the overlay after MAX_DURATION_MS.
    const maxTimer = setTimeout(finish, MAX_DURATION_MS);

    return () => {
      sub.remove();
      clearTimeout(maxTimer);
    };
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
