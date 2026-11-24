# EngajaDev: backend

API do EngajaDev: contas, posts, curtidas, comentários, pontos, rankings, carteira e prêmios. Node.js + Express + SQLite nativo do Node (`node:sqlite`), sem banco externo para instalar.

## Requisitos

- Node.js 22.13 ou mais novo

## Como rodar

```bash
cd backend
npm install
cp .env.example .env   # opcional: os valores padrão já funcionam
npm start              # API em http://localhost:4400
```

`npm run dev` reinicia sozinho quando um arquivo muda. O banco é criado em `data/engajadev.db` (fora do git).

Para ter dados de exemplo (6 pessoas, 8 posts, curtidas, comentários e 4 prêmios) num banco vazio: `DB_PATH=./data/exemplo.db npm run semear`. As contas de exemplo usam a senha `senha-forte-123`.

## Testes

```bash
npm test
```

## Configuração (.env)

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `4400` | Porta da API |
| `DB_PATH` | `./data/engajadev.db` | Arquivo do banco SQLite |
| `NODE_ENV` | `development` | Em `production` o cookie sai com `Secure` (só HTTPS) |
| `REGRAS_PATH` | `./config/regras.json` | Arquivo com as regras do jogo |
| `ADMIN_EMAILS` | vazio | E-mails de quem administra, separados por vírgula. Só essas pessoas mudam as regras pela tela de admin |
| `TRUST_PROXY` | desligado | Número de proxies na frente da API (ex.: `1`), para os limites por IP (login e contas novas) verem o IP real. **Configure sempre que houver proxy** (nginx, Render, Railway...): sem isso todo mundo parece vir do mesmo IP e o limite vale para o site inteiro |

## Rotas

Todas recebem e devolvem JSON. Em erro, a resposta é `{ "erro": "mensagem em português", "campo": "..." }` (o `campo` só aparece quando o erro é de um campo do formulário).

| Método | Rota | O que faz |
| --- | --- | --- |
| `POST` | `/api/auth/cadastro` | Cria a conta (`nome`, `usuario`, `email`, `senha`) e já entra. `201` |
| `POST` | `/api/auth/entrar` | Entra com `email` e `senha`. `200` |
| `POST` | `/api/auth/sair` | Encerra a sessão. `204` |
| `GET` | `/api/auth/eu` | Devolve quem está conectado, ou `401` |
| `GET` | `/api/posts` | Feed, do mais novo para o mais antigo. Filtros: `rede`, `antes` (página), `limite` |
| `POST` | `/api/posts` | Publica um link (`url`, `titulo`, `descricao`). A rede é descoberta pelo endereço |
| `GET` | `/api/posts/:id` | Um post com os comentários |
| `POST` | `/api/posts/:id/curtida` | Curte. Devolve os pontos ganhos |
| `DELETE` | `/api/posts/:id/curtida` | Descurte e devolve os pontos daquela curtida |
| `POST` | `/api/posts/:id/comentarios` | Comenta (`texto`). Devolve os pontos ganhos |
| `DELETE` | `/api/posts/:id` | Remove o post. O autor apaga o próprio post (os pontos ficam). O admin remove qualquer post (o autor perde os pontos ganhos com ele). Nos dois casos o link não pode ser divulgado de novo |
| `GET` | `/api/rankings?periodo=semana\|geral&tipo=engajador\|criador` | Top da Semana (zera toda segunda 00:00 de Brasília) ou Top Geral (só quem tem 10 pontos ou mais) |
| `GET` | `/api/carteira` | Carteira de pontos de prêmio: saldo de sempre, pontos da semana e de hoje, e extrato |
| `GET` | `/api/usuarios/:usuario` | Perfil público: posts, pontos e posição nos rankings (sem e-mail) |
| `GET` | `/api/regras` | Regras em vigor (pública, usada na tela "Como pontuar") |
| `GET` | `/api/admin/regras` | Cada regra com valor, faixa e de onde veio. Só admin |
| `PUT` | `/api/admin/regras` | Muda regras: `{ "pontos.curtir": 2 }`. `null` volta ao arquivo ou ao padrão. Só admin |
| `GET` | `/api/premios` | Catálogo de prêmios ativos (público) |
| `POST` | `/api/premios/:id/resgatar` | Troca pontos da carteira por um prêmio. Destaque pede `postId` (post seu) |
| `GET` | `/api/admin/premios` | Todos os prêmios, inclusive desativados. Só admin |
| `POST` | `/api/admin/premios` | Cria prêmio (`nome`, `descricao`, `custo`, `estoque`, `tipo`, `diasDestaque`, `ativo`). Só admin |
| `PUT` | `/api/admin/premios/:id` | Edita ou desativa um prêmio. Só admin |
| `GET` | `/api/admin/resgates?status=pendente` | Resgates, com o e-mail de quem resgatou para combinar a entrega. Só admin |
| `PUT` | `/api/admin/resgates/:id` | Marca `{ "status": "entregue" }` ou `"cancelado"` (devolve pontos e estoque). Só admin |

