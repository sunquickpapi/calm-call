import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { CITIES, cityOf, maghribAt } from '../prayer';
import { sendTestReminder } from '../reminders';
import { Person } from '../storage';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Avatar, Button, Card, Chevron, Chip, SectionTitle, Sheet, Stepper } from '../ui';
import { PersonEditSheet } from './PersonEditSheet';

export function SettingsSheet(props: { visible: boolean; onClose: () => void }) {
  const { data, update } = useStore();
  const t = useTheme();
  const [editing, setEditing] = useState<Person | null | 'new'>(null);

  const { hour, minute } = data.settings;
  const timeLabel = new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const bump = (delta: number) => {
    const total = (hour * 60 + minute + delta + 1440) % 1440;
    update((d) => ({ ...d, settings: { ...d.settings, hour: Math.floor(total / 60), minute: total % 60 } }));
  };

  return (
    <Sheet visible={props.visible} title="Settings" onClose={props.onClose}>
        <SectionTitle>People</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {data.people.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => setEditing(p)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: t.line,
                gap: 12,
              }}
            >
              <Avatar emoji={p.emoji} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{p.name}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {p.phone || 'No number yet'} · every {p.everyDays} days
                </Text>
              </View>
              <Chevron />
            </Pressable>
          ))}
        </Card>
        <Button icon="person-add-outline"
          title="Add someone" kind="secondary" onPress={() => setEditing('new')} style={{ marginTop: 12 }} />

        <SectionTitle>Reminders</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <Stepper label="Evening reminder time" value={timeLabel} onMinus={() => bump(-30)} onPlus={() => bump(30)} />
        </Card>

        <SectionTitle>Prayer times</SectionTitle>
        <Card style={{ paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: t.text, fontSize: 16 }}>Don't remind me during Maghrib</Text>
              <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
                Today in {cityOf(data.settings.city).name}: Maghrib{' '}
                {maghribAt(new Date(), data.settings.city).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Switch
              value={data.settings.avoidMaghrib}
              onValueChange={(avoidMaghrib) => update((d) => ({ ...d, settings: { ...d.settings, avoidMaghrib } }))}
              trackColor={{ true: t.accent, false: t.line }}
            />
          </View>
        </Card>
        {data.settings.avoidMaghrib ? (
          <>
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 10, marginBottom: 8 }}>
              Your parents' area (for prayer times)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CITIES.map((c) => (
                <Chip
                  key={c.key}
                  label={c.name}
                  selected={data.settings.city === c.key}
                  onPress={() => update((d) => ({ ...d, settings: { ...d.settings, city: c.key } }))}
                />
              ))}
            </ScrollView>
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
              Reminders that land between 10 minutes before and 30 minutes after Maghrib move to just after.
              Times are calculated on your phone and may differ from JAKIM by a minute or two.
            </Text>
          </>
        ) : null}
        <Text style={{ color: t.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
          Call reminders, date heads-ups and follow-ups arrive at this time. Logging a call cancels that
          person's reminders until they're due again.
        </Text>
        <Button
          icon="notifications-outline"
          title="Send a test reminder (in 5 seconds)"
          kind="secondary"
          onPress={() => sendTestReminder(data.people[0])}
          style={{ marginTop: 16 }}
        />
        <Text style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>
          Go to your home screen after tapping to see it.
        </Text>

      <PersonEditSheet
        visible={props.visible && editing !== null}
        person={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </Sheet>
  );
}
