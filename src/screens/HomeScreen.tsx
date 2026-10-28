import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useCalls } from '../calls';
import { effectiveDays } from '../family/effective';
import { useFamily } from '../family/family';
import { callVerb } from '../contact';
import { isMaghribNow, maghribWindow } from '../prayer';
import { LogoMark } from '../logo';
import { PersonSheet } from '../sheets/PersonSheet';
import { SettingsSheet } from '../sheets/SettingsSheet';
import { formatRange, inWindow, newId, openTopics, personStatus, todayKey, upcomingDates } from '../storage';
import { useStore } from '../store';
import { learnedTime, talkingPoints } from '../smart';
import { statusColor, useTheme } from '../theme';
import { Avatar, Button, Card, Chip, Field, Icon, PointList, SectionTitle, base } from '../ui';

export function HomeScreen(props: { now: Date; onOpenDates: () => void }) {
  const { data, update } = useStore();
  const { startCall, logIncoming } = useCalls();
  const family = useFamily();
  const t = useTheme();
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [topicFor, setTopicFor] = useState<string | null>(null);

  const people = data.people
    .map((p) => {
      const info = family.infoFor(p.id);
      const days = effectiveDays(data.calls, p.id, info, props.now);
      return {
        p,
        info,
        days,
        status: personStatus(days, p.everyDays),
        topics: openTopics(data.topics, p.id).length,
        // how overdue relative to their own schedule (never called counts as very overdue)
        urgency: days === null ? 999 : days - p.everyDays,
      };
    })
    .sort((a, b) => b.urgency - a.urgency);

  const top = people[0];
  const maghribNow = data.settings.avoidMaghrib && isMaghribNow(props.now, data.settings.city);
  const afterMaghrib = maghribWindow(props.now, data.settings.city).end;
  const usual = top && !top.p.window ? learnedTime(data.calls, top.p.id, props.now) : null;
  const points = top && top.status !== 'good' ? talkingPoints(data, top.p.id, props.now).slice(0, 2) : [];
  const timing = !top
    ? null
    : maghribNow
      ? `It's Maghrib now. Better to call after ${afterMaghrib.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`
      : top.p.window && !inWindow(top.p, props.now)
        ? `${top.p.name} is usually free ${formatRange(top.p.window.start, top.p.window.end)}.`
        : top.p.window
          ? `Good time to call: ${top.p.name} is usually free now.`
          : usual
            ? `You usually reach ${top.p.name} around ${usual.label}.`
            : null;
  const soon = upcomingDates(data.dates, props.now).filter((x) => x.inDays <= 30).slice(0, 3);

  const addTopic = () => {
    if (!topic.trim()) return;
    update((d) => ({
      ...d,
      topics: [...d.topics, { id: newId(), personId: topicFor, text: topic.trim(), done: false, createdAt: todayKey() }],
    }));
    setTopic('');
  };

  const headline = !top
    ? 'Add someone in Settings'
    : top.days === null
      ? `Start by calling ${top.p.name}`
      : top.status === 'overdue'
        ? `Time to call ${top.p.name}`
        : top.status === 'soon'
          ? `${top.p.name} is due for a call soon`
          : "You're all caught up";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={[base.row, { justifyContent: 'space-between', marginBottom: 18 }]}>
        <View style={[base.row, { gap: 10 }]}>
          <LogoMark size={34} />
          <Text style={{ fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5 }}>Calm Call</Text>
        </View>
        <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12} accessibilityLabel="Settings">
          <Icon name="settings-outline" size={26} color={t.accent} />
        </Pressable>
      </View>

      {top && (
        <Card style={{ paddingVertical: 22 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: t.text }}>{headline}</Text>
          <Text style={{ fontSize: 14, color: t.muted, marginTop: 6 }}>
            {top.days === null
              ? 'Your first call starts the count.'
              : `Last call with ${top.p.name} was ${top.days === 0 ? 'today' : `${top.days} day${top.days > 1 ? 's' : ''} ago`}.`}
            {top.topics > 0 ? ` ${top.topics} thing${top.topics > 1 ? 's' : ''} to tell them.` : ''}
          </Text>
          {timing ? (
            <View style={[base.row, { gap: 6, marginTop: 10 }]}>
              <Icon name={maghribNow ? 'moon-outline' : 'time-outline'} size={16} color={maghribNow ? t.warn : t.accent} />
              <Text style={{ flex: 1, fontSize: 14, color: maghribNow ? t.warn : t.accent, fontWeight: '600' }}>{timing}</Text>
            </View>
          ) : null}
          {points.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <PointList points={points} color={t.accent} textColor={t.text} />
            </View>
          ) : null}
          {top.status !== 'good' && top.p.phone ? (
            <Button icon={top.p.via === 'whatsapp' ? 'logo-whatsapp' : 'call'} title={`${callVerb(top.p)} now`} onPress={() => startCall(top.p.id)} style={{ marginTop: 16 }} />
          ) : null}
        </Card>
      )}

      <SectionTitle>Your people</SectionTitle>
      <View style={{ gap: 10 }}>
        {people.map(({ p, info, days, status, topics }) => (
          <Pressable
            key={p.id}
            onPress={() => setOpenPerson(p.id)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
              <Avatar emoji={p.emoji} size={50} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: t.text }}>{p.name}</Text>
                <Text style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>
                  every {p.everyDays} days
                  {p.window ? ` · free ${formatRange(p.window.start, p.window.end)}` : ''}
                </Text>
                {info && info.memberCount > 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 3 }}>
                    <View style={{ marginTop: 1 }}>
                      <Icon name="people" size={14} color={info.myTurn ? t.accent : t.muted} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: info.myTurn ? t.accent : t.muted, fontWeight: '600' }}>
                      {info.lastBy && !info.lastByMe ? `${info.lastBy} called last · ` : ''}
                      {info.myTurn ? 'your turn' : `${info.turnName}'s turn`}
                    </Text>
                  </View>
                ) : null}
                {p.window && inWindow(p, props.now) && !maghribNow ? (
                  <View style={[base.row, { gap: 4, marginTop: 3 }]}>
                    <Icon name="time" size={14} color={t.good} />
                    <Text style={{ fontSize: 13, color: t.good, fontWeight: '600' }}>Free now</Text>
                  </View>
                ) : null}
                {topics > 0 ? (
                  <View style={[base.row, { gap: 4, marginTop: 3 }]}>
                    <Icon name="chatbubble-ellipses" size={14} color={t.accent} />
                    <Text style={{ fontSize: 13, color: t.accent, fontWeight: '600' }}>{topics} to tell</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 26, fontWeight: '800', color: statusColor(t, status) }}>{days ?? '–'}</Text>
                <Text style={{ fontSize: 12, color: t.muted }}>days</Text>
              </View>
              <Pressable
                onPress={() => (p.phone ? startCall(p.id) : setOpenPerson(p.id))}
                hitSlop={8}
                accessibilityLabel={callVerb(p)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: t.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 4,
                }}
              >
                <Icon name={p.via === 'whatsapp' ? 'logo-whatsapp' : 'call'} size={21} color={t.onAccent} />
              </Pressable>
            </Card>
          </Pressable>
        ))}
      </View>
      <Button icon="checkmark-circle-outline" title="They called me / log a call" kind="secondary" onPress={logIncoming} style={{ marginTop: 12 }} />

      <SectionTitle>Save something to tell them</SectionTitle>
      <Field
        value={topic}
        onChangeText={setTopic}
        placeholder="e.g. Got the internship!"
        onSubmitEditing={addTopic}
        returnKeyType="done"
      />
      <View style={base.wrap}>
        <Chip label="Everyone" selected={topicFor === null} onPress={() => setTopicFor(null)} />
        {data.people.map((p) => (
          <Chip key={p.id} label={p.name} selected={topicFor === p.id} onPress={() => setTopicFor(p.id)} />
        ))}
      </View>
      <Button title="Save" kind="secondary" onPress={addTopic} disabled={!topic.trim()} style={{ marginTop: 4 }} />

      <SectionTitle
        right={
          <Pressable onPress={props.onOpenDates} hitSlop={8}>
            <Text style={{ color: t.accent, fontWeight: '600' }}>See all</Text>
          </Pressable>
        }
      >
        Coming up
      </SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {soon.length === 0 ? (
          <Text style={{ color: t.muted, paddingVertical: 12 }}>
            Nothing in the next 30 days. Add birthdays and celebrations in Dates.
          </Text>
        ) : (
          soon.map((x, i) => (
            <View
              key={x.item.id}
              style={[base.row, { paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }]}
            >
              <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>{x.item.title}</Text>
              <Text style={{ color: x.inDays <= 3 ? t.warn : t.muted, fontWeight: '600' }}>
                {x.inDays === 0 ? 'Today!' : x.inDays === 1 ? 'Tomorrow' : `in ${x.inDays} days`}
              </Text>
            </View>
          ))
        )}
      </Card>

      <PersonSheet personId={openPerson} onClose={() => setOpenPerson(null)} />
      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ScrollView>
  );
}
