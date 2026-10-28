/**
 * AI note helper. The app never talks to the AI directly: it sends the note to
 * our Supabase function ("tidy-note"), which calls Cloudflare's free AI with a
 * key that stays on the server. Only the note text and the person's name are sent.
 */
import { ensureSignedIn, supabase } from './family/supabase';
import { todayKey } from './storage';
import { AiSuggestion, sanitizeSuggestion } from './aiParse';

export type { AiDate, AiFollowUp, AiSuggestion } from './aiParse';

export const MAX_NOTE_CHARS = 1500;

export async function tidyNote(note: string, personName: string | null): Promise<AiSuggestion> {
  if (!supabase) throw new Error('The AI helper needs the Supabase setup in src/config.ts.');
  const today = todayKey();
  await ensureSignedIn();
  const { data, error } = await supabase.functions.invoke('tidy-note', {
    body: { note: note.slice(0, MAX_NOTE_CHARS), personName: personName ?? '', today },
  });
  if (error) throw new Error("Couldn't reach the AI helper. Check your internet and try again.");
  if (data?.error === 'not_configured')
    throw new Error("The AI helper isn't switched on yet. Add the Cloudflare keys in Supabase (see the setup steps).");
  if (data?.error === 'limit') throw new Error("Today's free AI limit is used up. Try again tomorrow.");
  if (data?.error) throw new Error("The AI couldn't read that note. Try again, or save it as it is.");
  const clean = sanitizeSuggestion(data, today);
  if (!clean) throw new Error("The AI couldn't read that note. Try again, or save it as it is.");
  return clean;
}
