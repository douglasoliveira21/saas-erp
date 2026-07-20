# Deploy

## Pré-requisitos

- Variáveis de ambiente definidas no provedor
- PostgreSQL acessível apenas pela rede necessária
- `JWT_SECRET` forte e exclusivo
- `CORS_ORIGIN` restrito ao domínio do frontend
- Credenciais SMTP, Microsoft, GLPI, fiscal e Banco Inter fornecidas por segredo

## Processo

```bash
npm ci
npm run build
```

Publique somente commits presentes na branch acompanhada pelo provedor, normalmente `main`. O endpoint de saúde é `/api/health`.

## Banco

O projeto ainda precisa consolidar migrations formais. Antes de mudanças de esquema, faça backup e teste restauração. Não habilite `DATABASE_SYNC=true` em produção.

## Pós-deploy

- Verificar `/api/health`
- Validar login e permissões
- Criar uma venda de teste
- Confirmar baixa e estorno de estoque
- Validar filas/tarefas financeiras e integrações configuradas
