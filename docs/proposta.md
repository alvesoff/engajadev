# Proposta: estrutura e telas do EngajaDev

O que foi entregue está explicado em [o-que-foi-feito.md](o-que-foi-feito.md).

Este documento mostra como o EngajaDev vai ser montado: as pastas, as tabelas do banco, as rotas da API e as telas. Ele parte da visão do [README](../README.md) e das [discussões](https://github.com/alvesoff/engajadev/discussions). É uma proposta: a comunidade pode mudar qualquer parte.

## A ideia em uma linha

**Entrar → postar o link → engajar → ganhar pontos → subir no ranking.**

## Onde o engajamento acontece

A [discussão sobre confirmar o engajamento](https://github.com/alvesoff/engajadev/discussions/2) mostra o problema: as redes não contam para sistemas de fora quem curtiu ou comentou. Por isso a proposta segue o **caminho 1** da discussão: o membro divulga o link no EngajaDev, e as curtidas e os comentários que valem ponto acontecem **aqui dentro**, como no Hacker News e no Lobsters.

- O sistema registra cada ação, então o ponto é confiável.
- Ninguém é recompensado por curtir no LinkedIn ou no YouTube, o que evita problema com as regras das redes.
- O link continua levando ao post original. Quem quiser apoiar lá também, apoia.

## Stack

A [votação da stack](https://github.com/alvesoff/engajadev/discussions/1) ainda está aberta. Até ela fechar, usamos uma stack simples, que roda sem instalar nada além do Node:

- **Backend:** Node.js 22.13+ com Express, em JavaScript.
- **Banco:** SQLite nativo do Node (`node:sqlite`). Trocar por PostgreSQL depois é simples.
- **Frontend:** React com Vite.
- **Testes:** `node:test`, que já vem no Node.

## Pastas

Backend e frontend ficam separados. Cada um tem o seu `package.json` e o seu README.

```
backend/
  src/
    app.js        monta a API
    db.js         cria as tabelas
    rotas/        uma rota por assunto (auth, posts, rankings...)
  test/           testes automáticos da API
frontend/
  src/            telas em React
docs/
  proposta.md     este documento
```

## Regras de pontos (valores iniciais, todos configuráveis)

| Ação | Quem ganha | Pontos |
| --- | --- | --- |
| Curtir o post de outra pessoa | quem curtiu | 1 |
| Comentar o post de outra pessoa | quem comentou | 3 |
| Receber uma curtida | autor do post | 1 |
| Receber um comentário | autor do post | 2 |

Comentar vale mais que curtir porque dá mais trabalho e ajuda mais o autor.

**Rankings:**

- **Top da Semana:** dois placares, **Engajador** (quem mais apoia) e **Criador** (quem mais recebe apoio). Zera toda semana. O dia e a hora da virada são configuráveis.
- **Top Geral:** soma de sempre. Só aparece quem tem **10 pontos ou mais** (número configurável).

**Carteira de pontos de prêmio:** separada do ranking. Quando a semana vira, o ranking volta a zero, mas a carteira guarda tudo. Quem é novo compete de igual para igual na semana, e quem é antigo não perde o que juntou.

**Contra trapaça:**

- Limite de pontos por dia: passou do limite, a ação acontece, mas não pontua.
- Tempo mínimo entre duas ações da mesma pessoa.
- Curtir ou comentar o próprio post não pontua.
- A curtida pontua uma vez só: descurtir e curtir de novo não soma de novo.
- Comentário muito curto não pontua.

**Tudo configurável:** pontos por ação, limites por dia, tempo entre ações, limiar do Top Geral e virada da semana ficam num arquivo de regras, sem precisar mudar o código.

## Tabelas

| Tabela | O que guarda |
| --- | --- |
| `usuarios` | nome, @usuário, e-mail, hash da senha, data de criação. **Já existe.** |
| `sessoes` | hash do token da sessão, de quem é e quando vence. **Já existe.** |
| `posts` | quem postou, link, título, descrição, rede (LinkedIn, YouTube...), data |
| `curtidas` | quem curtiu qual post, se ainda está ativa e se já pontuou |
| `comentarios` | quem comentou, em qual post, o texto e a data |
| `lancamentos` | cada ponto ganho: de quem, quantos, por qual ação, como engajador ou criador, e quando |

Os rankings e a carteira são somas da tabela `lancamentos`. Nada é apagado na virada da semana: o ranking só olha para os lançamentos da semana atual.

## Rotas da API

| Método | Rota | O que faz | Situação |
| --- | --- | --- | --- |
| POST | `/api/auth/cadastro` | cria a conta e já entra | **pronta** |
| POST | `/api/auth/entrar` | entra com e-mail e senha | **pronta** |
| POST | `/api/auth/sair` | sai | **pronta** |
| GET | `/api/auth/eu` | diz quem está conectado | **pronta** |
| GET | `/api/posts` | feed, do mais novo para o mais antigo | **pronta** |
| POST | `/api/posts` | publica um link | **pronta** |
| GET | `/api/posts/:id` | um post com os comentários | **pronta** |
| POST / DELETE | `/api/posts/:id/curtida` | curte e descurte | **pronta** |
| POST | `/api/posts/:id/comentarios` | comenta | **pronta** |
| GET | `/api/rankings?periodo=semana\|geral&tipo=engajador\|criador` | rankings | **pronta** |
| GET | `/api/carteira` | saldo e extrato de pontos | **pronta** |
| GET | `/api/usuarios/:usuario` | perfil público | **pronta** |
| GET | `/api/regras` | regras de pontos em vigor | **pronta** |

## Telas

Todas funcionam no celular e no computador. No celular, um menu fixo embaixo. No computador, um menu no topo e o Top da Semana ao lado.

| Tela | O que mostra | Situação |
| --- | --- | --- |
| **Entrar / Criar conta** | formulário com as duas opções | **pronta** |
| **Olá** | página simples depois de entrar, com o botão Sair | virou o Feed, que agora diz "Olá, <nome>" |
| **Feed** | posts da comunidade, com rede, título, autor, curtidas e comentários | **pronta** |
| **Postar** | link, título e descrição | **pronta** |
| **Post** | o post, o botão para abrir o original, curtir e comentar, e os pontos ganhos | **pronta** |
| **Rankings** | Top da Semana (Engajador e Criador) e Top Geral | **pronta** |
| **Carteira** | saldo de pontos, pontos de hoje e extrato | **pronta** |
| **Perfil público** | nome, @usuário, posts, pontos e posição no ranking | **pronta** |
| **Como pontuar** | as regras de pontos em vigor | **pronta** |

## Ordem de entrega

- Login (backend e tela). **Feito.**
- Esta proposta. **Feito.**
- Núcleo do backend: postar link, feed, curtir, comentar e o motor de pontos. **Feito.**
- Rankings: Top da Semana e Top Geral. **Feito.**
- Carteira de pontos. **Feito.**
- Contra trapaça. **Feito.**
- Perfil público. **Feito.**
- Regras configuráveis. **Feito.**
- Telas de tudo acima. **Feito.**

Em cada passo, o backend vem antes da tela.

## Fica para depois

- ~~Catálogo e resgate de prêmios.~~ **Feito na 2ª fase** (veja [o-que-foi-feito.md](o-que-foi-feito.md)).
- Recuperar senha por e-mail e entrar com Google ou GitHub.
- Moderação (denunciar e apagar posts e comentários).
- Integração com as APIs das redes.
