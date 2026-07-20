# Arquitetura

## Estrutura

- `frontend/`: React 18, TypeScript, Vite e Tailwind
- `backend/`: NestJS, TypeORM e PostgreSQL
- `docs/`: documentação canônica

## Frontend

As rotas são carregadas sob demanda em `src/App.tsx`. Componentes reutilizáveis ficam em `src/components/ui`; componentes de domínio ficam em pastas como `src/components/sales`.

O `FeedbackProvider` centraliza notificações e confirmações. O `ErrorBoundary` trata falhas inesperadas de renderização.

## Backend

Cada domínio possui controller, service e entities em `src/modules`. Regras críticas devem permanecer no backend, dentro de transações quando afetarem venda, estoque, comissão ou financeiro.

## Regras de dependência

- Páginas não devem conter regras financeiras autoritativas.
- Controllers validam entrada e autorização.
- Services executam regras de negócio.
- Alterações de banco devem evoluir para migrations versionadas.
- Integrações externas devem ser idempotentes e auditáveis.
