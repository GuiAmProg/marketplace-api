# Marketplace API

API backend de um **marketplace de serviços com agendamento e pagamento**: prestadores (barbeiros, personal trainers, diaristas etc.) publicam serviços e clientes reservam horários e pagam pela plataforma.

O projeto foi construído como estudo prático e peça de portfólio, com três objetivos:

1. Aplicar **Arquitetura Hexagonal (Ports and Adapters)** com **DDD tático** em um domínio que tem regras de negócio de verdade.
2. Demonstrar práticas profissionais de backend: segurança, testes, concorrência, CI, documentação e decisões arquiteturais registradas.
3. Mostrar o raciocínio por trás de cada escolha técnica (veja os [ADRs](docs/adr)).

> **Status: em desenvolvimento inicial.** A infraestrutura base está pronta e o domínio está em construção. As seções abaixo marcam claramente o que já existe e o que é planejado.

---

## Status do projeto

| Item | Situação |
|---|---|
| Scaffold NestJS (TypeScript estrito) | Pronto |
| PostgreSQL via Docker Compose | Pronto |
| Validação de variáveis de ambiente (Zod) | Pronto |
| Prisma 7 com driver adapter (`pg`) e `PrismaService` | Pronto |
| Lint com oxlint e regra de dependência da arquitetura | Pronto |
| Domínio do contexto Booking (`Money`, `TimeSlot`, `Booking`) | Em andamento |
| Caso de uso `RequestBooking` com testes unitários | Planejado (próximo passo) |
| Demais casos de uso (cancelamento, expiração, conclusão) | Planejado |
| Persistência real dos agregados (Prisma) | Planejado |
| Autenticação, autorização e endurecimento de segurança | Planejado |
| Integração com gateway de pagamento | Planejado |
| CI com GitHub Actions | Planejado |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js (LTS, 24.15 ou superior) |
| Framework | NestJS |
| Linguagem | TypeScript (modo estrito) |
| Banco de dados | PostgreSQL 17 |
| ORM | Prisma 7 com `@prisma/adapter-pg` |
| Validação de configuração | Zod |
| Testes | Jest |
| Lint | oxlint (com regras sensíveis a tipos) |
| Infraestrutura local | Docker Compose |

---

## Arquitetura em resumo

O projeto segue a **Arquitetura Hexagonal**. O núcleo (domínio e casos de uso) não conhece framework, banco de dados nem HTTP. Ele conversa com o mundo externo apenas por **ports** (interfaces), e cada tecnologia entra como um **adapter** que implementa um port.

```mermaid
flowchart LR
  subgraph IN["Adapters de entrada"]
    HTTP["Controllers HTTP"]
    JOB["Jobs e webhooks"]
  end
  subgraph CORE["Núcleo"]
    UC["Casos de uso<br/>(application)"]
    DOM["Domínio<br/>(entidades, value objects, eventos)"]
  end
  subgraph OUT["Adapters de saída"]
    DB["Repositórios Prisma"]
    PAY["Gateway de pagamento"]
    MSG["Notificações"]
  end
  HTTP --> UC
  JOB --> UC
  UC --> DOM
  UC -- "ports de saída" --> DB
  UC -- "ports de saída" --> PAY
  UC -- "ports de saída" --> MSG
```

A regra principal: **as dependências sempre apontam para dentro**. O domínio não importa nada de NestJS, Prisma ou Express, e isso é verificado automaticamente pelo lint.

Detalhes completos em [docs/architecture.md](docs/architecture.md).

---

## Funcionalidades planejadas

- Cadastro de prestadores e serviços, com jornada de trabalho e política de cancelamento por serviço.
- Consulta de horários disponíveis.
- Solicitação de agendamento com bloqueio imediato do horário e prazo de 15 minutos para pagamento.
- Confirmação por pagamento aprovado, com idempotência.
- Cancelamento com cálculo de reembolso baseado na política gravada no momento da reserva.
- Expiração automática de reservas não pagas.
- Conclusão do serviço e avaliação pelo cliente.

O detalhamento de regras de negócio, estados e casos de uso está em [docs/domain.md](docs/domain.md).

---

## Estrutura de pastas

