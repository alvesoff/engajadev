/**
 * Preenche um banco vazio com dados de exemplo (pessoas, posts, curtidas, comentários e prêmios),
 * para ver as telas com conteúdo. Uso: npm run semear
 * Todas as contas de exemplo usam a senha "senha-forte-123".
 * Não roda se o banco já tiver contas (para não misturar com dados reais).
 */
import { abrirBanco, transacao } from './db.js';
import { gerarHash } from './senha.js';
import { criarLeitorRegras } from './regras.js';
import { analisarLink } from './redes.js';
import { pontuarCurtida, pontuarComentario, pontuarPublicacao } from './pontos.js';

const HORA = 3_600_000;
const DIA = 24 * HORA;

const PESSOAS = [
  ['Ana Souza', 'ana_dev'],
  ['Bruno Lima', 'brunolima'],
  ['Carla Mendes', 'carla_codes'],
  ['Diego Rocha', 'diegorocha'],
  ['Elisa Prado', 'elisa_front'],
  ['Fábio Nunes', 'fabio_ops'],
];

// [autor, link, título, descrição, horas atrás]
const POSTS = [
  [0, 'https://www.linkedin.com/posts/ana-souza_react-hooks', 'Hooks do React sem mistério', 'Um resumo prático de useEffect, useMemo e useCallback, com os erros que eu mais vejo em code review.', 10 * 24],
  [1, 'https://dev.to/brunolima/sqlite-no-node-22', 'SQLite nativo no Node 22: vale a pena?', 'Testei o node:sqlite num projeto pequeno. Spoiler: para começar, é ótimo.', 9 * 24],
  [2, 'https://www.youtube.com/watch?v=css-grid-na-pratica', 'CSS Grid na prática em 12 minutos', 'Vídeo curto montando um layout de dashboard do zero.', 8 * 24],
  [3, 'https://medium.com/@diegorocha/docker-compose-para-iniciantes', 'Docker Compose para quem está começando', '', 40],
  [4, 'https://www.instagram.com/p/acessibilidade-em-formularios', 'Carrossel: 7 dicas de acessibilidade em formulários', 'Label, mensagens de erro, foco visível e mais.', 30],
  [0, 'https://github.com/ana-souza/meu-primeiro-cli', 'Meu primeiro CLI em Node, com testes', 'Repositório comentado, bom para quem quer aprender node:test.', 20],
  [5, 'https://x.com/fabio_ops/status/1890000000000000000', 'Fio: 10 comandos de terminal que eu uso todo dia', '', 12],
  [2, 'https://www.tabnews.com.br/carla/como-estudei-typescript', 'Como estudei TypeScript em 30 dias', 'O plano que eu segui, semana a semana, e o que eu faria diferente.', 6],
];

const COMENTARIOS = [
  'Muito bom! Salvei para ler com calma no fim de semana.',
  'Excelente explicação, finalmente entendi esse assunto.',
  'Eu passei exatamente por isso semana passada. Valeu por compartilhar!',
  'Ótimo conteúdo. Você pretende fazer uma parte 2?',
  'Direto ao ponto. Mandei para o time inteiro.',
];

// Catálogo de exemplo: [nome, descrição, custo, estoque (null = sem limite), tipo, dias de destaque]
const PREMIOS = [
  ['Adesivos EngajaDev', 'Kit com 5 adesivos para o notebook.', 15, null, 'brinde', null],
  ['Post em destaque por 3 dias', 'Seu post fica no topo do feed por 3 dias.', 25, null, 'destaque', 3],
  ['Camiseta EngajaDev', 'Camiseta da comunidade. A organização combina tamanho e entrega por e-mail.', 120, 10, 'brinde', null],
  ['Mentoria de 30 minutos', 'Conversa com alguém experiente da comunidade sobre carreira ou código.', 200, 3, 'brinde', null],
];

