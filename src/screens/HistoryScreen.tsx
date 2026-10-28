import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { bestWeeklyStreak, callsInMonth, monthGrid, weeklyStreak } from '../stats';
import { CallEntry, formatDay, personLabel, todayKey } from '../storage';
import { useStore } from '../store';
import { useFamily } from '../family/family';
import { useTheme } from '../theme';
import { Avatar, Card, Icon, SectionTitle, base } from '../ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function HistoryScreen(props: { now: Date }) {
  const { data, update } = useStore();
  const family = useFamily();
  const t = useTheme();
  const [month, setMonth] = useState({ y: props.now.getFullYear(), m: props.now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);

  const streak = weeklyStreak(data.calls, props.now);
  const best = bestWeeklyStreak(data.calls);
  const inMonth = callsInMonth(data.calls, month.y, month.m);
  const byDay = new Map<string, CallEntry[]>();
  for (const c of inMonth) byDay.set(c.date, [...(byDay.get(c.date) ?? []), c]);
  const today = todayKey(props.now);
  const isCurrentMonth = month.y === props.now.getFullYear() && month.m === props.now.getMonth();

  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(null);
  };

  const nameOf = (id: string | null) => {
    const p = data.people.find((x) => x.id === id);
    return p ? personLabel(p) : 'Someone';
  };

  const remove = (c: CallEntry) =>
    Alert.alert('Delete this call?', `${nameOf(c.personId)} · ${formatDay(c.date)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        update((d) => ({ ...d, calls: d.calls.filter((x) => x.id !== c.id) }));
        family.removeCall(c.personId, c.date);
      } },
    ]);

  const list = (selected ? byDay.get(selected) ?? [] : [...data.calls])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, selected ? 20 : 15);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5, marginBottom: 18 }}>
        History
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 34, fontWeight: '800', color: streak > 0 ? t.warn : t.muted }}>🔥 {streak}</Text>
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            week streak{'\n'}(best: {best})
          </Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 34, fontWeight: '800', color: t.accent }}>{inMonth.length}</Text>
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            calls in{'\n'}
            {new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: 'long' })}
          </Text>
        </Card>
      </View>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>
        Your streak grows each week you call anyone at least once.
      </Text>

      <Card style={{ marginTop: 16 }}>
        <View style={[base.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Pressable onPress={() => shift(-1)} hitSlop={12} accessibilityLabel="Previous month">
            <Icon name="chevron-back" size={22} color={t.accent} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '700', color: t.text }}>
            {new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable
            onPress={() => !isCurrentMonth && shift(1)}
            hitSlop={12}
            accessibilityLabel="Next month"
            style={{ opacity: isCurrentMonth ? 0.25 : 1 }}
          >
            <Icon name="chevron-forward" size={22} color={t.accent} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.muted, fontSize: 12, fontWeight: '600' }}>
              {w}
            </Text>
          ))}
        </View>
        {monthGrid(month.y, month.m).map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', marginTop: 6 }}>
            {row.map((key, ci) => {
              if (!key) return <View key={ci} style={{ flex: 1 }} />;
              const n = byDay.get(key)?.length ?? 0;
              const isSel = selected === key;
              return (
                <Pressable
                  key={ci}
                  onPress={() => setSelected(isSel ? null : key)}
                  style={{ flex: 1, alignItems: 'center' }}
                  accessibilityLabel={`${formatDay(key)}, ${n} calls`}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: n > 0 ? t.accent : 'transparent',
                      borderWidth: isSel || key === today ? 2 : 0,
                      borderColor: isSel ? t.warn : t.muted,
                      opacity: key > today ? 0.35 : 1,
                    }}
                  >
                    <Text style={{ color: n > 0 ? t.onAccent : t.text, fontWeight: n > 0 ? '800' : '400' }}>
                      {Number(key.slice(8))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      {data.people.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {data.people.map((p) => (
            <View key={p.id} style={{ backgroundColor: t.chip, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: t.text, fontSize: 13 }}>
                {personLabel(p)}: {inMonth.filter((c) => c.personId === p.id).length}
              </Text>
            </View>
          ))}
        </View>
      )}

      <SectionTitle>{selected ? formatDay(selected) : 'Recent calls'}</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {list.length === 0 ? (
          <Text style={{ color: t.muted, paddingVertical: 12 }}>
            {selected ? 'No calls this day.' : 'Your calls will show up here.'}
          </Text>
        ) : (
          list.map((c, i) => (
            <Pressable
              key={c.id}
              onLongPress={() => remove(c)}
              style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}
            >
              <View style={[base.row, { justifyContent: 'space-between' }]}>
                <View style={[base.row, { gap: 10 }]}>
                  {data.people.find((p) => p.id === c.personId) ? (
                    <Avatar emoji={data.people.find((p) => p.id === c.personId)!.emoji} size={30} />
                  ) : (
                    <Icon name="call-outline" size={20} color={t.muted} />
                  )}
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
                    {data.people.find((p) => p.id === c.personId)?.name ?? 'Someone'}
                  </Text>
                </View>
                <Text style={{ color: t.muted }}>{formatDay(c.date)}</Text>
              </View>
              {c.note ? <Text style={{ color: t.muted, marginTop: 4 }}>{c.note}</Text> : null}
            </Pressable>
          ))
        )}
      </Card>
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
        Press and hold a call to delete it.
      </Text>
    </ScrollView>
  );
}