## Prêmios (2ª fase)

- O admin monta o catálogo: **brindes** (entregues pela organização) e **destaque** (o post da pessoa fica no topo do feed por alguns dias).
- Resgatar desconta da carteira na hora: `saldo = tudo o que ganhou − resgates não cancelados`. Resgatar **não** muda rankings, perfil nem o limite de pontos de hoje.
- Brinde fica `pendente` até o admin marcar `entregue`. Cancelar devolve os pontos e o estoque uma vez só.
- Saldo, estoque e resgate são conferidos e gravados juntos, então não dá para gastar os mesmos pontos duas vezes.
- O feed traz os posts em destaque à parte (`destaques`), só na primeira página.

## Tudo configurável

Pontos por ação, limites diários, cooldown, limiar do Top Geral e virada da semana ficam em [`config/regras.json`](config/regras.json). Basta mudar o arquivo: vale na próxima ação, sem reiniciar e sem mexer no código. Quem está em `ADMIN_EMAILS` também pode mudar tudo pela tela de admin, que grava no banco e vale por cima do arquivo.

Ordem de prioridade: **tela de admin > arquivo > padrão do código**. Valor fora da faixa é recusado com uma mensagem clara.

## Regras contra trapaça (anti-gaming)

Valores padrão (todos mudam no arquivo de regras ou na tela de admin):


- **Limite diário de pontos:** até 30 pontos por dia como engajador e 60 como criador. Passou do limite, a ação acontece, mas não pontua.
- **Cooldown:** 10 segundos entre duas curtidas ou comentários da mesma pessoa (`429` com o tempo que falta).
- **Comentar vale mais que curtir:** 3 contra 1 para quem engaja, 2 contra 1 para o autor.
- **Sem pontos no próprio post.**
- **Comentário com menos de 20 caracteres** é publicado, mas não pontua. Só o primeiro comentário da pessoa em cada post pontua.
- **Curtida pontua uma vez só:** descurtir devolve os pontos, e curtir de novo não soma de novo.
- **Até 5 posts por dia.**
- **Até 10 contas novas por IP por hora**, para ninguém criar contas falsas em série e usá-las para pontuar os próprios posts. Passou disso, o cadastro responde `429` com o tempo de espera.

O dia vira à meia-noite de Brasília.

## Segurança

- Senha com hash **scrypt** (N=2^15, r=8, p=3, parâmetros da OWASP) e sal aleatório. A senha nunca sai do servidor.
- Sessão por cookie `httpOnly` e `SameSite=Lax`, válida por 30 dias. No banco fica só o hash do token.
- Limite de tentativas de login: 5 erros por e-mail ou 50 por IP em 15 minutos bloqueiam até a janela acabar (`429`).
- E-mail inexistente e senha errada dão a mesma resposta, no mesmo tempo, para não revelar quem tem conta.
- Pedido que muda dados (POST, PUT, DELETE) vindo de outro site é recusado com `403`. O navegador informa a origem no cabeçalho `Sec-Fetch-Site`. Isso protege contra CSRF, e a tela continua funcionando porque fica no mesmo endereço da API.
- Toda resposta da API sai com `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` e uma `Content-Security-Policy` que não deixa a API abrir dentro de outro site.
