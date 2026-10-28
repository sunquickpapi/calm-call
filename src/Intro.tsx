import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogoLayer } from './logo';
import { useTheme } from './theme';

const SIZE = 148;

/**
 * Opening animation, played over the app:
 * the tile settles in, the phone gives a gentle ring, the moon rises, the water
 * drifts in, then the name appears and everything fades away.
 * Tap to skip. With Reduce Motion on, it simply fades.
 *
 * `ready` = the app's data has loaded; the intro never leaves before that.
 */
export function Intro(props: { ready: boolean; onDone: () => void }) {
  const t = useTheme();
  const tile = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const moon = useRef(new Animated.Value(0)).current;
  const waves = useRef(new Animated.Value(0)).current;
  const words = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(1)).current;
  const [played, setPlayed] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          [tile, ring, moon, waves, words].forEach((v) => v.setValue(1));
          setTimeout(() => setPlayed(true), 700);
          return;
        }
        const ease = Easing.out(Easing.cubic);
        Animated.sequence([
          Animated.spring(tile, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(ring, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(moon, { toValue: 1, duration: 650, easing: ease, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(150),
              Animated.timing(waves, { toValue: 1, duration: 600, easing: ease, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.delay(300),
              Animated.timing(words, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
            ]),
          ]),
          Animated.delay(450),
        ]).start(() => !cancelled && setPlayed(true));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(leave, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      () => props.onDone(),
    );
  };

  useEffect(() => {
    if (played && props.ready) finish();
  }, [played, props.ready]);

  const layer = StyleSheet.absoluteFill;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: t.bg,
          zIndex: 100,
          opacity: leave,
          transform: [{ scale: leave.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }],
        },
      ]}
      accessible
      accessibilityLabel="Calm Call"
    >
      <Pressable style={styles.center} onPress={() => props.ready && finish()}>
        <View style={{ width: SIZE, height: SIZE }}>
          {/* tile */}
          <Animated.View
            style={[
              layer,
              styles.shadow,
              {
                opacity: tile.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
                transform: [{ scale: tile.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
              },
            ]}
          >
            <LogoLayer layer="tile" size={SIZE} />
          </Animated.View>

          {/* moon rises */}
          <Animated.View
            style={[
              layer,
              {
                opacity: moon,
                transform: [{ translateY: moon.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            <LogoLayer layer="moon" size={SIZE} />
          </Animated.View>

          {/* water drifts in */}
          <Animated.View
            style={[
              layer,
              {
                opacity: waves,
                transform: [{ translateX: waves.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <LogoLayer layer="waves" size={SIZE} />
          </Animated.View>

          {/* phone gives a soft ring */}
          <Animated.View
            style={[
              layer,
              {
                opacity: tile.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] }),
                transform: [
                  {
                    rotate: ring.interpolate({
                      inputRange: [0, 0.15, 0.35, 0.55, 0.75, 1],
                      outputRange: ['0deg', '-10deg', '9deg', '-6deg', '3deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <LogoLayer layer="handset" size={SIZE} />
          </Animated.View>
        </View>

        <Animated.View
          style={{
            alignItems: 'center',
            marginTop: 26,
            opacity: words,
            transform: [{ translateY: words.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <Text style={{ fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.6 }}>Calm Call</Text>
          <Text style={{ fontSize: 15, color: t.muted, marginTop: 6 }}>Time to call home</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  shadow: {
    shadowColor: '#2A6B48',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
});
