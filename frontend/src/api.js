/**
 * Chama a API. Em erro lança um Error com a mensagem do servidor (em português),
 * mais .status e .campo (qual campo do formulário está errado, quando houver).
 */
export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  let res;
  try {
    res = await fetch(`/api${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw Object.assign(new Error('Sem conexão com o servidor. Confira sua internet e tente de novo.'), { status: 0 });
  }
  let dados = null;
  try {
    const txt = await res.text();
    dados = txt ? JSON.parse(txt) : null;
  } catch {
    dados = null;
  }
  if (!res.ok) {
    const mensagem = dados?.erro ?? 'O servidor não respondeu como esperado. Tente de novo em instantes.';
    throw Object.assign(new Error(mensagem), { status: res.status, campo: dados?.campo, dados });
  }
  return dados;
}

export const REDES = {
  linkedin: { nome: 'LinkedIn', cor: '#0a66c2' },
  instagram: { nome: 'Instagram', cor: '#d6249f' },
  devto: { nome: 'Dev.to', cor: '#3b49df' },
  x: { nome: 'X', cor: '#71767b' },
  youtube: { nome: 'YouTube', cor: '#e00030' },
  medium: { nome: 'Medium', cor: '#1a8917' },
  github: { nome: 'GitHub', cor: '#8957e5' },
  tabnews: { nome: 'TabNews', cor: '#2da44e' },
  outra: { nome: 'Blog', cor: '#6b7280' },
};

/** Descobre a rede no navegador só para mostrar enquanto a pessoa digita (o servidor confere). */
export function redeDoLink(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(h)) return 'linkedin';
    if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
    if (/(^|\.)dev\.to$/.test(h)) return 'devto';
    if (/(^|\.)(x\.com|twitter\.com)$/.test(h)) return 'x';
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube';
    if (/(^|\.)medium\.com$/.test(h)) return 'medium';
    if (/(^|\.)github\.com$/.test(h)) return 'github';
    if (/(^|\.)tabnews\.com\.br$/.test(h)) return 'tabnews';
    return h.includes('.') ? 'outra' : null;
  } catch {
    return null;
  }
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
export function tempoRelativo(ms) {
  const s = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(ms).toLocaleDateString('pt-BR');
}

export const MOTIVOS = {
  proprio_post: 'Engajar no próprio post não pontua.',
  ja_curtiu: 'Você já curtiu este post.',
  ja_pontuou: 'Curtida de volta! Ela já tinha pontuado antes, então não soma de novo.',
  comentario_curto: 'Comentário publicado. Comentários curtos não pontuam: capriche mais no próximo!',
  limite_comentarios_post: 'Comentário publicado. Você já pontuou comentando neste post.',
  limite_diario_engajador: 'Você chegou ao limite de pontos de hoje. Amanhã tem mais!',
  limite_diario_criador: 'O autor já chegou ao limite de pontos de hoje.',
};

/** Texto curto com o resultado de pontos de uma ação. */
export function mensagemPontos(p) {
  if (!p) return null;
  if (p.engajador > 0) {
    const extra = p.motivo ? ` ${MOTIVOS[p.motivo] ?? ''}` : '';
    return { tipo: 'ok', texto: `+${p.engajador} ${p.engajador === 1 ? 'ponto' : 'pontos'} para você!${extra}` };
  }
  if (p.motivo) return { tipo: 'info', texto: MOTIVOS[p.motivo] ?? 'Ação registrada.' };
  return null;
}
