# Comandos Úteis

## 🚀 Instalação e Configuração

### Instalação Inicial
```bash
# Instalar todas as dependências (backend + frontend)
npm run install:all

# Ou instalar separadamente
cd backend && npm install
cd frontend && npm install
```

### Configuração do Banco de Dados
```bash
# Criar banco de dados
createdb gestao_ti

# Ou via psql
psql -U postgres
CREATE DATABASE gestao_ti;
\q
```

### Configurar Variáveis de Ambiente
```bash
# Backend
cd backend
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Frontend
cd frontend
cp .env.example .env
# Edite o arquivo .env com a URL da API
```

### Executar Migrations e Seeds
```bash
cd backend

# Executar migrations (criar tabelas)
npm run migration:run

# Executar seeds (dados iniciais)
npm run seed
```

## 🏃 Executando o Projeto

### Desenvolvimento

```bash
# Executar tudo junto (backend + frontend)
npm run dev

# Ou executar separadamente:

# Backend (porta 3000)
cd backend
npm run start:dev

# Frontend (porta 5173)
cd frontend
npm run dev
```

### Produção

```bash
# Build completo
npm run build

# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
# Servir a pasta dist/ com nginx ou similar
```

## 🗄️ Banco de Dados

### Migrations

```bash
cd backend

# Gerar nova migration
npm run migration:generate -- src/database/migrations/NomeDaMigration

# Executar migrations pendentes
npm run migration:run

# Reverter última migration
npm run migration:revert
```

### Seeds

```bash
cd backend

# Executar seeds
npm run seed

# Ou executar SQL manualmente
psql -U postgres -d gestao_ti -f database/schema.sql
psql -U postgres -d gestao_ti -f database/seeds/seed.sql
```

### Backup e Restore

```bash
# Backup
pg_dump -U postgres gestao_ti > backup.sql

# Restore
psql -U postgres gestao_ti < backup.sql
```

### Resetar Banco (CUIDADO!)

```bash
# Dropar e recriar banco
psql -U postgres -c "DROP DATABASE gestao_ti;"
psql -U postgres -c "CREATE DATABASE gestao_ti;"

# Executar schema e seeds
cd backend
npm run migration:run
npm run seed
```

## 🧪 Testes

```bash
# Backend
cd backend
npm run test              # Unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage
npm run test:e2e          # E2E tests

# Frontend
cd frontend
npm run test              # Unit tests
npm run test:watch        # Watch mode
```

## 🔍 Linting e Formatação

```bash
# Backend
cd backend
npm run lint              # Verificar
npm run lint:fix          # Corrigir

# Frontend
cd frontend
npm run lint              # Verificar
npm run lint:fix          # Corrigir
```

## 📦 Build

```bash
# Backend
cd backend
npm run build
# Arquivos em: dist/

# Frontend
cd frontend
npm run build
# Arquivos em: dist/
```

## 🐳 Docker (Futuro)

```bash
# Build
docker-compose build

# Executar
docker-compose up

# Parar
docker-compose down

# Logs
docker-compose logs -f
```

## 🔧 Manutenção

### Atualizar Dependências

```bash
# Verificar atualizações
npm outdated

# Atualizar todas
npm update

# Atualizar específica
npm install package@latest
```

### Limpar Cache

```bash
# Backend
cd backend
rm -rf node_modules dist
npm install

# Frontend
cd frontend
rm -rf node_modules dist
npm install
```

### Verificar Portas em Uso

```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5173

# Linux/Mac
lsof -ti:3000
lsof -ti:5173
```

### Matar Processo em Porta

```bash
# Windows
taskkill /PID <PID> /F

# Linux/Mac
kill -9 <PID>
```

## 📊 Monitoramento

### Logs do Backend

```bash
cd backend
npm run start:dev
# Logs aparecem no console
```

### Logs do Banco

```bash
# Ver logs do PostgreSQL
# Windows: C:\Program Files\PostgreSQL\14\data\log\
# Linux: /var/log/postgresql/
# Mac: /usr/local/var/log/
```

## 🔐 Segurança

### Gerar JWT Secret

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

### Hash de Senha (para testes)

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('senha123', 10).then(console.log)"
```

## 📝 Git

```bash
# Inicializar repositório
git init
git add .
git commit -m "Initial commit"

# Adicionar remote
git remote add origin <url>
git push -u origin main

# Criar branch
git checkout -b feature/nova-funcionalidade

# Merge
git checkout main
git merge feature/nova-funcionalidade
```

## 🌐 Deploy

### Heroku (Exemplo)

```bash
# Login
heroku login

# Criar app
heroku create nome-do-app

# Adicionar PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main

# Executar migrations
heroku run npm run migration:run

# Ver logs
heroku logs --tail
```

### Vercel (Frontend)

```bash
# Instalar CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Deploy produção
vercel --prod
```

### Railway (Backend)

```bash
# Instalar CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd backend
railway up
```

## 🔄 Workflows Comuns

### Adicionar Nova Funcionalidade

```bash
# 1. Criar branch
git checkout -b feature/nome

# 2. Desenvolver
# ... código ...

# 3. Testar
npm run test

# 4. Commit
git add .
git commit -m "feat: adiciona nova funcionalidade"

# 5. Push
git push origin feature/nome

# 6. Criar Pull Request
```

### Corrigir Bug

```bash
# 1. Criar branch
git checkout -b fix/nome-do-bug

# 2. Corrigir
# ... código ...

# 3. Testar
npm run test

# 4. Commit
git add .
git commit -m "fix: corrige bug X"

# 5. Push e PR
git push origin fix/nome-do-bug
```

### Atualizar Produção

```bash
# 1. Merge para main
git checkout main
git merge develop

# 2. Tag de versão
git tag -a v1.0.0 -m "Versão 1.0.0"
git push origin v1.0.0

# 3. Deploy
npm run build
# ... deploy para servidor ...
```

## 📱 Comandos Rápidos

```bash
# Verificar versões
node --version
npm --version
psql --version

# Status do Git
git status

# Ver branches
git branch -a

# Ver logs
git log --oneline

# Limpar tudo e reinstalar
rm -rf node_modules package-lock.json
npm install

# Verificar se API está rodando
curl http://localhost:3000/api

# Verificar se frontend está rodando
curl http://localhost:5173
```

## 🆘 Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar se PostgreSQL está rodando
# Windows
sc query postgresql-x64-14

# Linux
sudo systemctl status postgresql

# Mac
brew services list

# Iniciar PostgreSQL
# Windows: Services > PostgreSQL > Start
# Linux: sudo systemctl start postgresql
# Mac: brew services start postgresql
```

### Erro: "Port already in use"

```bash
# Encontrar processo
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -ti:3000

# Matar processo
# Windows
taskkill /PID <PID> /F

# Linux/Mac
kill -9 <PID>
```

### Erro: "Module not found"

```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Erro: "Migration failed"

```bash
# Reverter migration
npm run migration:revert

# Ou resetar banco
psql -U postgres -c "DROP DATABASE gestao_ti;"
psql -U postgres -c "CREATE DATABASE gestao_ti;"
npm run migration:run
```

## 📚 Recursos Úteis

### Documentação
- NestJS: https://docs.nestjs.com
- React: https://react.dev
- TypeORM: https://typeorm.io
- Tailwind: https://tailwindcss.com

### Ferramentas
- Postman: Testar API
- pgAdmin: Gerenciar PostgreSQL
- VS Code: Editor recomendado
- Git: Controle de versão

### Extensões VS Code Recomendadas
- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense
- GitLens
- Thunder Client (alternativa ao Postman)
