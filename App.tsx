import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CallsProvider } from './src/calls';
import { Intro } from './src/Intro';
import { FamilyProvider } from './src/family/family';
import { DatesScreen } from './src/screens/DatesScreen';
import { FamilyScreen } from './src/screens/FamilyScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { StoreProvider, useStore } from './src/store';
import { useTheme } from './src/theme';
import { Icon, IconName } from './src/ui';

/** Replay the intro only after being away this long (1 hour). */
const INTRO_AFTER_AWAY_MS = 60 * 60 * 1000;

type Tab = 'home' | 'family' | 'history' | 'dates';
const TABS: { key: Tab; label: string; icon: IconName; iconActive: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'family', label: 'Family', icon: 'people-outline', iconActive: 'people' },
  { key: 'history', label: 'History', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'dates', label: 'Dates', icon: 'gift-outline', iconActive: 'gift' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <FamilyProvider>
          <CallsProvider>
            <Root />
          </CallsProvider>
        </FamilyProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const t = useTheme();
  const { loaded } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [now, setNow] = useState(new Date());
  // >0 = the opening animation is showing. Starts at 1 so it plays every time the app opens.
  const [intro, setIntro] = useState(1);
  const leftAt = useRef<number | null>(null);

  // Refresh day counts whenever the app comes back to the foreground,
  // and replay the intro if you've been away for a while (not after a quick call)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt.current = Date.now();
      if (s === 'active') {
        setNow(new Date());
        if (leftAt.current && Date.now() - leftAt.current > INTRO_AFTER_AWAY_MS) setIntro((n) => n + 1);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {loaded && <Main tab={tab} setTab={setTab} now={now} />}
      {intro > 0 && <Intro key={intro} ready={loaded} onDone={() => setIntro(0)} />}
    </View>
  );
}

function Main(props: { tab: Tab; setTab: (t: Tab) => void; now: Date }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { tab, setTab, now } = props;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {tab === 'home' && <HomeScreen now={now} onOpenDates={() => setTab('dates')} />}
        {tab === 'family' && <FamilyScreen now={now} />}
        {tab === 'history' && <HistoryScreen now={now} />}
        {tab === 'dates' && <DatesScreen now={now} />}
      </SafeAreaView>

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: t.line,
          backgroundColor: t.card,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        }}
      >
        {TABS.map((x) => {
          const active = x.key === tab;
          return (
            <Pressable
              key={x.key}
              onPress={() => setTab(x.key)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon name={active ? x.iconActive : x.icon} size={24} color={active ? t.accent : t.muted} />
              <Text style={{ fontSize: 12, marginTop: 2, fontWeight: '600', color: active ? t.accent : t.muted }}>
                {x.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
