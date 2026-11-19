# O que foi feito

Este documento explica, em linguagem simples, o que o EngajaDev já faz, como cada parte funciona e quais decisões tomamos no caminho. A proposta original está em [proposta.md](proposta.md).

## Em uma frase

Uma pessoa entra, divulga o link do seu post de tecnologia, a comunidade curte e comenta **dentro do EngajaDev**, cada ação vira pontos, os pontos aparecem nos rankings e na carteira, e a carteira pode ser trocada por prêmios.

## Como rodar

São duas pastas separadas. O backend sobe primeiro.

```bash
# backend (API) em http://localhost:4400
cd backend
npm install
npm test                                  # 124 testes automáticos
DB_PATH=./data/exemplo.db npm run semear  # opcional: dados de exemplo
DB_PATH=./data/exemplo.db ADMIN_EMAILS=anadev@exemplo.com npm start

# frontend (telas) em http://localhost:5400
cd frontend
npm install
npm run dev
```

As contas de exemplo usam a senha `senha-forte-123`. Com o comando acima, `anadev@exemplo.com` entra como admin.

## O que cada parte faz

### Login

- Cadastro com nome, @usuário, e-mail e senha. Entrar, sair e "quem sou eu".
- A senha é guardada com **scrypt** (um embaralhamento forte, que não tem volta). A senha nunca sai do servidor.
- A sessão fica num cookie que o JavaScript da página não consegue ler (`httpOnly`). No banco fica só um código derivado do token, nunca o token.
- Depois de 5 senhas erradas para o mesmo e-mail, o login dele fica bloqueado por 15 minutos.
- Todas as mensagens de erro estão em português e apontam o campo errado.

### Postar e feed

- A pessoa cola o link, dá um título e, se quiser, uma descrição.
- O sistema descobre a rede pelo endereço: LinkedIn, Instagram, Dev.to, X, YouTube, Medium, GitHub, TabNews ou "Blog" para o resto.
- O mesmo link não entra duas vezes.
- O feed mostra os posts do mais novo para o mais antigo, com filtro por rede e botão "Carregar mais".

### Curtir, comentar e o motor de pontos

| Ação | Quem ganha | Pontos |
| --- | --- | --- |
| Curtir o post de outra pessoa | quem curtiu | 1 |
| Comentar o post de outra pessoa | quem comentou | 3 |
| Receber uma curtida | autor do post | 1 |
| Receber um comentário | autor do post | 2 |

- Cada ponto ganho vira uma linha numa tabela própria, o **livro-razão** (`lancamentos`). Funciona como um extrato de banco: rankings e carteira são somas dessa tabela.
- Descurtir apaga os pontos daquela curtida. Curtir de novo não soma de novo.
- Depois de cada ação, a tela avisa quantos pontos a pessoa ganhou e, quando não ganhou, explica o motivo.

### Rankings

- **Top Engajador:** quem mais apoia (pontos de curtir e comentar).
- **Top Criador:** quem mais recebe apoio (pontos recebidos nos próprios posts).
- Cada um tem duas janelas:
  - **Top da Semana:** soma só os pontos da semana atual. Vira toda **segunda-feira à meia-noite de Brasília**. Nada é apagado: a janela de tempo só anda.
  - **Top Geral:** soma de sempre, mas **só lista quem tem 10 pontos ou mais**.
- Empate: fica na frente quem chegou primeiro aos pontos.

### Carteira de pontos

- Guarda **todos** os pontos que a pessoa já ganhou. São os pontos que vão virar prêmios.
- **Não zera** quando a semana vira. Assim quem é novo compete de igual para igual na semana, e quem é antigo não perde o que juntou.
- Mostra o saldo, quanto veio de apoiar e quanto veio de criar, os pontos da semana, o limite de hoje (com barra) e o extrato.

### Contra trapaça (anti-gaming)

- **Limite diário:** até 30 pontos por dia apoiando e 60 recebendo. Passou do limite, a ação acontece (a curtida aparece no post), só não pontua.
- **Espera entre ações:** 10 segundos entre uma curtida ou comentário e o próximo.
- **Comentar vale mais que curtir:** 3 contra 1.
- **Sem pontos no próprio post.**
- **Comentário curto** (menos de 20 letras, como "Top!") é publicado, mas não pontua.
- **Só o primeiro comentário** da pessoa em cada post pontua.
- **Até 5 posts por dia** por pessoa.

