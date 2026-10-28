import { Person } from './storage';

/** Malaysian-friendly: "012-345 6789" → "60123456789", "+60 12..." → "6012...". */
export function internationalNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return '6' + digits; // local Malaysian number
  return digits;
}

/** The link that starts a call (phone) or opens their chat (WhatsApp). */
export function contactUrl(p: Person): string {
  if (p.via === 'whatsapp') return `https://wa.me/${internationalNumber(p.phone)}`;
  return `tel:${p.phone.replace(/[^\d+]/g, '')}`;
}

export function callVerb(p: Person): string {
  return p.via === 'whatsapp' ? `WhatsApp ${p.name}` : `Call ${p.name}`;
}
