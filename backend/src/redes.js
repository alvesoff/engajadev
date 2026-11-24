// Rede de cada link, descoberta pelo endereço (domínio).
const REDES = [
  ['linkedin', /(^|\.)(linkedin\.com|lnkd\.in)$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['devto', /(^|\.)dev\.to$/],
  ['x', /(^|\.)(x\.com|twitter\.com)$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
  ['medium', /(^|\.)medium\.com$/],
  ['github', /(^|\.)github\.com$/],
  ['tabnews', /(^|\.)tabnews\.com\.br$/],
];

export const NOMES_REDES = [...REDES.map(([n]) => n), 'outra'];

/** Confere e arruma o link. Devolve { url, rede } ou null se não for um link válido. */
export function analisarLink(bruto) {
  let u;
  try {
    u = new URL(String(bruto ?? '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!u.hostname.includes('.') || u.username || u.password) return null;
  u.hash = '';
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const rede = REDES.find(([, re]) => re.test(host))?.[0] ?? 'outra';
  return { url: u.toString(), rede };
}
