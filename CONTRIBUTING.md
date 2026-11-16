# Como contribuir com o EngajaDev

Obrigado por querer ajudar. O EngajaDev é construído por membros da comunidade AceleraDev. O repositório é mantido por [alvesoff](https://github.com/alvesoff), que revisa e aprova as contribuições. Ele cuida só deste repositório e não fala pela AceleraDev.

## Formas de contribuir

- **Ideias e decisões de produto:** nas [Discussions](https://github.com/alvesoff/engajadev/discussions).
- **Tarefas e problemas:** nas [Issues](https://github.com/alvesoff/engajadev/issues).
- **Código e documentação:** por Pull Request.

Antes de começar algo grande, abra uma issue ou uma discussão para alinhar a ideia. Isso evita trabalho perdido.

## Fluxo de Pull Request

1. Faça um fork do repositório.
2. Crie uma branch a partir da `main` com um destes prefixos:
   - `feat/` para funcionalidade nova
   - `fix/` para correção
   - `docs/` para documentação
   - `chore/` para manutenção

   Exemplo: `feat/placar-mensal`.
3. Faça commits pequenos, cada um com uma única mudança, no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):

   ```
   feat: adiciona cadastro de link de post
   fix: corrige soma de pontos do placar
   docs: explica como rodar o projeto
   ```

   Evite mensagens genéricas como `update`, `ajustes` ou `fix`.
4. Abra o Pull Request para a `main` e preencha o modelo: o que mudou, por quê e como testar.
5. O mantenedor revisa. Se ele pedir ajustes, faça novos commits na mesma branch.
6. Com o PR aprovado, o mantenedor faz o merge.

## Boas práticas

- Um PR por assunto.
- Vincule a issue no PR (por exemplo, `Closes #12`).
- Seja respeitoso nas revisões e conversas. Vale o [Código de Conduta](CODE_OF_CONDUCT.md).
