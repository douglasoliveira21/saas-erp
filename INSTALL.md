# Guia de Instalação - Sistema de Gestão de TI

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** 18 ou superior ([Download](https://nodejs.org/))
- **PostgreSQL** 14 ou superior ([Download](https://www.postgresql.org/download/))
- **npm** ou **yarn** (vem com Node.js)
- **Git** (opcional, para clonar o repositório)

## 🗄️ Configuração do Banco de Dados

### 1. Instalar PostgreSQL

#### Windows
1. Baixe o instalador do PostgreSQL
2. Execute o instalador e siga as instruções
3. Anote a senha do usuário `postgres`
4. Certifique-se de que o PostgreSQL está rodando

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

### 2. Criar o Banco de Dados

Abra o terminal/prompt e execute:

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Dentro do psql, execute:
CREATE DATABASE gestao_ti;

# Verificar se foi criado
\l

# Sair do psql
\q
```

Ou use uma ferramenta gráfica como **pgAdmin** ou **DBeaver**.

## 🚀 Instalação do Sistema

### 1. Clonar ou Baixar o Projeto

```bash
# Se estiver usando Git
git clone <url-do-repositorio>
cd sistema-gestao-ti

# Ou extraia o arquivo ZIP baixado
```

### 2. Instalar Dependências

```bash
# Instalar todas as dependências (backend + frontend)
npm run install:all
```

Ou instale separadamente:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Configurar Variáveis de Ambiente

#### Backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=sua_senha_aqui
DATABASE_NAME=gestao_ti

# JWT
JWT_SECRET=gere_uma_chave_secreta_forte_aqui
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

**⚠️ IMPORTANTE**: Altere o `JWT_SECRET` para uma chave forte e única!

Você pode gerar uma chave segura com:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Frontend

```bash
cd frontend
cp .env.example .env
```

Edite o arquivo `.env`:

```env
VITE_API_URL=http://localhost:3000
```

### 4. Executar Migrations e Seeds

```bash
cd backend

# Executar migrations (criar tabelas)
npm run migration:run

# Executar seeds (dados iniciais)
npm run seed
```

Se preferir, você pode executar o SQL manualmente:

```bash
# Conectar ao banco
psql -U postgres -d gestao_ti

# Executar o schema
\i database/schema.sql

# Sair
\q
```

## ▶️ Executando o Sistema

### Opção 1: Executar Tudo Junto (Recomendado)

Na raiz do projeto:

```bash
npm run dev
```

Isso iniciará o backend e frontend simultaneamente.

### Opção 2: Executar Separadamente

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 🌐 Acessando o Sistema

Após iniciar, acesse:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api

## 👥 Usuários Padrão

Após executar os seeds, você terá os seguintes usuários:

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@empresa.com | Admin@123 |
| Financeiro | financeiro@empresa.com | Financeiro@123 |
| Técnico | tecnico@empresa.com | Tecnico@123 |

## ✅ Verificando a Instalação

### 1. Verificar Backend

Abra o navegador e acesse:
```
http://localhost:3000/api
```

Você deve ver uma resposta da API.

### 2. Verificar Banco de Dados

```bash
psql -U postgres -d gestao_ti -c "SELECT COUNT(*) FROM users;"
```

Deve retornar o número de usuários criados (4).

### 3. Testar Login

No frontend, tente fazer login com um dos usuários padrão.

## 🐛 Solução de Problemas

### Erro: "Cannot connect to database"

**Solução:**
1. Verifique se o PostgreSQL está rodando
2. Confirme as credenciais no arquivo `.env`
3. Teste a conexão:
```bash
psql -U postgres -d gestao_ti
```

### Erro: "Port 3000 already in use"

**Solução:**
1. Altere a porta no `.env` do backend
2. Ou mate o processo que está usando a porta:

**Windows:**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
lsof -ti:3000 | xargs kill -9
```

### Erro: "Module not found"

**Solução:**
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Erro ao executar migrations

**Solução:**
```bash
# Resetar banco (CUIDADO: apaga todos os dados)
psql -U postgres -c "DROP DATABASE gestao_ti;"
psql -U postgres -c "CREATE DATABASE gestao_ti;"

# Executar schema manualmente
psql -U postgres -d gestao_ti -f backend/database/schema.sql
```

## 📦 Build para Produção

### Backend

```bash
cd backend
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm run build
```

Os arquivos estarão em `frontend/dist` e podem ser servidos por nginx, Apache, etc.

## 🔒 Segurança em Produção

Antes de colocar em produção:

1. ✅ Altere o `JWT_SECRET` para uma chave forte
2. ✅ Altere as senhas padrão dos usuários
3. ✅ Configure HTTPS
4. ✅ Configure firewall
5. ✅ Desabilite `synchronize: true` no TypeORM
6. ✅ Configure backup automático do banco
7. ✅ Use variáveis de ambiente seguras

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do backend e frontend
2. Consulte a documentação no README.md
3. Verifique se todas as dependências foram instaladas
4. Confirme que o PostgreSQL está rodando

## 🎉 Pronto!

Seu sistema está instalado e pronto para uso!

Próximos passos:
- Altere as senhas padrão
- Cadastre seus produtos e serviços
- Configure as regras de comissão
- Comece a registrar vendas
