# Deploy no EasyPanel

## Requisitos
- EasyPanel instalado no servidor
- Acesso ao repositório GitHub: https://github.com/douglasoliveira21/saas-erp

---

## Passo 1: Criar o Projeto no EasyPanel

1. Acesse o painel do EasyPanel
2. Clique em **"Create Project"**
3. Nome: `saas-erp`

---

## Passo 2: Criar o Serviço PostgreSQL

1. No projeto, clique em **"+ Service"** → **"Database"** → **"PostgreSQL"**
2. Configure:
   - **Nome:** `postgres`
   - **Database:** `gestao_ti`
   - **Username:** `postgres`
   - **Password:** (defina uma senha forte)
3. Salve e aguarde o banco iniciar

---

## Passo 3: Criar o Serviço Backend

1. Clique em **"+ Service"** → **"App"**
2. Configure:
   - **Nome:** `backend`
   - **Source:** GitHub → `douglasoliveira21/saas-erp`
   - **Branch:** `main`
   - **Build Path:** `/backend`
   - **Dockerfile Path:** `./Dockerfile`
   - **Port:** `5000`

3. Variáveis de ambiente:
   ```
   DATABASE_HOST=saas-erp-postgres
   DATABASE_PORT=5432
   DATABASE_USER=postgres
   DATABASE_PASSWORD=SUA_SENHA_AQUI
   DATABASE_NAME=gestao_ti
   JWT_SECRET=uma-chave-secreta-muito-forte-aqui
   JWT_EXPIRES_IN=7d
   PORT=5000
   NODE_ENV=production
   CORS_ORIGIN=*
   ```

   > **Nota:** O `DATABASE_HOST` deve ser o nome interno do container PostgreSQL no EasyPanel. Geralmente segue o padrão `nome-do-projeto-nome-do-servico` (ex: `saas-erp-postgres`).

4. **Não** expor domínio público para o backend (será acessado apenas pelo frontend via proxy)

---

## Passo 4: Criar o Serviço Frontend

1. Clique em **"+ Service"** → **"App"**
2. Configure:
   - **Nome:** `frontend`
   - **Source:** GitHub → `douglasoliveira21/saas-erp`
   - **Branch:** `main`
   - **Build Path:** `/frontend`
   - **Dockerfile Path:** `./Dockerfile`
   - **Port:** `80`

3. Configure um **domínio** para acesso externo (ex: `erp.seudominio.com.br`)

4. No nginx.conf do frontend, o proxy já aponta para `backend:5000`. No EasyPanel, você pode precisar ajustar para o nome interno do serviço: `saas-erp-backend:5000`

---

## Passo 5: Ajustar o nginx.conf para o EasyPanel

Antes do deploy, edite o arquivo `frontend/nginx.conf` e troque `backend:5000` pelo hostname correto do backend no EasyPanel:

```nginx
location /api {
    proxy_pass http://saas-erp-backend:5000;
    ...
}
```

O hostname geralmente é: `{nome-do-projeto}-{nome-do-servico}`

---

## Passo 6: Inicializar o Banco de Dados

Após todos os serviços estarem rodando:

1. Acesse o terminal do serviço `postgres` no EasyPanel
2. Execute:
   ```bash
   psql -U postgres -d gestao_ti -f /docker-entrypoint-initdb.d/01-schema.sql
   ```

   **OU** acesse o terminal do backend e execute:
   ```bash
   node -e "
   const { DataSource } = require('typeorm');
   const ds = new DataSource({
     type: 'postgres',
     host: process.env.DATABASE_HOST,
     port: 5432,
     username: process.env.DATABASE_USER,
     password: process.env.DATABASE_PASSWORD,
     database: process.env.DATABASE_NAME,
     synchronize: true,
     entities: ['dist/**/*.entity.js']
   });
   ds.initialize().then(() => { console.log('Tables created!'); ds.destroy(); });
   "
   ```

   Como o backend usa `synchronize: true` em modo development, você pode temporariamente setar `NODE_ENV=development` para criar as tabelas automaticamente.

---

## Passo 7: Criar Usuário Admin

Acesse o terminal do backend e execute:
```bash
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('Admin@123', 10).then(hash => {
  console.log('INSERT INTO users (name, email, password, role, active) VALUES');
  console.log(\"('Administrador', 'admin@empresa.com', '\" + hash + \"', 'admin', true);\");
});
"
```

Depois rode o SQL gerado no PostgreSQL.

---

## Credenciais Padrão

| Usuário | Email | Senha |
|---------|-------|-------|
| Admin | admin@empresa.com | Admin@123 |
| Financeiro | financeiro@empresa.com | Financeiro@123 |
| Técnico | tecnico@empresa.com | Tecnico@123 |

---

## Alternativa: Deploy com Docker Compose (local ou VPS)

```bash
# Clone o repositório
git clone https://github.com/douglasoliveira21/saas-erp.git
cd saas-erp

# Copie o .env
cp .env.example .env
# Edite o .env com suas configurações

# Suba os containers
docker-compose up -d

# Aguarde os serviços subirem e acesse:
# Frontend: http://localhost
# Backend API: http://localhost:5000/api
```

---

## Troubleshooting

### Backend não conecta no banco
- Verifique se o `DATABASE_HOST` está correto (nome do serviço interno)
- Verifique se a senha está correta
- Verifique se o banco está rodando

### Frontend mostra erro 502
- O backend pode não ter iniciado ainda (aguarde 30-60s)
- Verifique o hostname no `nginx.conf`

### Tabelas não foram criadas
- Setando `NODE_ENV=development` o TypeORM cria as tabelas automaticamente via `synchronize: true`
- Ou importe o `schema.sql` manualmente no PostgreSQL
