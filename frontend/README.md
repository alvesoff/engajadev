# EngajaDev: frontend

As telas do EngajaDev, em React + Vite. Funcionam no celular (menu fixo embaixo) e no computador (menu no topo e o Top da Semana numa coluna ao lado).

## Como rodar

O backend precisa estar rodando (veja `../backend/README.md`).

```bash
cd frontend
npm install
npm run dev        # telas em http://localhost:5400
```

O Vite repassa as chamadas de `/api` para o backend em `http://localhost:4400`. Assim a tela e a API ficam no mesmo endereço e o cookie de sessão funciona sem configurar CORS.

Para ver as telas com conteúdo, rode antes no backend `DB_PATH=./data/exemplo.db npm run semear` e suba o backend com esse mesmo `DB_PATH`. Todas as contas de exemplo usam a senha `senha-forte-123` (ex.: `anadev@exemplo.com`).

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `ENGAJADEV_API` | `http://localhost:4400` | Endereço do backend |
| `WEB_PORT` | `5400` | Porta da tela |

## Telas

| Endereço | Tela |
| --- | --- |
| `/entrar` | Entrar e criar conta |
| `/` | Feed, com filtro por rede e os posts em destaque no topo |
| `/postar` | Divulgar um post (mostra a rede descoberta pelo link) |
| `/p/:id` | Post: abrir o original, curtir e comentar, com o aviso dos pontos ganhos |
| `/rankings` | Top Engajador e Top Criador, da semana e geral |
| `/conta` | Minha conta: dados, trocar senha e sair dos outros aparelhos |
| `/carteira` | Saldo de pontos, limite de hoje, meus resgates e extrato |
| `/u/:usuario` | Perfil público: posts, pontos e posição |
| `/como-pontuar` | Regras em vigor, lidas do backend |
| `/admin/regras` | Mudar as regras (só para quem está em `ADMIN_EMAILS` no backend) |
| `/premios` | Catálogo de prêmios: trocar pontos da carteira por brindes ou por destaque do próprio post |
| `/admin/denuncias` | Fila de posts denunciados: manter ou remover (só admin) |
| `/admin/premios` | Montar o catálogo e marcar resgates como entregues ou cancelados (só admin) |

## Build

```bash
npm run build      # gera frontend/dist
npm run preview    # serve o build em http://localhost:5400
```