### Perfil público

- Endereço `/u/<usuário>`, aberto para qualquer pessoa, mesmo sem conta.
- Mostra os posts, o total de pontos, os pontos da semana, quantas curtidas e comentários a pessoa fez e a posição dela em cada ranking.
- O e-mail nunca aparece.

### Tudo configurável

- Todas as regras ficam no arquivo `backend/config/regras.json`: pontos por ação, limites por dia, espera entre ações, tamanho mínimo do comentário, posts por dia, limiar do Top Geral, dia e hora da virada da semana e fuso horário.
- Mudou o arquivo, vale **na próxima ação**, sem reiniciar e sem mexer no código.
- Quem está em `ADMIN_EMAILS` também muda tudo pela **tela de admin** (`/admin/regras`), que grava no banco e vale por cima do arquivo. "Restaurar" volta ao valor do arquivo.
- Valor fora da faixa (ex.: pontos negativos) é recusado com mensagem clara, e nada é salvo.
- A página **Como pontuar** mostra as regras em vigor, lidas do backend, então está sempre certa.

### Prêmios (2ª fase)

- Quem administra monta o **catálogo** em `/admin/premios`. São dois tipos de prêmio:
  - **brinde**, que a organização entrega (adesivos, camiseta, mentoria...);
  - **destaque**, que deixa o post da pessoa no topo do feed por alguns dias.
- Cada prêmio tem nome, descrição, custo em pontos, unidades (ou "sem limite") e pode sair do catálogo sem ser apagado.
- Na página **Prêmios**, a pessoa vê o saldo, o preço de cada prêmio e quantos pontos faltam. Antes de trocar, ela confirma e vê quanto vai sobrar.
- **Resgatar desconta da carteira na hora.** O saldo é tudo o que a pessoa ganhou menos o que ela já trocou.
- Resgatar **não muda** os rankings, o total que aparece no perfil nem o limite de pontos de hoje. O ranking mede o engajamento; a carteira é o que dá para gastar.
- O sistema confere o saldo, baixa o estoque e grava o resgate num passo só. Assim os mesmos pontos não são gastos duas vezes, mesmo com dois cliques ao mesmo tempo.
- **Brinde:** fica "aguardando entrega" até o admin marcar como entregue. A lista do admin mostra o e-mail de quem resgatou, para combinar a entrega.
- **Cancelar** um resgate devolve os pontos e a unidade ao estoque, uma vez só.
- **Destaque:** a pessoa escolhe um post dela. Ele aparece em "Em destaque" no topo do feed até o prazo acabar e depois sai sozinho.
- A carteira mostra "Meus resgates", com a situação de cada um.

### Telas (celular e computador)

Entrar/criar conta, feed, divulgar post, post (curtir e comentar), rankings, carteira, perfil, como pontuar, prêmios e as telas de admin (regras e prêmios).

- **Celular:** menu fixo embaixo (Feed, Rankings, Postar, Carteira, Perfil), botões grandes para o dedo e campos com letra de 16px (o iPhone não dá zoom sozinho).
- **Computador:** menu no topo, saldo e botão "Postar" sempre à mão e o Top da Semana numa coluna ao lado.
- Funciona no modo escuro do sistema.

## Critério de pronto, item por item

| Critério | Como conferir |
| --- | --- |
| Cadastrar/logar, postar link, curtir e comentar, e os pontos somam certo | Testes `auth`, `nucleo` e `carteira`. Prints `03` a `05` |
| Rankings aparecem e atualizam; o Top da Semana zera; o Top Geral ignora quem tem menos de 10 | Testes `rankings` (virada da semana minuto a minuto e limiar). Com a tela aberta, o ranking e o Top da Semana ao lado se atualizam sozinhos a cada 30 segundos e quando a pessoa volta para a aba. Prints `07` e `08` |
| Pontuação, limites, cooldown e limiar configuráveis sem mexer no código | Testes `configuravel` (arquivo e admin). Print `12` |
| Funciona bem no celular e no desktop | Prints `computador-*` e `celular-*`, todos conferidos sem rolagem para o lado |
| Back-end do núcleo entregue antes do capricho visual | Ordem dos commits: todo o backend primeiro, telas depois |
| Commits granulares + doc do que foi feito | Um commit por etapa (`git log`) e este documento |
| 2ª fase: pontos viram prêmios | Testes `premios` (resgate, saldo, estoque, gasto duplo, cancelamento, destaque que vence). Prints em `prints/telas-premios/` |

