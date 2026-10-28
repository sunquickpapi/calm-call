import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCalls } from '../calls';
import { effectiveDays } from '../family/effective';
import { laterDay } from '../family/turns';
import { useFamily } from '../family/family';
import { callVerb } from '../contact';
import { formatDay, lastCallKey, newId, openTopics, personStatus, todayKey } from '../storage';
import { learnedTime, talkingPoints } from '../smart';
import { useStore } from '../store';
import { statusColor, useTheme } from '../theme';
import { Avatar, Button, Card, Checkbox, Field, Icon, PointList, SectionTitle, Sheet } from '../ui';
import { PersonEditSheet } from './PersonEditSheet';

/** Everything about one person: status, things to tell them, call button. */
export function PersonSheet(props: { personId: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const { startCall, logCall } = useCalls();
  const family = useFamily();
  const t = useTheme();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  const person = data.people.find((p) => p.id === props.personId);
  const visible = !!person;

  const famInfo = person ? family.infoFor(person.id) : null;
  const days = person ? effectiveDays(data.calls, person.id, famInfo) : null;
  const status = person ? personStatus(days, person.everyDays) : 'none';
  const topics = person ? openTopics(data.topics, person.id) : [];
  const followUps = topics.filter((x) => x.dueDate);
  const toTell = topics.filter((x) => !x.dueDate);
  const pastNotes = person
    ? data.calls
        .filter((c) => c.personId === person.id && c.note)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
    : [];

  const addTopic = () => {
    if (!person || !text.trim()) return;
    update((d) => ({
      ...d,
      topics: [
        ...d.topics,
        { id: newId(), personId: person.id, text: text.trim(), done: false, createdAt: todayKey() },
      ],
    }));
    setText('');
  };

  const toggle = (id: string) =>
    update((d) => ({ ...d, topics: d.topics.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));

  if (!person) return null;
  const points = talkingPoints(data, person.id);
  const usual = learnedTime(data.calls, person.id);
  const useUsualTime = () =>
    usual &&
    update((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === person.id ? { ...p, window: { start: usual.start, end: usual.end } } : p)),
    }));
  const mine = lastCallKey(data.calls, person.id);
  const last = laterDay(mine, famInfo?.lastDay);
  const lastBy = famInfo && famInfo.lastDay && famInfo.lastDay === last && !famInfo.lastByMe && famInfo.lastDay !== mine ? famInfo.lastBy : null;

  return (
    <Sheet visible={visible} title={person.name} onClose={props.onClose}>
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Avatar emoji={person.emoji} size={64} />
          <Text style={{ fontSize: 56, fontWeight: '800', color: statusColor(t, status) }}>{days ?? '–'}</Text>
          <Text style={{ fontSize: 16, color: t.text, fontWeight: '600' }}>
            {days === null ? 'No calls logged yet' : days === 0 ? 'Called today' : `day${days > 1 ? 's' : ''} since your last call`}
          </Text>
          <Text style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>
            {last ? `Last call ${formatDay(last)}${lastBy ? ` by ${lastBy}` : ''} · ` : ''}reminder after {person.everyDays} days
          </Text>
          {famInfo && famInfo.memberCount > 1 ? (
            <Text style={{ fontSize: 13, color: famInfo.myTurn ? t.accent : t.muted, marginTop: 4, fontWeight: '600' }}>
              {famInfo.myTurn ? "It's your turn to call next" : `${famInfo.turnName}'s turn to call next`}
            </Text>
          ) : null}
        </Card>

        {points.length > 0 && (
          <>
            <SectionTitle>Before you call</SectionTitle>
            <Card>
              <PointList points={points} color={t.accent} textColor={t.text} />
            </Card>
          </>
        )}

        {usual && (
          <Card style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ marginTop: 1 }}>
                <Icon name="sparkles-outline" size={17} color={t.accent} />
              </View>
              <Text style={{ flex: 1, color: t.text, fontSize: 15, lineHeight: 20 }}>
                You usually reach {person.name} around {usual.label} ({usual.hits} of your last {usual.total} calls).
              </Text>
            </View>
            {!person.window || person.window.start !== usual.start || person.window.end !== usual.end ? (
              <Pressable onPress={useUsualTime} hitSlop={8} style={{ marginTop: 10, marginLeft: 25 }}>
                <Text style={{ color: t.accent, fontWeight: '600' }}>Use as their best time</Text>
              </Pressable>
            ) : null}
          </Card>
        )}

        <Button
          icon={!person.phone ? 'create-outline' : person.via === 'whatsapp' ? 'logo-whatsapp' : 'call'}
          title={person.phone ? callVerb(person) : 'Add a phone number to call'}
          onPress={() => {
            if (!person.phone) return setEditing(true);
            props.onClose();
            startCall(person.id);
          }}
          style={{ marginTop: 16 }}
        />
        <Button
          icon="checkmark-circle-outline"
          title="Log a call (they called me)"
          kind="secondary"
          onPress={() => {
            props.onClose();
            logCall(person.id, true);
          }}
          style={{ marginTop: 10 }}
        />

        {followUps.length > 0 && (
          <>
            <SectionTitle>Ask them about</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {followUps.map((x) => (
                <Checkbox
                  key={x.id}
                  checked={x.done}
                  onPress={() => toggle(x.id)}
                  label={x.text}
                  sub={x.dueDate ? `Follow up ${formatDay(x.dueDate)}` : undefined}
                />
              ))}
            </Card>
          </>
        )}

        <SectionTitle>Things to tell them</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {toTell.length === 0 ? (
            <Text style={{ color: t.muted, paddingVertical: 12 }}>
              Nothing yet. Add news as it happens so you never run out of things to say.
            </Text>
          ) : (
            toTell.map((x) => (
              <Checkbox
                key={x.id}
                checked={x.done}
                onPress={() => toggle(x.id)}
                label={x.text}
                sub={x.personId === null ? 'For everyone' : undefined}
              />
            ))
          )}
        </Card>
        <View style={{ marginTop: 12 }}>
          <Field
            value={text}
            onChangeText={setText}
            placeholder="e.g. Got my exam result, A for Calculus"
            onSubmitEditing={addTopic}
            returnKeyType="done"
          />
          <Button title="Add" kind="secondary" onPress={addTopic} disabled={!text.trim()} />
        </View>

        {pastNotes.length > 0 && (
          <>
            <SectionTitle>From recent calls</SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {pastNotes.map((c, i) => (
                <View
                  key={c.id}
                  style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}
                >
                  <Text style={{ color: t.muted, fontSize: 13 }}>{formatDay(c.date)}</Text>
                  <Text style={{ color: t.text, fontSize: 15, marginTop: 2 }}>{c.note}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        <Pressable onPress={() => setEditing(true)} style={{ marginTop: 28, alignItems: 'center' }} hitSlop={8}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>Edit {person.name}</Text>
        </Pressable>

      <PersonEditSheet visible={visible && editing} person={person} onClose={() => setEditing(false)} />
    </Sheet>
  );
}
