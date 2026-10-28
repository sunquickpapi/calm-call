import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { ImportantDate, keyToDate, newId, personLabel, todayKey } from '../storage';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { Button, Card, Chip, Field, Sheet, Stepper, base } from '../ui';

/** Add or edit an important date. Pass item=null to add (optionally with a suggested title). */
export function DateSheet(props: {
  visible: boolean;
  item: ImportantDate | null;
  suggestion?: { title: string; yearly: boolean };
  onClose: () => void;
}) {
  const { data, update } = useStore();
  const t = useTheme();
  const [draft, setDraft] = useState<ImportantDate>(blank());

  useEffect(() => {
    if (!props.visible) return;
    if (props.item) setDraft(props.item);
    else
      setDraft({
        ...blank(),
        title: props.suggestion?.title ?? '',
        yearly: props.suggestion?.yearly ?? true,
      });
  }, [props.visible, props.item, props.suggestion]);

  const isNew = !props.item;

  const save = () => {
    if (!draft.title.trim()) {
      Alert.alert('Give it a name first');
      return;
    }
    const clean = { ...draft, title: draft.title.trim() };
    update((d) => ({
      ...d,
      dates: isNew ? [...d.dates, clean] : d.dates.map((x) => (x.id === clean.id ? clean : x)),
    }));
    props.onClose();
  };

  const remove = () =>
    Alert.alert(`Delete "${draft.title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          update((d) => ({ ...d, dates: d.dates.filter((x) => x.id !== draft.id) }));
          props.onClose();
        },
      },
    ]);

  return (
    <Sheet visible={props.visible} title={isNew ? 'Add date' : 'Edit date'} onClose={props.onClose} onAction={save}>
      <Field
        label="What is it?"
        value={draft.title}
        onChangeText={(title) => setDraft({ ...draft, title })}
        placeholder="e.g. Mak's birthday"
      />

      <Text style={{ color: t.muted, fontSize: 13, marginBottom: 8 }}>Who is it for?</Text>
      <View style={base.wrap}>
        <Chip label="Everyone" selected={draft.personId === null} onPress={() => setDraft({ ...draft, personId: null })} />
        {data.people.map((p) => (
          <Chip
            key={p.id}
            label={personLabel(p)}
            selected={draft.personId === p.id}
            onPress={() => setDraft({ ...draft, personId: p.id })}
          />
        ))}
      </View>

      <Card style={{ marginTop: 8 }}>
        <View style={[base.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: t.text, fontSize: 16 }}>Date</Text>
          <DateTimePicker
            value={keyToDate(draft.date)}
            mode="date"
            display="compact"
            accentColor={t.accent}
            themeVariant={t.dark ? 'dark' : 'light'}
            onValueChange={(_e, d) => setDraft({ ...draft, date: todayKey(d) })}
          />
        </View>
        <View style={{ height: 1, backgroundColor: t.line, marginVertical: 12 }} />
        <View style={[base.row, { justifyContent: 'space-between' }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: t.text, fontSize: 16 }}>Repeats every year</Text>
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
              On for birthdays. Off for Hari Raya, which moves each year.
            </Text>
          </View>
          <Switch
            value={draft.yearly}
            onValueChange={(yearly) => setDraft({ ...draft, yearly })}
            trackColor={{ true: t.accent, false: t.line }}
          />
        </View>
        <View style={{ height: 1, backgroundColor: t.line, marginTop: 12 }} />
        <Stepper
          label="Heads-up before"
          value={draft.remindDaysBefore === 0 ? 'Only on the day' : `${draft.remindDaysBefore} days before`}
          onMinus={() => setDraft({ ...draft, remindDaysBefore: Math.max(0, draft.remindDaysBefore - 1) })}
          onPlus={() => setDraft({ ...draft, remindDaysBefore: Math.min(30, draft.remindDaysBefore + 1) })}
        />
      </Card>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
        You'll also get a reminder at 9am on the day itself.
      </Text>

      {!isNew && <Button title="Delete date" kind="danger" onPress={remove} style={{ marginTop: 28 }} />}
    </Sheet>
  );
}

function blank(): ImportantDate {
  return { id: newId(), title: '', personId: null, date: todayKey(), yearly: true, remindDaysBefore: 3 };
}
