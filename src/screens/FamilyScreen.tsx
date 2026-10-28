import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { useFamily } from '../family/family';
import { daysBetween, formatDay, keyToDate } from '../storage';
import { useStore } from '../store';
import { statusColor, useTheme } from '../theme';
import { personStatus } from '../storage';
import { Avatar, Button, Card, Checkbox, Chip, Field, Icon, SectionTitle, base } from '../ui';

export function FamilyScreen(props: { now: Date }) {
  const family = useFamily();
  const t = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        family.circle ? <RefreshControl refreshing={false} onRefresh={family.refresh} tintColor={t.accent} /> : undefined
      }
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5, marginBottom: 18 }}>
        Family
      </Text>
      {!family.configured ? (
        <NotSetUp />
      ) : family.status === 'loading' ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      ) : family.circle ? (
        <CircleView now={props.now} />
      ) : (
        <StartOrJoin />
      )}
      {family.status === 'error' && family.error ? (
        <Card style={{ marginTop: 16, borderColor: t.bad }}>
          <Text style={{ color: t.bad, fontWeight: '700' }}>Couldn't reach the family circle</Text>
          <Text style={{ color: t.muted, marginTop: 4 }}>{family.error}</Text>
          <Button title="Try again" kind="secondary" onPress={family.refresh} style={{ marginTop: 12 }} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

// ---------- Not configured ----------
function NotSetUp() {
  const t = useTheme();
  return (
    <Card>
      <Icon name="people-outline" size={32} color={t.accent} />
      <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', marginTop: 10 }}>Family Circle isn't connected yet</Text>
      <Text style={{ color: t.muted, marginTop: 6, lineHeight: 20 }}>
        Add your Supabase project details to src/config.ts and run supabase/family.sql once. Then you and your
        siblings can share who called Mak and Abah.
      </Text>
    </Card>
  );
}

// ---------- Create or join ----------
function StartOrJoin() {
  const family = useFamily();
  const { data } = useStore();
  const t = useTheme();
  const [myName, setMyName] = useState(data.family?.myName ?? '');
  const [circleName, setCircleName] = useState('');
  const [code, setCode] = useState('');
  const [shareIds, setShareIds] = useState<string[]>([]);
  const toggleShare = (id: string) =>
    setShareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const run = async (kind: 'create' | 'join') => {
    if (!myName.trim()) return Alert.alert('What should your family call you?', 'e.g. Along, Angah, Naufal');
    if (kind === 'create' && !circleName.trim()) return Alert.alert('Give your circle a name', 'e.g. Keluarga Nizam');
    if (kind === 'join' && code.replace(/\s/g, '').length !== 6) return Alert.alert('Enter the 6-letter code');
    setBusy(kind);
    try {
      if (kind === 'create') await family.create(circleName, myName, shareIds);
      else await family.join(code, myName);
    } catch (e) {
      Alert.alert("That didn't work", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Call your parents together</Text>
        <Text style={{ color: t.muted, marginTop: 6, lineHeight: 20 }}>
          See who last called Mak and Abah, take turns so no one forgets, and share news so everyone knows what's
          going on. Phone numbers and private notes stay on your phone.
        </Text>
      </Card>

      <SectionTitle>Your name in the family</SectionTitle>
      <Field value={myName} onChangeText={setMyName} placeholder="e.g. Along, Angah, Naufal" autoCapitalize="words" />

      <SectionTitle>Start a new circle</SectionTitle>
      <Field value={circleName} onChangeText={setCircleName} placeholder="e.g. Keluarga Nizam" autoCapitalize="words" />
      {data.people.length > 0 ? (
        <>
          <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>
            Who should the family share? Tick the people your siblings also call.
          </Text>
          <Card style={{ paddingVertical: 4, marginBottom: 8 }}>
            {data.people.map((p, i) => (
              <View key={p.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                <Checkbox
                  checked={shareIds.includes(p.id)}
                  strike={false}
                  onPress={() => toggleShare(p.id)}
                  label={p.name}
                  sub={shareIds.includes(p.id) ? 'Shared with the family' : 'Stays private on your phone'}
                />
              </View>
            ))}
          </Card>
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 10, lineHeight: 17 }}>
            Only names, pictures and reminder gaps are shared, never phone numbers. You can share more people
            later from this tab.
          </Text>
        </>
      ) : null}
      <Button
        icon="add-circle-outline"
        title={busy === 'create' ? 'Creating…' : 'Create family circle'}
        onPress={() => run('create')}
        disabled={!!busy}
      />

      <SectionTitle>Or join your sibling's circle</SectionTitle>
      <Field
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="e.g. MAK7Q2"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        style={{ letterSpacing: 4, fontSize: 20, textAlign: 'center' }}
      />
      <Button
        icon="enter-outline"
        kind="secondary"
        title={busy === 'join' ? 'Joining…' : 'Join with code'}
        onPress={() => run('join')}
        disabled={!!busy}
      />
    </>
  );
}

// ---------- The circle ----------
function CircleView(props: { now: Date }) {
  const family = useFamily();
  const { data } = useStore();
  const t = useTheme();
  const [newsText, setNewsText] = useState('');
  const [newsFor, setNewsFor] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const circle = family.circle!;

  const shareCode = () =>
    Share.share({
      message: `Join our family circle on Calm Call so we can take turns calling Mak & Abah.\nCode: ${circle.code}`,
    });

  const post = async () => {
    if (!newsText.trim()) return;
    try {
      await family.addNews(newsText, newsFor);
      setNewsText('');
    } catch (e) {
      Alert.alert("Couldn't post", e instanceof Error ? e.message : String(e));
    }
  };

  const leave = () =>
    Alert.alert(`Leave ${circle.name}?`, 'Your own call history stays on your phone. You can rejoin with the code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => family.leave() },
    ]);

  const personName = (id: string | null) => family.people.find((p) => p.id === id)?.name;
  const openNews = family.news.filter((n) => !n.done);
  const doneNews = family.news.filter((n) => n.done);
  const notShared = data.people.filter((p) => !p.circlePersonId || !family.people.some((cp) => cp.id === p.circlePersonId));
  const recentCalls = family.calls.slice(0, 12);

  return (
    <>
      {/* Header */}
      <Card>
        <Text style={{ color: t.text, fontSize: 20, fontWeight: '800' }}>{circle.name}</Text>
        <View style={[base.wrap, { marginTop: 10 }]}>
          {family.members.map((m) => (
            <Chip key={m.user_id} label={family.nameOf(m.user_id)} selected={m.user_id === family.me} onPress={() => {}} />
          ))}
        </View>
        <Pressable
          onPress={shareCode}
          style={({ pressed }) => [
            base.row,
            {
              marginTop: 6,
              padding: 12,
              borderRadius: 12,
              backgroundColor: t.accentSoft,
              justifyContent: 'space-between',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <View>
            <Text style={{ color: t.muted, fontSize: 12 }}>Invite code</Text>
            <Text style={{ color: t.accent, fontSize: 24, fontWeight: '800', letterSpacing: 4 }}>{circle.code}</Text>
          </View>
          <View style={[base.row, { gap: 6 }]}>
            <Icon name="share-outline" size={20} color={t.accent} />
            <Text style={{ color: t.accent, fontWeight: '700' }}>Invite</Text>
          </View>
        </Pressable>
      </Card>

      {/* People */}
      <SectionTitle>Who called who</SectionTitle>
      <View style={{ gap: 10 }}>
        {family.people.length === 0 ? (
          <Card>
            <Text style={{ color: t.muted }}>No one added yet. Share someone from your list below.</Text>
          </Card>
        ) : (
          family.people.map((cp) => {
            const local = data.people.find((p) => p.circlePersonId === cp.id);
            const info = local ? family.infoFor(local.id) : null;
            const callsFor = family.calls.filter((c) => c.person_id === cp.id);
            const last = callsFor[0] ?? null; // calls are newest first
            const days = last ? daysBetween(keyToDate(last.day), props.now) : null;
            const status = personStatus(days, cp.every_days);
            return (
              <Card key={cp.id} style={{ paddingVertical: 14 }}>
                <View style={[base.row, { gap: 12 }]}>
                  <Avatar emoji={cp.emoji || cp.name.slice(0, 1).toUpperCase()} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{cp.name}</Text>
                    <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
                      {last
                        ? `${family.nameOf(last.user_id)} called ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`
                        : 'No one has called yet'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: statusColor(t, status) }}>{days ?? '–'}</Text>
                    <Text style={{ fontSize: 12, color: t.muted }}>days</Text>
                  </View>
                </View>
                {info?.turnName ? (
                  <View
                    style={[
                      base.row,
                      {
                        gap: 6,
                        marginTop: 10,
                        alignSelf: 'flex-start',
                        backgroundColor: info.myTurn ? t.accent : t.chip,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                      },
                    ]}
                  >
                    <Icon name="repeat" size={14} color={info.myTurn ? t.onAccent : t.text} />
                    <Text style={{ color: info.myTurn ? t.onAccent : t.text, fontWeight: '700', fontSize: 13 }}>
                      {info.myTurn ? 'Your turn next' : `${info.turnName}'s turn next`}
                    </Text>
                  </View>
                ) : null}
                {!local ? (
                  <Button
                    title={`Add ${cp.name} to my list`}
                    icon="person-add-outline"
                    kind="secondary"
                    onPress={() => family.addCirclePersonLocally(cp.id)}
                    style={{ marginTop: 12 }}
                  />
                ) : null}
              </Card>
            );
          })
        )}
      </View>
      <Text style={{ color: t.muted, fontSize: 13, marginTop: 8, lineHeight: 18 }}>
        Whoever has gone longest without calling is next. They get the reminder first; everyone else is reminded
        a few days later only if no one calls.
      </Text>

      {notShared.length > 0 ? (
        <>
          <SectionTitle>Only on your phone</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {notShared.map((p, i) => (
              <View
                key={p.id}
                style={[base.row, { gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }]}
              >
                <Avatar emoji={p.emoji} size={34} />
                <Text style={{ flex: 1, color: t.text, fontSize: 16 }}>{p.name}</Text>
                <Pressable
                  onPress={() =>
                    family.shareLocalPerson(p.id).catch((e) => Alert.alert("Couldn't share", String(e?.message ?? e)))
                  }
                  hitSlop={8}
                >
                  <Text style={{ color: t.accent, fontWeight: '700' }}>Share</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* News */}
      <SectionTitle>Family news</SectionTitle>
      <Field
        value={newsText}
        onChangeText={setNewsText}
        placeholder="e.g. Mak's checkup is on Friday"
        onSubmitEditing={post}
        returnKeyType="send"
      />
      <View style={base.wrap}>
        <Chip label="Everyone" selected={newsFor === null} onPress={() => setNewsFor(null)} />
        {family.people.map((cp) => (
          <Chip key={cp.id} label={`About ${cp.name}`} selected={newsFor === cp.id} onPress={() => setNewsFor(cp.id)} />
        ))}
      </View>
      <Button title="Post to family" icon="send-outline" kind="secondary" onPress={post} disabled={!newsText.trim()} />

      <Card style={{ paddingVertical: 4, marginTop: 12 }}>
        {openNews.length === 0 ? (
          <Text style={{ color: t.muted, paddingVertical: 12 }}>No news yet. Share anything the others should know.</Text>
        ) : (
          openNews.map((n) => (
            <Checkbox
              key={n.id}
              checked={false}
              onPress={() => family.toggleNews(n.id, true)}
              label={n.text}
              sub={`${family.nameOf(n.user_id)}${personName(n.person_id) ? ` · about ${personName(n.person_id)}` : ''} · ${formatDay(n.created_at.slice(0, 10))}`}
            />
          ))
        )}
      </Card>
      {doneNews.length > 0 ? (
        <Pressable onPress={() => setShowDone((v) => !v)} hitSlop={8} style={{ marginTop: 10 }}>
          <Text style={{ color: t.muted, fontWeight: '600' }}>
            {showDone ? 'Hide' : 'Show'} {doneNews.length} done
          </Text>
        </Pressable>
      ) : null}
      {showDone ? (
        <Card style={{ paddingVertical: 4, marginTop: 8 }}>
          {doneNews.slice(0, 20).map((n) => (
            <Checkbox key={n.id} checked onPress={() => family.toggleNews(n.id, false)} label={n.text} sub={family.nameOf(n.user_id)} />
          ))}
        </Card>
      ) : null}

      {/* Recent calls */}
      <SectionTitle>Recent family calls</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {recentCalls.length === 0 ? (
          <Text style={{ color: t.muted, paddingVertical: 12 }}>Calls from anyone in the family show up here.</Text>
        ) : (
          recentCalls.map((c, i) => (
            <View key={`${c.person_id}-${c.user_id}-${c.day}`} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
              <View style={[base.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: t.text, fontSize: 15, fontWeight: '600', flex: 1 }}>
                  {family.nameOf(c.user_id)} called {personName(c.person_id) ?? 'someone'}
                </Text>
                <Text style={{ color: t.muted }}>{formatDay(c.day)}</Text>
              </View>
              {c.note ? <Text style={{ color: t.muted, marginTop: 4 }}>{c.note}</Text> : null}
            </View>
          ))
        )}
      </Card>

      <Button title="Leave family circle" kind="danger" onPress={leave} style={{ marginTop: 28 }} />
    </>
  );
}
