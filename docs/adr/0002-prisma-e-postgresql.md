# ADR 0002: PostgreSQL e Prisma 7

- **Status:** Aceita
- **Data:** 2026-10-20

## Contexto

O sistema precisa de um banco relacional, porque o domínio tem relações fortes (prestador, serviço, agendamento, pagamento), exige transações e precisa impedir de forma **definitiva** que o mesmo horário seja reservado duas vezes por concorrência.

Também é necessário um ORM com boa tipagem em TypeScript e migrations versionadas, que se encaixe na arquitetura hexagonal: o ORM deve ficar restrito à camada de infraestrutura.

## Decisão

- **Banco:** PostgreSQL 17, executado localmente por Docker Compose.
- **ORM:** Prisma 7 com o driver adapter `@prisma/adapter-pg`.
- **Client gerado dentro do projeto** (`src/generated/prisma`), sem versionar o código gerado.
- **URL do banco na configuração do Prisma CLI** (`prisma7.config.ts`), lida da variável de ambiente `DATABASE_URL`, e não no `schema.prisma`.
- O `PrismaService` fica em `src/shared/infrastructure/prisma` e só é usado por **adapters de persistência**. Domínio e casos de uso nunca o importam.
- Models do Prisma **não são entidades de domínio**. Os repositórios fazem o mapeamento entre os dois.
- A proteção contra double booking será feita com uma **exclusion constraint** do PostgreSQL (extensão `btree_gist`), aplicada por SQL manual em uma migration, já que o Prisma não a expressa no schema.

## Alternativas consideradas

**TypeORM.** Muito usado com NestJS e baseado em decorators. Tende a incentivar entidades anotadas que misturam domínio e persistência, o que contraria a separação desejada.

**Drizzle.** Leve e próximo do SQL. É uma boa opção, mas o Prisma oferece migrations e tipagem mais maduras para este projeto de estudo.

**SQL puro com `pg`.** Máximo controle, porém mais código repetitivo e sem migrations integradas.

**MySQL ou MongoDB.** O PostgreSQL oferece constraints de exclusão sobre intervalos, que resolvem diretamente o problema central de concorrência. Um banco de documentos tornaria o controle transacional mais trabalhoso.

## Consequências

**Positivas**

- Integridade de horários garantida pelo banco, mesmo sob concorrência.
- Migrations versionadas e client totalmente tipado.
- A troca do ORM afetaria apenas os adapters de persistência.

**Negativas**

- Mapeamento manual entre models do Prisma e agregados do domínio.
- A exclusion constraint exige SQL escrito à mão, fora do schema do Prisma.
- O Prisma 7 mudou o modelo de configuração em relação à versão 6 (driver adapters, client gerado no projeto, `prisma7.config.ts`). Tutoriais antigos podem não funcionar.
- A versão do Prisma precisa ser fixada na linha 7.x, porque a instalação sem versão chegou a resolver para um release candidate do Prisma 8.

## Observações operacionais

- O PostgreSQL do Compose usa a porta **5433** no host para evitar conflito com instalações locais na 5432.
- A aplicação valida `DATABASE_URL` na inicialização e falha rápido se ela estiver ausente ou inválida.
