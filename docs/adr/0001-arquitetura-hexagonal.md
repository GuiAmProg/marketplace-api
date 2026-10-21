# ADR 0001: Arquitetura hexagonal com DDD tático

- **Status:** Aceita
- **Data:** 2026-10-20

## Contexto

O projeto é um marketplace de serviços com regras de negócio relevantes: conflito de horários, máquina de estados do agendamento, política de cancelamento com reembolso proporcional e integração com pagamento externo.

O desenvolvedor já tem experiência com arquitetura em camadas tradicional (controller, service, repository) e quer demonstrar versatilidade implementando uma arquitetura diferente, em um problema onde ela se justifique.

Preocupações específicas do domínio:

- As regras de negócio precisam ser testáveis sem banco de dados e sem framework.
- Gateways de pagamento e canais de notificação devem poder ser trocados sem alterar regras.
- O código de negócio não deve ficar acoplado ao NestJS nem ao ORM.

## Decisão

Adotar **Arquitetura Hexagonal (Ports and Adapters)** combinada com **DDD tático**:

- Três camadas por módulo: `domain`, `application` e `infrastructure`.
- As dependências apontam sempre para dentro.
- O núcleo declara **ports** (interfaces). A infraestrutura fornece os **adapters**.
- O domínio é TypeScript puro, sem importar NestJS, Prisma ou Express.
- O NestJS é tratado como detalhe de infraestrutura, usado para expor HTTP e fazer a injeção de dependência por tokens.
- O sistema é dividido em contextos delimitados (Identity, Catalog, Booking, Payment, Review), cada um como um módulo com suas próprias camadas.

## Alternativas consideradas

**Arquitetura em camadas tradicional.** Mais simples e familiar, porém tende a acoplar as regras de negócio ao ORM e ao framework, e dificulta testar o núcleo de forma isolada. É uma boa escolha para sistemas de baixa complexidade e continuará sendo demonstrada em outro projeto do portfólio.

**Clean Architecture completa.** Muito próxima da hexagonal. Foi escolhida a nomenclatura de ports e adapters por ser mais direta para o problema, sem a cerimônia adicional de mais camadas concêntricas.

**CQRS e Event Sourcing.** Adicionariam complexidade desproporcional ao escopo atual. Podem ser estudados em um projeto separado.

## Consequências

**Positivas**

- Regras de negócio testáveis em milissegundos, com adapters em memória.
- Troca de tecnologias (gateway, banco, notificação) sem tocar no domínio.
- Fronteiras claras entre contextos, facilitando evolução e manutenção.
- Demonstra domínio de um padrão arquitetural diferente do convencional.

**Negativas**

- Mais arquivos e mais código de "cola" (mapeamento entre domínio e persistência).
- Curva de aprendizado maior para quem não conhece o padrão.
- Para operações triviais (CRUD simples), a arquitetura pode parecer excessiva. Por isso ela foi aplicada a um domínio rico.

## Mitigações

- A regra de dependência é verificada automaticamente por lint ([ADR 0003](0003-regra-de-dependencia-via-lint.md)).
- A documentação explica cada camada e cada decisão ([architecture.md](../architecture.md)).
