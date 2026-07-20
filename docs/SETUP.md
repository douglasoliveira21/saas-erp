# Configuração local

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- PostgreSQL 14 ou superior

## Instalação

```bash
npm install
Copy-Item .env.example backend/.env
npm run dev
```

Preencha no mínimo `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `JWT_SECRET`, `CORS_ORIGIN` e as credenciais das integrações utilizadas.

## Portas padrão

- Frontend Vite: `5173`
- Backend: `5000`
- API: `/api`
- Saúde: `/api/health`

## Validação

```bash
npm run build
npm run --workspace frontend lint
```

Nunca registre senhas reais, certificados ou tokens no Git.
