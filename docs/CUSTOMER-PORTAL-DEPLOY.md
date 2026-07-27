# Deploy do Portal do Cliente

## Backend

Faça rebuild do serviço `backend`. A migration `1791000000000-CustomerPortal` será executada automaticamente pelo `docker-entrypoint.sh`.

Configure:

```env
CORS_ORIGIN=https://erp.vgon.com.br,https://portal.vgon.com.br
```

Mantenha as variáveis atuais de JWT, banco, criptografia e GLPI.

## Portal no EasyPanel

Crie um novo serviço apontando para o mesmo repositório:

- Branch: `main`
- Caminho de build: `/portal`
- Tipo: `Dockerfile`
- Arquivo: `Dockerfile`
- Domínio: `portal.vgon.com.br`
- Porta interna: `80`

Variável do serviço:

```env
BACKEND_URL=http://backend:5000
```

Use o nome interno real do serviço backend caso ele não seja `backend`.

## DNS

Crie o registro solicitado pelo EasyPanel para `portal.vgon.com.br` e habilite HTTPS.

## Primeiro acesso

1. Entre no ERP como administrador.
2. Acesse **Administração → Portal do cliente**.
3. Escolha um cliente com CNPJ e entidade GLPI vinculada.
4. Crie o primeiro administrador da empresa.
5. Acesse `https://portal.vgon.com.br`.

Funcionários que fizerem autocadastro pelo CNPJ permanecerão pendentes até um administrador da empresa ou superadministrador aprovar.
