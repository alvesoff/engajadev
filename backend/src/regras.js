import { readFileSync, statSync } from 'node:fs';

/**
 * Todas as regras do jogo. Cada uma tem valor padrão, faixa válida e explicação.
 * De onde vem o valor, do mais forte para o mais fraco:
 *   tela de admin (banco) > arquivo config/regras.json > padrão abaixo.
 * As regras são lidas a cada ação: mudou, vale na hora, sem reiniciar o servidor.
 * Comentar vale mais que curtir: dá mais trabalho e ajuda mais o autor.
 */
export const ESQUEMA = {
  'pontos.curtir': { padrao: 1, min: 0, max: 1000, grupo: 'Pontos por ação', rotulo: 'Curtir um post' },
  'pontos.comentar': { padrao: 3, min: 0, max: 1000, grupo: 'Pontos por ação', rotulo: 'Comentar um post' },
  'pontos.curtidaRecebida': { padrao: 1, min: 0, max: 1000, grupo: 'Pontos por ação', rotulo: 'Receber uma curtida' },
  'pontos.comentarioRecebido': { padrao: 2, min: 0, max: 1000, grupo: 'Pontos por ação', rotulo: 'Receber um comentário' },
  'pontos.publicarPost': { padrao: 0, min: 0, max: 1000, grupo: 'Pontos por ação', rotulo: 'Publicar um post' },

  'limites.pontosDiariosEngajador': {
    padrao: 30, min: 0, max: 100000, grupo: 'Limites (anti-gaming)',
    rotulo: 'Pontos por dia como engajador', ajuda: 'Máximo ganho curtindo e comentando por dia. 0 = sem limite.',
  },
  'limites.pontosDiariosCriador': {
    padrao: 60, min: 0, max: 100000, grupo: 'Limites (anti-gaming)',
    rotulo: 'Pontos por dia como criador', ajuda: 'Máximo ganho com curtidas e comentários recebidos por dia. 0 = sem limite.',
  },
  'limites.cooldownSegundos': {
    padrao: 10, min: 0, max: 3600, grupo: 'Limites (anti-gaming)',
    rotulo: 'Espera entre ações (segundos)', ajuda: 'Tempo mínimo entre duas curtidas ou comentários da mesma pessoa. 0 = sem espera.',
  },
  'limites.comentarioMinCaracteres': {
    padrao: 20, min: 0, max: 1000, grupo: 'Limites (anti-gaming)',
    rotulo: 'Tamanho mínimo do comentário', ajuda: 'Comentário mais curto é publicado, mas não pontua.',
  },
  'limites.comentariosPontuadosPorPost': {
    padrao: 1, min: 0, max: 100, grupo: 'Limites (anti-gaming)',
    rotulo: 'Comentários que pontuam por post', ajuda: 'Quantos comentários da mesma pessoa no mesmo post pontuam. 0 = todos.',
  },
  'limites.postsPorDia': {
    padrao: 5, min: 0, max: 1000, grupo: 'Limites (anti-gaming)',
    rotulo: 'Posts por dia', ajuda: 'Quantos links cada pessoa pode divulgar por dia. 0 = sem limite.',
  },

  'ranking.limiarTopGeral': {
    padrao: 10, min: 0, max: 1000000, grupo: 'Rankings',
    rotulo: 'Pontos mínimos para o Top Geral', ajuda: 'Quem tem menos que isso não aparece no Top Geral.',
  },
  'ranking.tamanho': { padrao: 50, min: 3, max: 500, grupo: 'Rankings', rotulo: 'Pessoas por ranking' },

  'periodo.inicioSemanaDia': {
    padrao: 1, min: 0, max: 6, grupo: 'Prazos de reset',
    rotulo: 'Dia em que o Top da Semana zera', ajuda: '0 = domingo, 1 = segunda ... 6 = sábado.',
  },
  'periodo.inicioSemanaHora': {
    padrao: 0, min: 0, max: 23, grupo: 'Prazos de reset',
    rotulo: 'Hora em que o Top da Semana zera', ajuda: 'Hora local, de 0 a 23.',
  },
  'periodo.fusoHorarioMinutos': {
    padrao: -180, min: -720, max: 840, grupo: 'Prazos de reset',
    rotulo: 'Fuso horário (minutos em relação ao UTC)', ajuda: '-180 = Brasília. Vale para a virada do dia e da semana.',
  },

  'texto.tituloMax': { padrao: 120, min: 10, max: 300, grupo: 'Textos', rotulo: 'Tamanho máximo do título' },
  'texto.descricaoMax': { padrao: 500, min: 0, max: 5000, grupo: 'Textos', rotulo: 'Tamanho máximo da descrição' },
  'texto.comentarioMax': { padrao: 1000, min: 20, max: 10000, grupo: 'Textos', rotulo: 'Tamanho máximo do comentário' },
};

