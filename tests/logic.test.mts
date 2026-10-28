// Logic tests: AI function (with a fake Cloudflare), AI output checks, talking points, learned times, reminders.
// Run with: npm test
import assert from 'node:assert/strict';
const P = new URL('../', import.meta.url).pathname;
// ---- edge function with mocked Deno + fetch ----
let handler: any; const env: Record<string,string> = {};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] }, serve: (h: any) => { handler = h; } };
let lastFetch: any = null; let cfReply: any = null; let cfStatus = 200;
(globalThis as any).fetch = async (url: string, init: any) => { lastFetch = { url, body: JSON.parse(init.body), auth: init.headers.Authorization };
  return new Response(typeof cfReply === 'string' ? cfReply : JSON.stringify(cfReply), { status: cfStatus }); };
await import(P + 'supabase/functions/tidy-note/index.ts');
const call = async (b: any) => (await handler(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }))).json();
assert.deepEqual(await call({ note: 'hello there' }), { error: 'not_configured' });
env.CF_ACCOUNT_ID = 'acc'; env.CF_API_TOKEN = 'tok';
cfReply = { result: { response: 'Sure! {"note":"Mak ke Penang Jumaat depan.","followUps":[{"text":"Ask Mak how Penang went","date":"2026-11-07"}],"dates":[]} thanks' }, success: true };
const r = await call({ note: 'mak g penang jumaat depan', personName: 'Mak', today: '2026-10-28' });
assert.equal(r.note, 'Mak ke Penang Jumaat depan.');
assert.ok(lastFetch.url.endsWith('/accounts/acc/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast'));
assert.equal(lastFetch.auth, 'Bearer tok');
assert.ok(lastFetch.body.messages[0].content.includes('2026-10-28 (Wednesday)'));
assert.ok(lastFetch.body.messages[0].content.includes('with Mak'));
cfStatus = 429; cfReply = 'too many'; assert.deepEqual(await call({ note: 'something here' }), { error: 'limit' });
cfStatus = 400; cfReply = '{"errors":[{"message":"you have used up your daily free allocation of 10,000 neurons"}]}'; assert.deepEqual(await call({ note: 'something here' }), { error: 'limit' });
cfStatus = 500; cfReply = 'boom'; assert.deepEqual(await call({ note: 'something here' }), { error: 'ai_failed' });
cfStatus = 200; cfReply = { result: { response: 'no json here' } }; assert.deepEqual(await call({ note: 'something here' }), { error: 'ai_failed' });
cfReply = { result: { response: { note: 'obj', followUps: [], dates: [] } } }; assert.equal((await call({ note: 'something here' })).note, 'obj');
assert.equal((await handler(new Request('http://x', { method: 'POST', body: '{"note":"a"}' }))).status, 400);
console.log('edge function: ok');

// ---- sanitize ----
const { sanitizeSuggestion } = await import(P + 'src/aiParse.ts');
const s = sanitizeSuggestion({ note: '  Mak   ok ', followUps: [{ text: 'Ask', date: '2026-02-30' }, { text: 'B', date: '2026-11-01' }, { text: '' }, { text: 'C', date: '2026-11-02' }, { text: 'D', date: '2026-11-03' }],
  dates: [{ title: 'Past', date: '2026-10-01' }, { title: 'Bday', date: '2027-03-04', yearly: true }, { title: 'Far', date: '2030-01-01' }, { title: 'x', date: 'soon' }] }, '2026-10-28');
assert.equal(s.note, 'Mak ok');
assert.deepEqual(s.followUps.map((f: any) => [f.text, f.date]), [['Ask', '2026-10-31'], ['B', '2026-11-01'], ['C', '2026-11-02']]);
assert.deepEqual(s.dates, [{ title: 'Bday', date: '2027-03-04', yearly: true }]);
assert.equal(sanitizeSuggestion({ note: '' }, '2026-10-28'), null);
assert.equal(sanitizeSuggestion('nope', '2026-10-28'), null);
console.log('sanitize: ok');

// ---- smart ----
const smart = await import(P + 'src/smart.ts');
const { DEFAULT_DATA } = await import(P + 'src/storage.ts');
const now = new Date(2026, 9, 28, 18, 0);
const data = { ...DEFAULT_DATA,
  calls: [
    { id: '1', date: '2026-10-01', personId: 'mum', time: 21 * 60 + 10 },
    { id: '2', date: '2026-10-06', personId: 'mum', time: 21 * 60 + 40 },
    { id: '3', date: '2026-10-11', personId: 'mum', time: 9 * 60 },
    { id: '4', date: '2026-10-16', personId: 'mum', time: 22 * 60 + 5, note: 'Mak has a cough' },
    { id: '5', date: '2026-10-20', personId: 'dad' },
  ],
  topics: [
    { id: 'a', personId: 'mum', text: 'Ask how the clinic visit went', done: false, createdAt: '2026-10-16', dueDate: '2026-10-27' },
    { id: 'b', personId: null, text: 'Got the internship', done: false, createdAt: '2026-10-20' },
    { id: 'c', personId: 'mum', text: 'Done thing', done: true, createdAt: '2026-10-20' },
    { id: 'e', personId: 'mum', text: 'Later follow-up', done: false, createdAt: '2026-10-20', dueDate: '2026-11-20' },
  ],
  dates: [
    { id: 'd1', title: "Tok's birthday", personId: null, date: '1950-11-03', yearly: true, remindDaysBefore: 3 },
    { id: 'd2', title: "Dad's thing", personId: 'dad', date: '2026-11-01', yearly: false, remindDaysBefore: 1 },
  ],
};
const pts = smart.talkingPoints(data, 'mum', now);
assert.deepEqual(pts.map((p: any) => p.text), ['Ask: how the clinic visit went', 'Tell them: Got the internship', "Tok's birthday is in 6 days", 'Last time: Mak has a cough']);
const lt = smart.learnedTime(data.calls, 'mum', now);
assert.equal(lt.hits, 3); assert.equal(lt.total, 4); assert.equal(lt.start, 20 * 60 + 30); console.log('learned:', lt.label);
assert.equal(smart.learnedTime(data.calls, 'dad', now), null);
assert.equal(smart.usualGap(data.calls, 'mum'), 5);
assert.equal(smart.reminderReason(data, 'mum', 12), 'Ask: how the clinic visit went');
assert.equal(smart.reminderReason(data, 'dad', 12), "You haven't told them yet: Got the internship");
assert.equal(smart.reminderReason({ ...data, topics: [] }, 'mum', 9), 'Longer than usual. You normally call every 5 days.');
assert.equal(smart.reminderReason({ ...data, topics: [] }, 'mum', 6), null);
// wraps past midnight
const late = [23 * 60 + 30, 0, 30].map((t, i) => ({ id: String(i), date: '2026-10-2' + i, personId: 'x', time: t }));
assert.equal(smart.learnedTime(late, 'x', now).hits, 3);
console.log('smart: ok');

// ---- plan uses the reason ----
const { planReminders } = await import(P + 'src/plan.ts');
const plan = planReminders(data, now);
const mumNudge = plan.find((r: any) => r.kind.includes('nudge:mum'));
assert.ok(mumNudge.body.includes('Ask: how the clinic visit went'), mumNudge.body);
console.log('plan:', mumNudge.title, '|', mumNudge.body);
console.log('ALL OK');
