# 🚀 CONFIGURAR SUPABASE - Guia Completo

## 📊 INFORMAÇÕES DO SEU PROJETO SUPABASE

```
Project URL: https://opayspeyfojslopnczjn.supabase.co
Database Host: db.opayspeyfojslopnczjn.supabase.co
Database Port: 5432
Database Name: postgres
Database User: postgres
Publishable Key: sb_publishable_5U35GEQYmqQsip3fNpdwKA_HGCOgUcuDIRECT
```

---

## ✅ CONFIGURAÇÃO RÁPIDA (3 Passos)

### PASSO 1: Obter a Senha do Supabase

1. Acesse: https://opayspeyfojslopnczjn.supabase.co
2. Vá em: **Settings** → **Database**
3. Procure por: **Database Password** ou **Connection String**
4. Copie a senha (ou resete se necessário)

### PASSO 2: Executar Script de Configuração

```bash
setup-supabase.bat
```

O script vai pedir a senha e configurar tudo automaticamente!

### PASSO 3: Iniciar o Sistema

```bash
start.bat
```

**Pronto!** Acesse: http://localhost:5001

---

## 🔧 CONFIGURAÇÃO MANUAL

Se preferir configurar manualmente:

### 1. Editar backend/.env

```env
DATABASE_HOST=db.opayspeyfojslopnczjn.supabase.co
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=SUA_SENHA_SUPABASE_AQUI
DATABASE_NAME=postgres

JWT_SECRET=8f3a9c2e1d7b6f4a5e8c9d2f1a3b7e6c4d8f2a9e1c7b5d3f6a8e2c4d9f1b7a3e
JWT_EXPIRES_IN=7d

PORT=5000
NODE_ENV=development

CORS_ORIGIN=http://localhost:5001

# Supabase Configuration
SUPABASE_URL=https://opayspeyfojslopnczjn.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_5U35GEQYmqQsip3fNpdwKA_HGCOgUcuDIRECT
```

### 2. Testar Conexão

```bash
node testar-conexao-supabase.js
```

### 3. Criar Tabelas

**Opção A: Via TypeORM (Recomendado)**
```bash
cd backend
npm run migration:run
```

**Opção B: Via SQL Direto**
```bash
psql "postgresql://postgres:SUA_SENHA@db.opayspeyfojslopnczjn.supabase.co:5432/postgres" -f database/schema.sql
```

**Opção C: Via Supabase Dashboard**
1. Acesse: https://opayspeyfojslopnczjn.supabase.co
2. Vá em: **SQL Editor**
3. Cole o conteúdo de `backend/database/schema.sql`
4. Execute

### 4. Inserir Dados Iniciais

```bash
cd backend
npm run seed
```

### 5. Iniciar Sistema

```bash
start.bat
```

---

## 🔍 ONDE ENCONTRAR A SENHA DO SUPABASE

### Método 1: Dashboard do Supabase

1. Acesse: https://app.supabase.com
2. Selecione seu projeto: **opayspeyfojslopnczjn**
3. Vá em: **Settings** (ícone de engrenagem)
4. Clique em: **Database**
5. Role até: **Connection string** ou **Database Password**
6. Copie a senha

### Método 2: Connection String

Se você tem a connection string completa:
```
postgresql://postgres:SUA_SENHA_AQUI@db.opayspeyfojslopnczjn.supabase.co:5432/postgres
```

A senha está entre `:` e `@`

### Método 3: Resetar Senha

Se você não lembra a senha:

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em: **Settings** → **Database**
4. Clique em: **Reset Database Password**
5. Copie a nova senha
6. ⚠️ **IMPORTANTE:** Salve a senha em local seguro!

---

## 🧪 TESTAR A CONFIGURAÇÃO

### Teste 1: Conexão Básica

```bash
node testar-conexao-supabase.js
```

**Resultado esperado:**
```
✅ CONEXÃO COM SUPABASE FUNCIONANDO!
```

### Teste 2: Verificar Tabelas

```bash
cd backend
npm run typeorm schema:log
```

### Teste 3: Iniciar Backend

```bash
cd backend
npm run start:dev
```

