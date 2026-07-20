# 🎯 LEIA-ME PRIMEIRO

## ⚡ Setup Rápido - 3 Comandos

### Windows:
```bash
npm run install:all
setup-db.bat
start.bat
```

### Linux/Mac:
```bash
npm run install:all
chmod +x setup-db.sh start.sh
./setup-db.sh
./start.sh
```

---

## 🌐 Acessar o Sistema

**Frontend**: http://localhost:5001  
**API**: http://localhost:5000/api

**Login**: admin@empresa.com / Admin@123

---

## 📋 Configuração Atual

### Banco de Dados
- **Servidor**: 192.168.25.100
- **Porta**: 5432
- **Usuário**: postgres
- **Senha**: Vsi@#$3303Vsi
- **Database**: gestao_ti

### Aplicação
- **Backend**: Porta 5000
- **Frontend**: Porta 5001

---

## 📚 Documentação

- **[QUICK_SETUP.md](QUICK_SETUP.md)** - Setup rápido
- **[SETUP.md](SETUP.md)** - Setup detalhado
- **[README.md](README.md)** - Documentação completa

---

## ✅ O Que Fazer Agora

1. **Instalar dependências**: `npm run install:all`
2. **Criar banco**: Execute `setup-db.bat` (Windows) ou `./setup-db.sh` (Linux/Mac)
3. **Iniciar sistema**: Execute `start.bat` (Windows) ou `./start.sh` (Linux/Mac)
4. **Acessar**: http://localhost:5001
5. **Login**: admin@empresa.com / Admin@123

---

## 🆘 Problemas?

### Erro ao conectar no banco?

Verifique se o PostgreSQL em 192.168.25.100 está:
- Rodando
- Aceitando conexões remotas
- Firewall liberado na porta 5432

Teste a conexão:
```bash
psql -h 192.168.25.100 -U postgres -p 5432 -c "SELECT version();"
```

### Porta em uso?

**Backend (5000):**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**Frontend (5001):**
```bash
# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

---

## 📞 Suporte

Consulte a documentação completa em [SETUP.md](SETUP.md)

---

## 🎉 Pronto!

Após executar os 3 comandos, o sistema estará rodando! 🚀
