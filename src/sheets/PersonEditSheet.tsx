import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, Switch, Text, View } from 'react-native';
import { shortcutLink } from '../calls';
import { Person, formatMinutes, newId } from '../storage';
import { useStore } from '../store';
import { useFamily } from '../family/family';
import { useTheme } from '../theme';
import { Avatar, Button, Card, Chip, Field, SectionTitle, Sheet, Stepper, base } from '../ui';

const EMOJIS = [
  '👩', '👨', '👵', '👴', '🧕', '🧔', '👳‍♂️', '👩‍🦳',
  '👧', '👦', '👶', '🧑', '👩‍🎓', '👨‍💼', '👩‍🍳', '👨‍🌾',
  '💛', '❤️', '🌸', '🌙', '⭐', '🏠', '☕', '🐱',
];

/** First letters of the first two words: "Mak Long" → "ML". */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Letters become short uppercase initials (max 3); anything else (emoji) is kept as typed. */
export function cleanPicture(v: string): string {
  const t = v.trim();
  if (/^[A-Za-z0-9 .]*$/.test(t)) return t.replace(/[\s.]/g, '').slice(0, 3).toUpperCase();
  return t;
}

/** Add or edit one person. Pass person=null to add a new one. */
export function PersonEditSheet(props: { visible: boolean; person: Person | null; onClose: () => void }) {
  const { data, update } = useStore();
  const family = useFamily();
  const t = useTheme();
  const [draft, setDraft] = useState<Person>(blank());

  useEffect(() => {
    if (props.visible) setDraft(props.person ?? blank());
  }, [props.visible, props.person]);

  const isNew = !props.person;

  const save = () => {
    if (!draft.name.trim()) {
      Alert.alert('Add a name first');
      return;
    }
    const clean = {
      ...draft,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      emoji: draft.emoji.trim() || initialsOf(draft.name),
    };
    update((d) => ({
      ...d,
      people: isNew ? [...d.people, clean] : d.people.map((p) => (p.id === clean.id ? clean : p)),
    }));
    family.updateSharedPerson(clean); // keeps the family's copy in sync (if shared)
    props.onClose();
  };

  const remove = () => {
    if (data.people.length <= 1) {
      Alert.alert('Keep at least one person');
      return;
    }
    Alert.alert(`Remove ${draft.name}?`, 'Their call history stays in History.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          update((d) => ({
            ...d,
            people: d.people.filter((p) => p.id !== draft.id),
            topics: d.topics.filter((x) => x.personId !== draft.id),
            dates: d.dates.map((x) => (x.personId === draft.id ? { ...x, personId: null } : x)),
          }));
          props.onClose();
        },
      },
    ]);
  };

  return (
    <Sheet visible={props.visible} title={isNew ? 'Add person' : 'Edit person'} onClose={props.onClose} onAction={save}>
      <Field
        label="Name"
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        placeholder="e.g. Mak, Abah, Tok"
        autoFocus={isNew}
      />
      <Field
        label="Phone number"
        value={draft.phone}
        onChangeText={(phone) => setDraft({ ...draft, phone })}
        placeholder="+60 12-345 6789"
        keyboardType="phone-pad"
      />

      <Text style={{ color: t.muted, fontSize: 13, marginBottom: 8 }}>How do you usually reach them?</Text>
      <View style={[base.wrap, { marginBottom: 6 }]}>
        <Chip label="Phone call" selected={draft.via !== 'whatsapp'} onPress={() => setDraft({ ...draft, via: 'phone' })} />
        <Chip label="WhatsApp" selected={draft.via === 'whatsapp'} onPress={() => setDraft({ ...draft, via: 'whatsapp' })} />
      </View>
      {draft.via === 'whatsapp' ? (
        <Text style={{ color: t.muted, fontSize: 12, marginBottom: 14, lineHeight: 17 }}>
          The call button will open your WhatsApp chat with them. Tap the phone or video icon there to call.
        </Text>
      ) : (
        <View style={{ height: 8 }} />
      )}

      <Text style={{ color: t.muted, fontSize: 13, marginBottom: 8 }}>Picture</Text>
      <Card>
        <View style={[base.row, { gap: 14 }]}>
          <Avatar emoji={draft.emoji || initialsOf(draft.name)} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.muted, fontSize: 12, marginBottom: 6 }}>Custom picture</Text>
            <Field
              value={EMOJIS.includes(draft.emoji) ? '' : draft.emoji}
              onChangeText={(v) => setDraft({ ...draft, emoji: cleanPicture(v) })}
              placeholder="Emoji or initials"
              maxLength={11}
              autoCorrect={false}
              autoCapitalize="characters"
              style={{ textAlign: 'center', fontSize: 22 }}
            />
          </View>
        </View>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
          This box is only for the picture: one emoji (use the emoji key on your keyboard) or up to 3
          letters. Their name goes in the Name box above.
        </Text>

        <View style={[base.wrap, { marginTop: 12, gap: 6 }]}>
          {EMOJIS.map((e) => {
            const selected = draft.emoji === e;
            return (
              <Pressable
                key={e}
                onPress={() => setDraft({ ...draft, emoji: e })}
                accessibilityLabel={`Use ${e}`}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? t.accentSoft : 'transparent',
                  borderWidth: 2,
                  borderColor: selected ? t.accent : 'transparent',
                }}
              >
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setDraft({ ...draft, emoji: initialsOf(draft.name) })}
          disabled={!draft.name.trim()}
          style={{ marginTop: 10, opacity: draft.name.trim() ? 1 : 0.4 }}
          hitSlop={8}
        >
          <Text style={{ color: t.accent, fontWeight: '600' }}>
            Use initials{draft.name.trim() ? ` (${initialsOf(draft.name)})` : ''}
          </Text>
        </Pressable>
      </Card>

      <Card style={{ marginTop: 12, paddingVertical: 4 }}>
        <Stepper
          label="Remind me if I haven't called in"
          value={`${draft.everyDays} day${draft.everyDays > 1 ? 's' : ''}`}
          onMinus={() => setDraft({ ...draft, everyDays: Math.max(1, draft.everyDays - 1) })}
          onPlus={() => setDraft({ ...draft, everyDays: Math.min(60, draft.everyDays + 1) })}
        />
      </Card>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
        For example: parents every 5 days, grandparents every 14 days.
      </Text>

      <SectionTitle>Best time to call</SectionTitle>
      <Card style={{ paddingVertical: 8 }}>
        <View style={[base.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.text, fontSize: 16 }}>Only remind me when they're free</Text>
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
              e.g. after Abah's work, or before Mak sleeps
            </Text>
          </View>
          <Switch
            value={!!draft.window}
            onValueChange={(on) => setDraft({ ...draft, window: on ? { start: 20 * 60, end: 22 * 60 } : null })}
            trackColor={{ true: t.accent, false: t.line }}
          />
        </View>
        {draft.window ? (
          <>
            <View style={{ height: 1, backgroundColor: t.line, marginVertical: 4 }} />
            <Stepper
              label="From"
              value={formatMinutes(draft.window.start)}
              onMinus={() => setDraft({ ...draft, window: { ...draft.window!, start: (draft.window!.start + 1410) % 1440 } })}
              onPlus={() => setDraft({ ...draft, window: { ...draft.window!, start: (draft.window!.start + 30) % 1440 } })}
            />
            <Stepper
              label="Until"
              value={formatMinutes(draft.window.end)}
              onMinus={() => setDraft({ ...draft, window: { ...draft.window!, end: (draft.window!.end + 1410) % 1440 } })}
              onPlus={() => setDraft({ ...draft, window: { ...draft.window!, end: (draft.window!.end + 30) % 1440 } })}
            />
          </>
        ) : null}
      </Card>
      {draft.window ? (
        <Text style={{ color: t.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
          Reminders for {draft.name || 'them'} arrive at {formatMinutes(draft.window.start)}, and the app shows
          when it's a good time to call.
        </Text>
      ) : null}

      {!isNew && draft.name.trim() ? (
        <>
          <SectionTitle>Siri & Shortcuts (beta)</SectionTitle>
          <Text style={{ color: t.muted, fontSize: 13, marginBottom: 10, lineHeight: 18 }}>
            Share a link into the Shortcuts app ("Open URLs" action), name the shortcut, and say it to Siri.
          </Text>
          <Button
            icon="mic-outline"
            kind="secondary"
            title={`"I called ${draft.name}" link`}
            onPress={() => Share.share({ message: shortcutLink('log', draft.name.trim()) })}
          />
          <Button
            icon="call-outline"
            kind="secondary"
            title={`"Call ${draft.name}" link`}
            onPress={() => Share.share({ message: shortcutLink('call', draft.name.trim()) })}
            style={{ marginTop: 10 }}
          />
        </>
      ) : null}

      {!isNew && <Button title="Remove person" kind="danger" onPress={remove} style={{ marginTop: 28 }} />}
    </Sheet>
  );
}

function blank(): Person {
  return { id: newId(), name: '', phone: '', everyDays: 7, emoji: '' };
}
