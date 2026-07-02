# Tutorial: Deploy do SaaS ERP no EasyPanel

Guia passo a passo para colocar o sistema no ar. Não precisa saber programação.

---

## O que você precisa

- Um servidor VPS com no mínimo 2GB de RAM (DigitalOcean, Hetzner, Contabo, etc.)
- EasyPanel instalado no servidor
- Um domínio (opcional, mas recomendado)

---

## Passo 1 — Instalar o EasyPanel

Acesse seu servidor via SSH e rode este comando:

```bash
curl -sSL https://get.easypanel.io | sh
```

Depois acesse no navegador: `http://IP-DO-SEU-SERVIDOR:3000`

Crie sua conta de admin no primeiro acesso.

---

## Passo 2 — Criar o Projeto

1. Clique em **"+ Create Project"**
2. Nome: `saas-erp`
3. Clique em **"Create"**

---

## Passo 3 — Criar o Banco de Dados

1. Dentro do projeto, clique em **"+ Create Service"**
2. Escolha **"Postgres"**
3. Preencha:
   - **Nome do serviço:** `db`
   - **Password:** crie uma senha forte e **ANOTE ELA**
   - **Database:** `gestao_ti`
4. Clique em **"Create"**
5. Espere ficar verde (Running)

---

## Passo 4 — Criar o Backend (API)

1. Clique em **"+ Create Service"** → **"App"**
2. Preencha:
   - **Nome do serviço:** `backend`
   - **Source:** GitHub
   - **Repository:** `douglasoliveira21/saas-erp`
   - **Branch:** `main`

3. Na aba **Build**:
   - **Build Path:** `./backend`
   - **Dockerfile Path:** `./Dockerfile`

4. Na aba **Environment**, cole estas variáveis:

```
DATABASE_HOST=saas-erp-db
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=COLOQUE_AQUI_A_SENHA_DO_PASSO_3
DATABASE_NAME=gestao_ti
DATABASE_SYNC=true
JWT_SECRET=trocar-por-uma-chave-secreta-forte
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
CORS_ORIGIN=*
```

> **DATABASE_SYNC=true** faz o sistema criar todas as tabelas automaticamente!

5. Na aba **Network/Domains**:
   - **Port:** `5000`

6. Clique em **"Create"** e depois **"Deploy"**
7. Aguarde o build (2-5 minutos)

---

## Passo 5 — Criar o Frontend (Interface)

1. Clique em **"+ Create Service"** → **"App"**
2. Preencha:
   - **Nome do serviço:** `frontend`
   - **Source:** GitHub
   - **Repository:** `douglasoliveira21/saas-erp`
   - **Branch:** `main`

3. Na aba **Build**:
   - **Build Path:** `./frontend`
   - **Dockerfile Path:** `./Dockerfile`

4. Na aba **Environment**, adicione:

```
BACKEND_URL=http://saas-erp-backend:5000
```

> Se não funcionar com `saas-erp-backend`, tente `backend` ou veja o nome exato do serviço backend nos logs do EasyPanel.

5. Na aba **Network/Domains**:
   - **Port:** `80`
   - **Domain:** coloque seu domínio (ex: `erp.seudominio.com.br`)

5. Clique em **"Create"** e depois **"Deploy"**
6. Aguarde o build (2-3 minutos)

---

## Passo 6 — Acessar o Sistema

Quando todos os serviços estiverem verdes (Running):

1. Acesse o domínio que configurou (ou `http://IP-DO-SERVIDOR`)
2. Faça login com:

| Email | Senha | Tipo |
|-------|-------|------|
| admin@empresa.com | Admin@123 | Administrador |
| financeiro@empresa.com | Financeiro@123 | Financeiro |
| tecnico@empresa.com | Tecnico@123 | Técnico |

> Os usuários são criados automaticamente na primeira vez que o backend inicia!

---

## Passo 7 — Configurar o Domínio (DNS)

No seu provedor de domínio (Registro.br, Cloudflare, etc.), crie:

| Tipo | Nome | Valor |
|------|------|-------|
| A | erp | IP-DO-SEU-SERVIDOR |

O EasyPanel gera o certificado HTTPS (SSL) automaticamente.

---

## Pronto!

Seu sistema está no ar. Estrutura final:

```
Projeto: saas-erp
├── db         → Banco PostgreSQL
├── backend    → API (porta 5000)
└── frontend   → Interface web (porta 80) + seu domínio
```

---

## Problemas? Veja abaixo:

### Tela branca ou erro 502
- O backend pode ainda estar iniciando (espere 1 minuto)
- Vá no serviço `backend` → aba "Logs" e veja se tem erro

### Nginx: "host not found in upstream"
- Isso significa que o frontend não encontra o backend pela rede
- Vá no serviço `frontend` → aba "Environment"
- Ajuste o `BACKEND_URL` com o nome correto do backend
- Tente estas opções até funcionar:
  - `http://saas-erp-backend:5000`
  - `http://saas-erp_backend:5000`
  - `http://backend:5000`
  - `http://backend.saas-erp.svc.cluster.local:5000`
- Após mudar, clique em "Redeploy"

### Login não funciona
- Verifique nos logs do backend se aparece "Usuários padrão criados com sucesso"
- Se não apareceu, pode ser que o banco não conectou. Verifique a senha do DATABASE_PASSWORD

### Backend não conecta no banco
- Confira que `DATABASE_HOST` é exatamente `saas-erp-db`
- Confira que a senha é a mesma que definiu no serviço `db`

### Build falhou
- Verifique se o Branch é `main`
- Verifique se o Build Path está correto (`./backend` ou `./frontend`)

---

## Como Atualizar

Quando houver atualizações:
1. Vá no serviço desejado (backend ou frontend)
2. Clique em **"Redeploy"**
3. Pronto, ele puxa o código novo do GitHub automaticamente

---

## Dica de Segurança

Após o primeiro login, troque:
- As senhas dos usuários padrão
- O valor do `JWT_SECRET` nas variáveis de ambiente do backend (use algo aleatório e longo)