// [quem, post, tipo, horas depois do post]
const ACOES = [
  [1, 0, 'comentar', 2], [2, 0, 'curtir', 3], [3, 0, 'comentar', 5], [4, 0, 'curtir', 6], [5, 0, 'comentar', 8],
  [0, 1, 'comentar', 1], [2, 1, 'comentar', 4], [3, 1, 'curtir', 4],
  [0, 2, 'curtir', 2], [1, 2, 'comentar', 3], [4, 2, 'comentar', 5], [5, 2, 'curtir', 6],
  [0, 3, 'comentar', 1], [1, 3, 'curtir', 2], [4, 3, 'curtir', 3], [2, 3, 'comentar', 4],
  [0, 4, 'comentar', 2], [1, 4, 'comentar', 3], [2, 4, 'curtir', 4], [3, 4, 'comentar', 5], [5, 4, 'curtir', 6],
  [1, 5, 'comentar', 1], [2, 5, 'curtir', 2], [4, 5, 'comentar', 3], [3, 5, 'curtir', 4],
  [0, 6, 'curtir', 1], [4, 6, 'comentar', 2], [2, 6, 'curtir', 3],
  [0, 7, 'comentar', 1], [4, 7, 'curtir', 2], [5, 7, 'comentar', 3],
];

export async function semear(db, { agora = Date.now() } = {}) {
  if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n > 0) {
    throw new Error('O banco já tem contas. Use um banco vazio (ex.: DB_PATH=./data/exemplo.db npm run semear).');
  }
  const senha = await gerarHash('senha-forte-123');
  let relogio = agora;
  const ctx = { db, agora: () => relogio, regras: criarLeitorRegras() };

  transacao(db, () => {
    const ids = PESSOAS.map(([nome, usuario], i) => {
      const criado = agora - (30 - i) * DIA;
      return Number(
        db
          .prepare('INSERT INTO usuarios (nome, usuario, email, senha_hash, criado_em) VALUES (?, ?, ?, ?, ?)')
          .run(nome, usuario, `${usuario.replace(/_/g, '')}@exemplo.com`, senha, criado).lastInsertRowid,
      );
    });

    const posts = POSTS.map(([autor, url, titulo, descricao, horas]) => {
      relogio = agora - horas * HORA;
      const link = analisarLink(url);
      const id = Number(
        db
          .prepare('INSERT INTO posts (usuario_id, url, titulo, descricao, rede, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
          .run(ids[autor], link.url, titulo, descricao, link.rede, relogio).lastInsertRowid,
      );
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
      pontuarPublicacao(ctx, { post });
      return post;
    });

    for (const [nome, descricao, custo, estoque, tipo, dias] of PREMIOS) {
      db.prepare(
        `INSERT INTO premios (nome, descricao, custo, estoque, tipo, dias_destaque, ativo, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      ).run(nome, descricao, custo, estoque, tipo, dias, agora - 30 * DIA);
    }

    ACOES.forEach(([quem, p, tipo, depois], i) => {
      const post = posts[p];
      relogio = Math.min(agora - 10 * 60_000, post.criado_em + depois * HORA);
      if (tipo === 'curtir') {
        const id = db
          .prepare('INSERT INTO curtidas (post_id, usuario_id, ativa, criado_em) VALUES (?, ?, 1, ?)')
          .run(post.id, ids[quem], relogio).lastInsertRowid;
        pontuarCurtida(ctx, { curtida: db.prepare('SELECT * FROM curtidas WHERE id = ?').get(id), post });
      } else {
        const texto = COMENTARIOS[i % COMENTARIOS.length];
        const id = db
          .prepare('INSERT INTO comentarios (post_id, usuario_id, texto, criado_em) VALUES (?, ?, ?, ?)')
          .run(post.id, ids[quem], texto, relogio).lastInsertRowid;
        pontuarComentario(ctx, { comentario: db.prepare('SELECT * FROM comentarios WHERE id = ?').get(id), post });
      }
    });
  });
  return { pessoas: PESSOAS.length, posts: POSTS.length, acoes: ACOES.length, premios: PREMIOS.length };
}

// Rodando direto pelo terminal (npm run semear)
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const db = abrirBanco(process.env.DB_PATH || './data/engajadev.db');
  semear(db)
    .then((r) => {
      console.log(`Pronto: ${r.pessoas} pessoas, ${r.posts} posts, ${r.acoes} curtidas/comentários e ${r.premios} prêmios de exemplo.`);
      console.log('Entre com qualquer conta, por exemplo anadev@exemplo.com, senha: senha-forte-123');
    })
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
