# 🚀 Setup do Sistema

## Configuração Atual

### Banco de Dados
- **Host**: 192.168.25.100
- **Porta**: 5432
- **Usuário**: postgres
- **Senha**: Vsi@#$3303Vsi
- **Database**: gestao_ti

### Portas da Aplicação
- **Backend**: 5000
- **Frontend**: 5001

## 📋 Passo a Passo

### 1. Criar o Banco de Dados

#### Opção A: Via psql (Recomendado)

```bash
# Conectar ao PostgreSQL no servidor remoto
psql -h 192.168.25.100 -U postgres -p 5432

# Executar o script de criação
\i setup-database.sql

# Ou copiar e colar o conteúdo do arquivo
```

#### Opção B: Via comando direto

```bash
# Executar o script remotamente
psql -h 192.168.25.100 -U postgres -p 5432 -f setup-database.sql
```

#### Opção C: Via pgAdmin ou DBeaver

1. Conecte-se ao servidor 192.168.25.100
2. Abra o arquivo `setup-database.sql`
3. Execute o script

### 2. Instalar Dependências

```bash
# Instalar todas as dependências
npm run install:all

# Ou instalar separadamente
cd backend && npm install
cd ../frontend && npm install
```

### 3. Executar Seeds (Dados Iniciais)

```bash
cd backend
npm run seed
```

Isso criará:
- 4 usuários (1 admin, 1 financeiro, 2 técnicos)
- 3 clientes de exemplo
- 10 produtos
- 10 serviços

### 4. Iniciar o Sistema

#### Opção A: Tudo junto

```bash
# Na raiz do projeto
npm run dev
```

#### Opção B: Separadamente

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

### 5. Acessar o Sistema

- **Frontend**: http://localhost:5001
- **Backend API**: http://localhost:5000/api

### 6. Fazer Login

Use um dos usuários padrão:

| Perfil | Email | Senha |
|--------|-------|-------|
| **Admin** | admin@empresa.com | Admin@123 |
| **Financeiro** | financeiro@empresa.com | Financeiro@123 |
| **Técnico** | tecnico@empresa.com | Tecnico@123 |

## 🔧 Verificações

### Verificar Conexão com o Banco

```bash
# Testar conexão
psql -h 192.168.25.100 -U postgres -p 5432 -d gestao_ti -c "SELECT COUNT(*) FROM users;"
```

Deve retornar 4 (número de usuários criados).

### Verificar Backend

```bash
# Testar se o backend está respondendo
curl http://localhost:5000/api
```

### Verificar Frontend

Abra o navegador em: http://localhost:5001

## 🐛 Solução de Problemas

### Erro: "Cannot connect to database"

**Causa**: Não consegue conectar ao PostgreSQL remoto.

**Soluções**:

1. Verifique se o PostgreSQL está aceitando conexões remotas:
```bash
# No servidor 192.168.25.100, edite postgresql.conf
listen_addresses = '*'
```

2. Verifique o pg_hba.conf:
```bash
# Adicione esta linha
host    all             all             0.0.0.0/0               md5
```

3. Reinicie o PostgreSQL:
```bash
sudo systemctl restart postgresql
```

4. Verifique o firewall:
```bash
# Permitir porta 5432
sudo ufw allow 5432/tcp
```

### Erro: "Port 5000 already in use"

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Erro: "Port 5001 already in use"

```bash
# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5001 | xargs kill -9
```

### Erro ao executar seeds

```bash
# Resetar banco e executar novamente
psql -h 192.168.25.100 -U postgres -p 5432 -f setup-database.sql
cd backend && npm run seed
```

## 📝 Arquivos de Configuração

### backend/.env
```env
DATABASE_HOST=192.168.25.100
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

## ✅ Checklist de Setup

- [ ] PostgreSQL acessível em 192.168.25.100
- [ ] Banco de dados `gestao_ti` criado
- [ ] Tabelas criadas (8 tabelas)
- [ ] Seeds executados (dados iniciais)
- [ ] Dependências instaladas (backend + frontend)
- [ ] Arquivo .env configurado (backend)
- [ ] Arquivo .env configurado (frontend)
- [ ] Backend rodando na porta 5000
- [ ] Frontend rodando na porta 5001
- [ ] Login funcionando

## 🎉 Pronto!

Se todos os passos foram concluídos, o sistema está funcionando!

Acesse: **http://localhost:5001**

Login: **admin@empresa.com** / **Admin@123**

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do backend
2. Verifique os logs do frontend
3. Verifique a conexão com o banco
4. Consulte a documentação completa

**Documentação**: [README.md](README.md)