export const CHAVES = Object.keys(ESQUEMA);

/** { 'pontos.curtir': 1 } → { pontos: { curtir: 1 } } */
function montar(plano) {
  const out = {};
  for (const [chave, valor] of Object.entries(plano)) {
    const [grupo, nome] = chave.split('.');
    (out[grupo] ??= {})[nome] = valor;
  }
  return out;
}

/** { pontos: { curtir: 1 } } → { 'pontos.curtir': 1 } */
export function achatar(obj) {
  const out = {};
  for (const [grupo, valores] of Object.entries(obj ?? {})) {
    if (!valores || typeof valores !== 'object' || Array.isArray(valores)) continue;
    for (const [nome, v] of Object.entries(valores)) out[`${grupo}.${nome}`] = v;
  }
  return out;
}

const PADRAO_PLANO = Object.fromEntries(CHAVES.map((k) => [k, ESQUEMA[k].padrao]));
export const PADRAO = montar(PADRAO_PLANO);

/** Confere um valor contra o esquema. Devolve { ok: true, valor } ou { ok: false, erro }. */
export function validar(chave, valor) {
  const def = ESQUEMA[chave];
  if (!def) return { ok: false, erro: `Regra desconhecida: ${chave}.` };
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  if (typeof n !== 'number' || !Number.isInteger(n)) return { ok: false, erro: `${def.rotulo}: use um número inteiro.` };
  if (n < def.min || n > def.max) return { ok: false, erro: `${def.rotulo}: use um valor entre ${def.min} e ${def.max}.` };
  return { ok: true, valor: n };
}

function soValidos(plano, origem) {
  const out = {};
  for (const [k, v] of Object.entries(plano)) {
    const r = validar(k, v);
    if (r.ok) out[k] = r.valor;
    else console.error(`[regras] ${origem}: ${r.erro} Usando o valor anterior.`);
  }
  return out;
}

/**
 * Cria o leitor de regras.
 * @param {object} opcoes
 * @param {string} [opcoes.arquivo] caminho do config/regras.json
 * @param {import('node:sqlite').DatabaseSync} [opcoes.db] banco com a tabela regras_override (tela de admin)
 * @param {object} [opcoes.extra] valores por cima do padrão (usado nos testes)
 */
export function criarLeitorRegras({ arquivo, db, extra } = {}) {
  const base = { ...PADRAO_PLANO, ...soValidos(achatar(extra), 'extra') };
  let cache = { mtime: -1, valor: {} };

  function doArquivo() {
    if (!arquivo) return {};
    let mtime;
    try {
      mtime = statSync(arquivo).mtimeMs;
    } catch {
      return {};
    }
    if (mtime !== cache.mtime) {
      try {
        cache = { mtime, valor: soValidos(achatar(JSON.parse(readFileSync(arquivo, 'utf8'))), arquivo) };
      } catch (e) {
        console.error(`[regras] arquivo inválido (${arquivo}): ${e.message}. Mantendo a última versão válida.`);
        cache = { ...cache, mtime };
      }
    }
    return cache.valor;
  }

  function doBanco() {
    if (!db) return {};
    return soValidos(
      Object.fromEntries(db.prepare('SELECT chave, valor FROM regras_override').all().map((l) => [l.chave, l.valor])),
      'tela de admin',
    );
  }

  /** Regras em vigor, no formato { pontos: {...}, limites: {...}, ... }. */
  function regras() {
    return montar({ ...base, ...doArquivo(), ...doBanco() });
  }

  /** Cada regra com o valor em vigor e de onde ele veio (padrao, arquivo ou admin). */
  regras.detalhe = function detalhe() {
    const arq = doArquivo();
    const banco = doBanco();
    return CHAVES.map((chave) => {
      const def = ESQUEMA[chave];
      return {
        chave,
        valor: banco[chave] ?? arq[chave] ?? base[chave],
        origem: chave in banco ? 'admin' : chave in arq ? 'arquivo' : 'padrao',
        padrao: base[chave],
        arquivo: arq[chave] ?? null,
        min: def.min,
        max: def.max,
        rotulo: def.rotulo,
        ajuda: def.ajuda ?? null,
        grupo: def.grupo,
      };
    });
  };

  return regras;
}
