# ⚡ Setup Rápido

## 🎯 Configuração Atual

- **Banco de Dados**: localhost:5432 (PostgreSQL local)
- **Usuário**: postgres
- **Senha**: Vsi@#$3303Vsi
- **Database**: gestao_ti
- **Backend**: Porta 5000
- **Frontend**: Porta 5001

---

## 🚀 Setup em 3 Passos

### 1️⃣ Instalar Dependências

```bash
npm run install:all
```

### 2️⃣ Criar Banco de Dados e Seeds

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
psql -h 192.168.25.100 -U postgres -p 5432 -f setup-database.sql

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

**Ou manualmente:**
```bash
npm run dev
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

- [ ] Dependências instaladas
- [ ] Banco criado em 192.168.25.100
- [ ] Seeds executados
- [ ] Backend rodando (porta 5000)
- [ ] Frontend rodando (porta 5001)
- [ ] Login funcionando

---

## 🐛 Problemas?

### Não consegue conectar ao banco?

1. Verifique se o PostgreSQL aceita conexões remotas
2. Verifique o firewall (porta 5432)
3. Teste a conexão:
```bash
psql -h 192.168.25.100 -U postgres -p 5432 -c "SELECT version();"
```

### Porta em uso?

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

## 📚 Documentação Completa

Veja [SETUP.md](SETUP.md) para instruções detalhadas.

---

## 🎉 Pronto!

Sistema configurado e rodando! 🚀

**Acesse**: http://localhost:5001