**Resultado esperado:**
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] LOG [NestApplication] Nest application successfully started
```

---

## 📋 ESTRUTURA DO BANCO DE DADOS

O sistema vai criar estas tabelas no Supabase:

| Tabela | Descrição |
|--------|-----------|
| **users** | Usuários do sistema |
| **customers** | Clientes |
| **products** | Produtos |
| **services** | Serviços |
| **sales** | Vendas |
| **sale_items** | Itens das vendas |
| **commissions** | Comissões |
| **stock_movements** | Movimentações de estoque |
| **audit_logs** | Log de auditoria |

---

## 🔐 SEGURANÇA

### SSL/TLS

O Supabase **requer** conexão SSL. O sistema já está configurado para usar SSL automaticamente quando detecta `supabase.co` no host.

### Variáveis de Ambiente

**NUNCA** commite o arquivo `.env` com senhas reais!

O arquivo `.env.example` serve como template sem dados sensíveis.

### Row Level Security (RLS)

O Supabase tem RLS (Row Level Security) que pode bloquear queries. Para desenvolvimento, você pode desabilitar:

1. Acesse: Supabase Dashboard → **Authentication** → **Policies**
2. Desabilite RLS nas tabelas ou crie políticas apropriadas

---

## 🆘 PROBLEMAS COMUNS

### ❌ Erro: "password authentication failed"

**Causa:** Senha incorreta

**Solução:**
1. Verifique a senha no Supabase Dashboard
2. Atualize o arquivo `backend/.env`
3. Execute: `node testar-conexao-supabase.js`

### ❌ Erro: "no pg_hba.conf entry"

**Causa:** IP não autorizado

**Solução:**
1. Acesse: Supabase Dashboard → **Settings** → **Database**
2. Em **Connection Pooling**, adicione seu IP
3. Ou use **Connection Pooling** em vez de **Direct Connection**

### ❌ Erro: "SSL connection required"

**Causa:** SSL não configurado

**Solução:** O sistema já está configurado para SSL. Verifique se o arquivo `database.config.ts` tem a configuração SSL.

### ❌ Erro: "Project is paused"

**Causa:** Projeto Supabase pausado (plano gratuito)

**Solução:**
1. Acesse: https://opayspeyfojslopnczjn.supabase.co
2. Clique em **Resume Project**
3. Aguarde alguns minutos

### ❌ Erro: "too many connections"

**Causa:** Limite de conexões atingido

**Solução:**
1. Use **Connection Pooling** do Supabase
2. Ou aumente o limite no plano pago

---

## 🎯 DIFERENÇAS: PostgreSQL Local vs Supabase

| Aspecto | PostgreSQL Local | Supabase |
|---------|------------------|----------|
| **Host** | localhost | db.opayspeyfojslopnczjn.supabase.co |
| **SSL** | Opcional | Obrigatório |
| **Porta** | 5432 | 5432 (ou 6543 para pooling) |
| **Banco** | gestao_ti | postgres |
| **Acesso** | Local | Internet |
| **Backup** | Manual | Automático |
| **Escalabilidade** | Limitada | Automática |

---

## 📊 VANTAGENS DO SUPABASE

✅ **Hospedagem na nuvem** - Acesso de qualquer lugar
✅ **Backup automático** - Seus dados estão seguros
✅ **Escalabilidade** - Cresce com seu negócio
✅ **Dashboard visual** - Gerencie dados facilmente
✅ **API REST automática** - Endpoints prontos
✅ **Realtime** - Atualizações em tempo real
✅ **Authentication** - Sistema de auth integrado
✅ **Storage** - Armazenamento de arquivos

---

## 🎓 DADOS DE TESTE

Após executar o seed, você terá:

### Usuários

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@gestao.com | admin123 | Administrador |
| financeiro@gestao.com | financeiro123 | Financeiro |
| tecnico@gestao.com | tecnico123 | Técnico |

### Dados de Exemplo

- 5 clientes
- 10 produtos
- 5 serviços
- Algumas vendas de exemplo
- Comissões calculadas

---

## 🔄 MIGRAÇÃO DE DADOS

Se você já tem dados no PostgreSQL local e quer migrar para Supabase:

### Opção 1: Dump e Restore

```bash
# 1. Fazer dump do banco local
pg_dump -U postgres gestao_ti > backup.sql

# 2. Restaurar no Supabase
psql "postgresql://postgres:SUA_SENHA@db.opayspeyfojslopnczjn.supabase.co:5432/postgres" < backup.sql
```

### Opção 2: Via Supabase Dashboard

1. Exporte dados do PostgreSQL local (CSV ou SQL)
2. Acesse: Supabase Dashboard → **SQL Editor**
3. Execute os comandos SQL ou importe CSVs

---

## 📞 PRÓXIMOS PASSOS

Após configurar o Supabase:

1. ✅ Execute: `setup-supabase.bat`
2. ✅ Execute: `start.bat`
3. ✅ Acesse: http://localhost:5001
4. ✅ Faça login com: admin@gestao.com / admin123
5. ✅ Explore o sistema!

---

## 🎉 PRONTO!

Seu sistema agora está usando **Supabase** como banco de dados! 🚀

**Benefícios:**
- ✅ Acesso de qualquer lugar
- ✅ Backup automático
- ✅ Escalabilidade
- ✅ Dashboard visual
- ✅ Sem problemas de senha local

**Aproveite!** 🎊