## Decisões que tomamos (e por quê)

- **O engajamento que pontua acontece dentro do EngajaDev.** As redes não contam para sistemas de fora quem curtiu ou comentou. Por isso seguimos o caminho 1 da [discussão #2](https://github.com/alvesoff/engajadev/discussions/2): o link leva ao post original, mas a curtida e o comentário que valem ponto são feitos aqui. Assim o ponto é confiável, e ninguém é recompensado por engajar no LinkedIn ou no Instagram, o que essas redes podem tratar como engajamento falso.
- **Duas janelas de ranking (Semana e Geral).** A visão fala em "três janelas", mas só nomeia duas. Ficamos com as duas nomeadas, para não inventar regra. Um "Top do Mês" é fácil de acrescentar depois, porque o ranking é só uma soma sobre um período.
- **Semana virando na segunda 00:00 de Brasília.** É o padrão mais comum. Dia, hora e fuso mudam no arquivo de regras.
- **Valores iniciais** (1 por curtida, 3 por comentário, 30/60 por dia, 10 segundos, 5 posts por dia, 10 pontos no Top Geral) foram escolhidos para começar. Todos mudam no arquivo ou na tela de admin.
- **Quem é admin** é definido pela variável `ADMIN_EMAILS` do backend. É o jeito mais simples, sem precisar de uma tela de permissões agora.
- **Limite diário acabou:** a curtida ou o comentário continua valendo no post, só não pontua. Se quem engajou já bateu o limite, o autor também não ganha. Isso evita usar contas "cheias" só para inflar o post de alguém.
- **Stack:** Node.js + Express + SQLite nativo do Node no backend, React + Vite nas telas. A [votação da stack](https://github.com/alvesoff/engajadev/discussions/1) ainda está aberta. Escolhemos o que roda sem instalar nada além do Node e é fácil para quem está começando. Trocar SQLite por PostgreSQL depois é simples, porque as consultas são SQL comum.
- **Prêmios (2ª fase):**
  - Os resgates ficam numa tabela separada (`resgates`), e não como pontos negativos no livro-razão. Assim trocar pontos nunca derruba ninguém no ranking nem mexe no limite diário.
  - O custo é copiado no resgate: se o preço mudar depois, o histórico não muda.
  - Para brindes físicos, o sistema **não pede endereço** (cuidado com dados pessoais, LGPD). A organização combina a entrega pelo e-mail da conta.
  - O destaque só vale para post próprio, e o mesmo post não pode estar em dois destaques ao mesmo tempo.
- **Fora desta entrega:** bio no perfil, recuperar senha por e-mail e entrar com Google ou GitHub (precisam de um serviço de e-mail ou de chaves dessas contas), moderação (denunciar ou apagar posts) e integração com as APIs das redes (precisa de chaves de cada rede).

## Mapa do código

```
backend/
  config/regras.json   regras do jogo (dá para mudar sem mexer no código)
  src/
    app.js             monta a API e liga as rotas
    db.js              cria as tabelas (usuarios, sessoes, posts, curtidas, comentarios, lancamentos, regras_override, premios, resgates)
    senha.js           hash da senha (scrypt)
    limite.js          limite de tentativas de login
    redes.js           descobre a rede pelo link
    regras.js          lê as regras (padrão < arquivo < tela de admin)
    tempo.js           virada do dia e da semana no fuso certo
    pontos.js          motor de pontos e regras anti-gaming
    rankings.js        Top da Semana e Top Geral
    carteira.js        saldo e extrato
    premios.js         catálogo, resgate, entrega e cancelamento (2ª fase)
    semear.js          dados de exemplo (npm run semear)
    rotas/             auth, posts, rankings, carteira, usuarios, regras, premios
  test/                124 testes automáticos
frontend/
  src/
    App.jsx            menu (embaixo no celular, no topo no computador) e rotas
    sessao.jsx         quem está conectado, saldo e avisos
    paginas/           uma tela por arquivo
    componentes/       card do post, avatar e ícones
docs/
  proposta.md          a proposta de estrutura e telas
  o-que-foi-feito.md   este documento
```
