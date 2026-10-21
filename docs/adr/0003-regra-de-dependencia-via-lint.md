# ADR 0003: Regra de dependência verificada por lint

- **Status:** Aceita
- **Data:** 2026-10-20

## Contexto

Na arquitetura hexagonal, o valor do padrão depende de uma regra simples: **as dependências apontam para dentro**. O domínio não conhece a aplicação, e nenhum dos dois conhece a infraestrutura, o framework ou o ORM.

Essa regra costuma ser violada aos poucos, quase sempre sem querer: um import de conveniência, um decorator do NestJS "só nessa classe", um tipo do Prisma usado em um caso de uso. Quando isso acontece, a separação existe apenas na documentação.

## Decisão

Verificar a regra **automaticamente** com o linter do projeto, o **oxlint**, usando a regra `no-restricted-imports` configurada por camada em `.oxlintrc.json` (via `overrides` por padrão de arquivo):

| Camada | Arquivos | Imports proibidos |
|---|---|---|
| Domínio | `src/modules/*/domain/**/*.ts` | `@nestjs/*`, `@prisma/*` e qualquer caminho que contenha `application`, `infrastructure` ou `generated` |
| Aplicação | `src/modules/*/application/**/*.ts` | `@nestjs/*`, `@prisma/*` e qualquer caminho que contenha `infrastructure` ou `generated` |

A infraestrutura não tem restrição de imports, pois é a camada que conhece as demais.

O comando `npm run lint` roda na CI e uma violação impede o merge **(CI planejada)**.

## Alternativas consideradas

**Apenas convenção e revisão de código.** Simples, mas depende de disciplina humana e de atenção em cada revisão. É frágil em projetos que crescem.

**`dependency-cruiser` ou `eslint-plugin-boundaries`.** Ferramentas especializadas em regras de arquitetura, mais expressivas. Podem ser adicionadas depois, inclusive para gerar um diagrama de dependências. Para o estágio atual, a regra nativa do linter já cobre o essencial sem adicionar uma ferramenta nova.

**Separar em pacotes (monorepo).** Impõe a fronteira em tempo de build, porém aumenta bastante a complexidade de configuração para um projeto deste tamanho.

## Consequências

**Positivas**

- A arquitetura passa a ser **executável**: violar a regra quebra o lint.
- Revisores e novos contribuidores têm feedback imediato.
- Reforça, no portfólio, que as decisões arquiteturais são verificadas e não apenas descritas.

**Negativas**

- A regra baseia-se em padrões de caminho. Um import que contorne esses padrões (por exemplo, um alias de caminho mal nomeado) pode passar despercebido.
- Mudanças na estrutura de pastas exigem atualizar os padrões do `.oxlintrc.json`.

## Como validar

Para confirmar que a regra está ativa, crie temporariamente um arquivo em `src/modules/booking/domain/` que importe algo de `@nestjs/common` e rode `npm run lint`. O comando deve falhar com a mensagem de que o domínio não pode depender de framework ou ORM. Depois, apague o arquivo de teste.
