# EngajaDev: backend

API de contas do EngajaDev: cadastro, entrar, sair e "quem sou eu". Node.js + Express + SQLite nativo do Node (`node:sqlite`), sem banco externo para instalar.

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
| `TRUST_PROXY` | desligado | Número de proxies na frente da API (ex.: `1`), para o limite por IP ver o IP real |

## Rotas

Todas recebem e devolvem JSON. Em erro, a resposta é `{ "erro": "mensagem em português", "campo": "..." }` (o `campo` só aparece quando o erro é de um campo do formulário).

| Método | Rota | O que faz |
| --- | --- | --- |
| `POST` | `/api/auth/cadastro` | Cria a conta (`nome`, `usuario`, `email`, `senha`) e já entra. `201` |
| `POST` | `/api/auth/entrar` | Entra com `email` e `senha`. `200` |
| `POST` | `/api/auth/sair` | Encerra a sessão. `204` |
| `GET` | `/api/auth/eu` | Devolve quem está conectado, ou `401` |

## Segurança

- Senha com hash **scrypt** (N=2^15, r=8, p=3, parâmetros da OWASP) e sal aleatório. A senha nunca sai do servidor.
- Sessão por cookie `httpOnly` e `SameSite=Lax`, válida por 30 dias. No banco fica só o hash do token.
- Limite de tentativas de login: 5 erros por e-mail ou 50 por IP em 15 minutos bloqueiam até a janela acabar (`429`).
- E-mail inexistente e senha errada dão a mesma resposta, no mesmo tempo, para não revelar quem tem conta.
