// Calm Call: "Tidy up with AI" for after-call notes.
// Runs on Supabase Edge Functions and calls Cloudflare Workers AI (free daily allowance).
// Secrets (Supabase → Edge Functions → Secrets): CF_ACCOUNT_ID, CF_API_TOKEN, optional CF_MODEL.
// Nothing is stored: the note goes in, the tidy version comes out.

const MODEL_DEFAULT = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_NOTE = 1500;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function weekday(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
}

function systemPrompt(today: string, person: string): string {
  return `You help someone keep notes about phone calls with their family in Malaysia. Notes are often a mix of Malay and English.
Today is ${today} (${weekday(today)}). The call was with ${person || 'a family member'}.

Reply with ONLY a JSON object, no other text:
{"note": string, "followUps": [{"text": string, "date": "YYYY-MM-DD"}], "dates": [{"title": string, "date": "YYYY-MM-DD", "yearly": boolean}]}

Rules:
- note: rewrite the user's note as 1 to 3 short, clear sentences in the same language mix they used. Keep every fact. Never add facts that are not in the note.
- followUps: things the user should ask about or do later because of this call, as short instructions (e.g. "Ask Mak how the Penang trip went", "Send Abah the raya photos"). At most 3. "date" is when to remind them: the day after an event for "ask how it went", otherwise 3 days from today.
- dates: only events or birthdays in the note that have a clear date. Work out relative days ("next Friday", "esok", "lusa", "minggu depan") from today. "yearly" is true only for birthdays and anniversaries. At most 3.
- Use empty arrays when nothing fits. Dates must be today or later.`;
}

/** Pull the first {...} block out of the model's reply and parse it. */
function parseJson(reply: unknown): unknown {
  if (reply && typeof reply === 'object') return reply;
  if (typeof reply !== 'string') return null;
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const accountId = Deno.env.get('CF_ACCOUNT_ID');
  const token = Deno.env.get('CF_API_TOKEN');
  const model = Deno.env.get('CF_MODEL') || MODEL_DEFAULT;
  if (!accountId || !token) return json({ error: 'not_configured' });

  let body: { note?: unknown; personName?: unknown; today?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
  const person = typeof body.personName === 'string' ? body.personName.trim().slice(0, 40) : '';
  const today =
    typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // Malaysia time
  if (note.length < 3) return json({ error: 'bad_request' }, 400);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt(today, person) },
          { role: 'user', content: note },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
  } catch {
    return json({ error: 'ai_failed' });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Cloudflare AI error', res.status, detail.slice(0, 300));
    // The free daily allowance ran out (or too many requests)
    if (res.status === 429 || /neuron|limit|quota/i.test(detail)) return json({ error: 'limit' });
    return json({ error: 'ai_failed' });
  }

  const data = await res.json().catch(() => null);
  const parsed = parseJson(data?.result?.response);
  if (!parsed) return json({ error: 'ai_failed' });
  return json(parsed); // the app checks every field again before using it
});
