import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { AiSuggestion, tidyNote } from '../ai';
import { addDays, formatDay, newId, openTopics, todayKey } from '../storage';
import { useStore } from '../store';
import { useFamily } from '../family/family';
import { useTheme } from '../theme';
import { Avatar, Button, Card, Checkbox, Chip, Field, Icon, SectionTitle, Sheet, base } from '../ui';

const FOLLOW_UP = [
  { label: 'No', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In a week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

/** Shown when you come back to the app after a call: tick off topics, jot a note, set a follow-up. */
export function AfterCallSheet(props: { callId: string | null; onClose: () => void }) {
  const { data, update } = useStore();
  const family = useFamily();
  const [shareNote, setShareNote] = useState(true);
  const t = useTheme();
  const call = data.calls.find((c) => c.id === props.callId);
  const person = data.people.find((p) => p.id === call?.personId);

  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [followDays, setFollowDays] = useState(0);
  const [followText, setFollowText] = useState('');
  // AI helper
  const [ai, setAi] = useState<AiSuggestion | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [beforeAi, setBeforeAi] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (props.callId) {
      setCovered(new Set());
      setNote(call?.note ?? '');
      setFollowDays(0);
      setFollowText('');
      setAi(null);
      setAiBusy(false);
      setAiError('');
      setBeforeAi(null);
      setPicked(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.callId]);

  if (!call) return null;
  const isShared = !!(family.circle && person?.circlePersonId);
  const topics = person ? openTopics(data.topics, person.id) : data.topics.filter((x) => !x.done);

  const runAi = async () => {
    setAiBusy(true);
    setAiError('');
    try {
      const res = await tidyNote(note, person?.name ?? null);
      setBeforeAi(note);
      setNote(res.note);
      setAi(res);
      // everything the AI found starts ticked; untick what you don't want
      setPicked(new Set([...res.followUps.map((_, i) => `f${i}`), ...res.dates.map((_, i) => `d${i}`)]));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setAiBusy(false);
    }
  };

  const undoAi = () => {
    if (beforeAi !== null) setNote(beforeAi);
    setAi(null);
    setBeforeAi(null);
    setPicked(new Set());
  };

  const togglePick = (key: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const save = () => {
    const today = todayKey();
    const aiTopics = (ai?.followUps ?? [])
      .filter((_, i) => picked.has(`f${i}`))
      .map((f) => ({ id: newId(), personId: call.personId, text: f.text, done: false, createdAt: today, dueDate: f.date }));
    const aiDates = (ai?.dates ?? [])
      .filter((_, i) => picked.has(`d${i}`))
      .map((x) => ({ id: newId(), title: x.title, personId: call.personId, date: x.date, yearly: x.yearly, remindDaysBefore: 1 }));
    const followUpText =
      followText.trim() ||
      (note.trim() ? `Ask how it went: ${note.trim()}` : 'Check in on how things are going');
    update((d) => ({
      ...d,
      calls: d.calls.map((c) => (c.id === call.id ? { ...c, note: note.trim() || undefined } : c)),
      dates: [...d.dates, ...aiDates],
      topics: [
        ...d.topics.map((x) => (covered.has(x.id) ? { ...x, done: true } : x)),
        ...aiTopics,
        ...(followDays > 0
          ? [
              {
                id: newId(),
                personId: call.personId,
                text: followUpText,
                done: false,
                createdAt: today,
                dueDate: addDays(today, followDays),
              },
            ]
          : []),
      ],
    }));
    if (shareNote && isShared) family.setCallNote(call.personId, call.date, note);
    props.onClose();
  };

  const toggle = (id: string) =>
    setCovered((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Sheet visible={!!props.callId} title="How was the call?" onClose={props.onClose} onAction={save} actionLabel="Done">
      <View style={[base.row, { gap: 12 }]}>
        {person ? <Avatar emoji={person.emoji} size={44} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>
            {person ? `Call with ${person.name}` : 'Call'}
          </Text>
          <View style={[base.row, { gap: 4, marginTop: 2 }]}>
            <Icon name="checkmark-circle" size={15} color={t.good} />
            <Text style={{ color: t.muted, fontSize: 14 }}>Logged for {formatDay(call.date)}</Text>
          </View>
        </View>
      </View>

      {topics.length > 0 && (
        <>
          <SectionTitle>Did you mention…</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {topics.map((x) => (
              <Checkbox key={x.id} checked={covered.has(x.id)} onPress={() => toggle(x.id)} label={x.text} />
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Anything worth remembering?</SectionTitle>
      {isShared ? (
        <View style={[base.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
          <Text style={{ color: t.muted, fontSize: 14, flex: 1 }}>Share this note with the family</Text>
          <Switch value={shareNote} onValueChange={setShareNote} trackColor={{ true: t.accent, false: t.line }} />
        </View>
      ) : null}
      <Field
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Mak has a doctor's appointment on Friday"
        multiline
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
        Tip: tap the mic on your keyboard and just say it, e.g. "Mak's going to Penang next Friday, Abah wants the raya
        photos".
      </Text>

      {!ai ? (
        <>
          <Button
            icon="sparkles-outline"
            kind="secondary"
            title={aiBusy ? 'Tidying up…' : 'Tidy up with AI'}
            onPress={runAi}
            disabled={aiBusy || note.trim().length < 8}
          />
          {aiBusy ? <ActivityIndicator color={t.accent} style={{ marginTop: 10 }} /> : null}
          {aiError ? <Text style={{ color: t.bad, fontSize: 13, marginTop: 8, lineHeight: 18 }}>{aiError}</Text> : null}
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
            Cleans up your note and finds follow-ups and dates. Only this note and their name are sent; nothing is stored on the server.
          </Text>
        </>
      ) : (
        <Card style={{ paddingVertical: 12 }}>
          <View style={[base.row, { justifyContent: 'space-between' }]}>
            <View style={[base.row, { gap: 6 }]}>
              <Icon name="sparkles" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: '700' }}>Tidied by AI</Text>
            </View>
            <Pressable onPress={undoAi} hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: '600' }}>Undo</Text>
            </Pressable>
          </View>
          {ai.followUps.length + ai.dates.length === 0 ? (
            <Text style={{ color: t.muted, fontSize: 14, marginTop: 8 }}>No follow-ups or dates found in this note.</Text>
          ) : (
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 8 }}>Untick anything you don't want added:</Text>
          )}
          {ai.followUps.map((f, i) => (
            <Checkbox
              key={`f${i}`}
              strike={false}
              checked={picked.has(`f${i}`)}
              onPress={() => togglePick(`f${i}`)}
              label={f.text}
              sub={`Follow-up reminder ${formatDay(f.date)}`}
            />
          ))}
          {ai.dates.map((x, i) => (
            <Checkbox
              key={`d${i}`}
              strike={false}
              checked={picked.has(`d${i}`)}
              onPress={() => togglePick(`d${i}`)}
              label={x.title}
              sub={`Add to Dates: ${formatDay(x.date, true)}${x.yearly ? ', every year' : ''}`}
            />
          ))}
        </Card>
      )}

      <SectionTitle>Remind me to follow up?</SectionTitle>
      <View style={base.wrap}>
        {FOLLOW_UP.map((f) => (
          <Chip key={f.days} label={f.label} selected={followDays === f.days} onPress={() => setFollowDays(f.days)} />
        ))}
      </View>
      {followDays > 0 && (
        <>
          <Field
            value={followText}
            onChangeText={setFollowText}
            placeholder={note ? `Ask how it went: ${note}` : 'e.g. Ask how the appointment went'}
          />
          <Text style={{ color: t.muted, fontSize: 13 }}>
            You'll get a reminder on {formatDay(addDays(todayKey(), followDays))}, and it'll show on{' '}
            {person?.name ?? 'their'} page until you tick it off.
          </Text>
        </>
      )}
    </Sheet>
  );
}
