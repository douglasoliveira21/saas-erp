# SaaS ERP

Sistema de gestão para operações de TI, com módulos de vendas, estoque, clientes, serviços, financeiro, fiscal, contratos, comissões, Banco Inter e GLPI.

## Começar

1. Instale Node.js 20+ e PostgreSQL 14+.
2. Copie `.env.example` para `backend/.env` e preencha todos os segredos.
3. Execute `npm install` na raiz.
4. Inicie com `npm run dev`.

Não use credenciais ou segredos padrão em produção.

## Comandos

```bash
npm run dev              # backend e frontend
npm run build            # compilação completa
npm run build:backend    # somente backend
npm run build:frontend   # somente frontend
```

## Documentação canônica

- [Índice da documentação](docs/README.md)
- [Configuração local](docs/SETUP.md)
- [Deploy](docs/DEPLOYMENT.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Padrões de interface](docs/UX-DESIGN-SYSTEM.md)
- [API legada](docs/API-legacy.md)

Os guias antigos foram preservados em `docs/legacy/` apenas para consulta histórica.
