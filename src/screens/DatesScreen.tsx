import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DateSheet } from '../sheets/DateSheet';
import { ImportantDate, formatDay, upcomingDates } from '../storage';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Button, Card, Chevron, Chip, Icon, SectionTitle, base } from '../ui';

const EXTRA_SUGGESTIONS = [
  { title: "Parents' anniversary", yearly: true },
  { title: 'Hari Raya', yearly: false },
  { title: "Mother's Day", yearly: false },
  { title: "Father's Day", yearly: false },
];

type Editing = { item: ImportantDate | null; suggestion?: { title: string; yearly: boolean } } | null;

export function DatesScreen(props: { now: Date }) {
  const { data } = useStore();
  const t = useTheme();
  const [editing, setEditing] = useState<Editing>(null);

  const upcoming = upcomingDates(data.dates, props.now);
  const past = data.dates.filter((d) => !upcoming.some((u) => u.item.id === d.id));
  const suggestions = [
    ...data.people.map((p) => ({ title: `${p.name}'s birthday`, yearly: true })),
    ...EXTRA_SUGGESTIONS,
  ];
  const unused = suggestions.filter((s) => !data.dates.some((d) => d.title === s.title));
  const nameOf = (id: string | null) => data.people.find((p) => p.id === id)?.name;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={[base.row, { justifyContent: 'space-between', marginBottom: 18 }]}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5 }}>Dates</Text>
        <Pressable onPress={() => setEditing({ item: null })} hitSlop={12}>
          <View style={[base.row, { gap: 2 }]}>
            <Icon name="add" size={22} color={t.accent} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: t.accent }}>Add</Text>
          </View>
        </Pressable>
      </View>

      {upcoming.length === 0 ? (
        <Card>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Never miss a special day</Text>
          <Text style={{ color: t.muted, marginTop: 6, lineHeight: 20 }}>
            Add birthdays and celebrations. You'll get a heads-up a few days before, plus a reminder to call on
            the day.
          </Text>
          <Button title="Add a date" onPress={() => setEditing({ item: null })} style={{ marginTop: 14 }} />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {upcoming.map(({ item, on, inDays }) => (
            <Pressable key={item.id} onPress={() => setEditing({ item })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 14,
                    backgroundColor: inDays <= 3 ? t.warn : t.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '800', color: inDays <= 3 ? '#fff' : t.accent }}>
                    {inDays}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: inDays <= 3 ? '#fff' : t.accent }}>
                    {inDays === 1 ? 'DAY' : 'DAYS'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
                    {formatDay(on, true)}
                    {item.yearly ? ' · every year' : ''}
                    {nameOf(item.personId) ? ` · ${nameOf(item.personId)}` : ''}
                  </Text>
                </View>
                <Chevron />
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      {unused.length > 0 && (
        <>
          <SectionTitle>Quick add</SectionTitle>
          <View style={base.wrap}>
            {unused.map((s) => (
              <Chip key={s.title} label={`+ ${s.title}`} selected={false} onPress={() => setEditing({ item: null, suggestion: s })} />
            ))}
          </View>
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            Hari Raya, Mother's Day and Father's Day change date each year, so add the date for this year.
          </Text>
        </>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>Passed</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {past.map((d, i) => (
              <Pressable
                key={d.id}
                onPress={() => setEditing({ item: d })}
                style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}
              >
                <Text style={{ color: t.muted, fontSize: 15 }}>
                  {d.title} · {formatDay(d.date, true)} (tap to update for next year)
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <DateSheet
        visible={editing !== null}
        item={editing?.item ?? null}
        suggestion={editing?.suggestion}
        onClose={() => setEditing(null)}
      />
    </ScrollView>
  );
}