```
marketplace-api/
├── docs/
│   ├── architecture.md          # Arquitetura e regras de dependência
│   ├── domain.md                # Modelo de domínio e casos de uso
│   └── adr/                     # Architecture Decision Records
├── prisma/
│   └── schema.prisma
├── prisma7.config.ts            # Configuração do Prisma CLI (URL do banco, migrations)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   └── env.ts               # Schema Zod das variáveis de ambiente
│   ├── shared/
│   │   └── infrastructure/
│   │       └── prisma/          # PrismaService e PrismaModule
│   ├── generated/               # Client do Prisma (gerado, não versionado)
│   └── modules/
│       └── booking/
│           ├── domain/          # Entidades, value objects, eventos, erros
│           ├── application/     # Casos de uso e ports (in/out)
│           └── infrastructure/  # Adapters (HTTP, persistência)
├── test/
├── docker-compose.yml
├── .env.example
└── .oxlintrc.json
```

---

## Como rodar localmente

### Pré-requisitos

- Node.js LTS (24.15 ou superior)
- Docker e Docker Compose
- Git

### Passo a passo

```bash
git clone https://github.com/GuiAmProg/marketplace-api.git
cd marketplace-api

# 1. Variáveis de ambiente
cp .env.example .env          # no Windows (cmd): copy .env.example .env

# 2. Dependências
npm ci

# 3. Banco de dados
docker compose up -d
docker compose ps             # aguarde o status "healthy"

# 4. Client do Prisma
npx prisma generate

# 5. Aplicação em modo desenvolvimento
npm run start:dev
```

### Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `NODE_ENV` | Ambiente de execução | `development` |
| `PORT` | Porta HTTP da API | `3000` |
| `DATABASE_URL` | String de conexão do PostgreSQL | `postgresql://marketplace:marketplace@localhost:5433/marketplace` |
| `POSTGRES_USER` | Usuário do banco (usado pelo Docker Compose) | `marketplace` |
| `POSTGRES_PASSWORD` | Senha do banco (usado pelo Docker Compose) | `marketplace` |
| `POSTGRES_DB` | Nome do banco (usado pelo Docker Compose) | `marketplace` |

O PostgreSQL do Compose é exposto na porta **5433** do host (e não na 5432) para evitar conflito com instalações locais do Postgres. A aplicação falha na inicialização se alguma variável obrigatória estiver ausente ou inválida.

---

## Scripts

| Comando | O que faz |
|---|---|
| `npm run start:dev` | Sobe a API em modo watch |
| `npm run build` | Compila o projeto |
| `npm run lint` | Executa o oxlint (inclui a regra de dependência da arquitetura) |
| `npm run typecheck` | Verifica tipos sem gerar arquivos |
| `npm test` | Executa os testes unitários |
| `npm run test:cov` | Executa os testes com relatório de cobertura |
| `npm run format` | Formata o código com Prettier |
| `npm run db:up` / `db:down` | Sobe ou derruba o PostgreSQL local |
| `npm run db:migrate` | Aplica migrations em desenvolvimento |
| `npm run db:generate` | Regenera o client do Prisma |

---

## Qualidade e convenções

- **Regra de dependência verificada por lint.** O domínio não pode importar framework, ORM nem camadas externas. Violações quebram o `npm run lint`.
- **Testes do domínio sem framework.** Entidades, value objects e casos de uso são testados com adapters em memória, sem banco e sem NestJS.
- **Commits semânticos** (Conventional Commits): `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- **Decisões registradas** como ADRs em [`docs/adr`](docs/adr).

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [Arquitetura](docs/architecture.md) | Hexagonal, camadas, ports e adapters, regra de dependência, estratégia de testes |
| [Domínio](docs/domain.md) | Contextos, agregados, value objects, estados, invariantes, eventos e casos de uso |
| [ADR 0001](docs/adr/0001-arquitetura-hexagonal.md) | Por que arquitetura hexagonal com DDD tático |
| [ADR 0002](docs/adr/0002-prisma-e-postgresql.md) | Por que PostgreSQL e Prisma 7 |
| [ADR 0003](docs/adr/0003-regra-de-dependencia-via-lint.md) | Como a regra de dependência é garantida automaticamente |

---

## Roadmap

1. Concluir o domínio do contexto Booking com testes (`Money`, `TimeSlot`, `Booking`, `RequestBooking`).
2. Implementar `CancelBooking` (política de reembolso e máquina de estados completa).
3. Conectar os casos de uso ao NestJS (controllers, DTOs, injeção de dependência por tokens).
4. Persistência real com Prisma e proteção contra double booking via *exclusion constraint* do PostgreSQL.
5. Autenticação JWT (access e refresh token), RBAC e proteção contra IDOR.
6. Pagamento com gateway abstraído por port, idempotência e webhooks.
7. Filas para expiração de reservas e notificações.
8. CI com GitHub Actions, testes de integração com Testcontainers, OpenAPI/Swagger e logs estruturados.

---

## Autor

Projeto desenvolvido por [GuiAmProg](https://github.com/GuiAmProg).
