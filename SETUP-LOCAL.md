# 🏠 Setup Local - PostgreSQL Local

## 📋 Configuração Atualizada

### Banco de Dados
- **Host**: localhost (local)
- **Porta**: 5432
- **Usuário**: postgres
- **Senha**: Vsi@#$3303Vsi
- **Database**: gestao_ti

### Aplicação
- **Backend**: Porta 5000
- **Frontend**: Porta 5001

---

## 🚀 Setup Rápido (3 Passos)

### 1️⃣ Instalar Dependências

```bash
npm run install:all
```

### 2️⃣ Criar Banco de Dados Local

**Windows:**
```bash
setup-db.bat
```

**Linux/Mac:**
```bash
chmod +x setup-db.sh
./setup-db.sh
```

**Ou manualmente:**
```bash
# Criar banco
psql -U postgres -f setup-database.sql

# Executar seeds
cd backend
npm run seed
```

### 3️⃣ Iniciar Sistema

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

---

## 🌐 Acessar

- **Frontend**: http://localhost:5001
- **API**: http://localhost:5000/api

### 👤 Login Padrão

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | admin@empresa.com | Admin@123 |
| Financeiro | financeiro@empresa.com | Financeiro@123 |
| Técnico | tecnico@empresa.com | Tecnico@123 |

---

## ✅ Checklist

- [ ] PostgreSQL instalado localmente
- [ ] Dependências instaladas
- [ ] Banco criado (gestao_ti)
- [ ] Seeds executados
- [ ] Backend rodando (porta 5000)
- [ ] Frontend rodando (porta 5001)
- [ ] Login funcionando

---

## 🐛 Problemas Comuns

### PostgreSQL não está rodando

**Windows:**
```bash
# Verificar serviço
sc query postgresql-x64-14

# Iniciar serviço
net start postgresql-x64-14
```

**Linux:**
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

**Mac:**
```bash
brew services list
brew services start postgresql@14
```

### Erro de autenticação

Verifique a senha no arquivo `.env`:
```env
DATABASE_PASSWORD=Vsi@#$3303Vsi
```

### Porta em uso

**Backend (5000):**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

**Frontend (5001):**
```bash
# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5001 | xargs kill -9
```

---

## 📝 Arquivos de Configuração

### backend/.env
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=Vsi@#$3303Vsi
DATABASE_NAME=gestao_ti
JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5001
```

### frontend/.env
```env
VITE_API_URL=http://localhost:5000
```

---

## 🎉 Pronto!

Sistema configurado para rodar localmente! 🚀

**Acesse**: http://localhost:5001
**Login**: admin@empresa.com / Admin@123
