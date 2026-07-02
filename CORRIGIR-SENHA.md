# 🔧 CORRIGIR SENHA DO POSTGRESQL - PASSO A PASSO

## ❌ PROBLEMA ATUAL

```
error: autenticação do tipo senha falhou para o usuário "postgres"
```

A senha `Vsi@#$3303Vsi` no arquivo `backend/.env` está **INCORRETA** para o PostgreSQL local.

---

## ✅ SOLUÇÃO RÁPIDA (3 Passos)

### **PASSO 1: Descobrir a Senha Correta**

Abra o **CMD** ou **PowerShell** e teste estas senhas comuns:

```bash
# Teste 1: senha "postgres"
psql -U postgres -c "SELECT 1"
# Digite: postgres

# Teste 2: senha "admin"  
psql -U postgres -c "SELECT 1"
# Digite: admin

# Teste 3: senha vazia (apenas Enter)
psql -U postgres -c "SELECT 1"
# Apenas pressione Enter

# Teste 4: senha "root"
psql -U postgres -c "SELECT 1"
# Digite: root
```

**Quando uma senha funcionar**, você verá algo como:
```
 ?column? 
----------
        1
(1 row)
```

✅ **Anote essa senha!**

---

### **PASSO 2: Atualizar o Arquivo .env**

1. Abra o arquivo: `backend/.env`

2. Encontre a linha:
```env
DATABASE_PASSWORD=Vsi@#$3303Vsi
```

3. Substitua pela senha que funcionou:
```env
DATABASE_PASSWORD=postgres
```
(ou a senha que você descobriu)

4. **Salve o arquivo**

---

### **PASSO 3: Criar o Banco e Iniciar**

Execute estes comandos na ordem:

```bash
# 1. Criar o banco de dados
setup-db.bat

# 2. Iniciar o sistema
start.bat
```

---

## 🎯 RESUMO VISUAL

```
┌─────────────────────────────────────┐
│  1. Descobrir senha do PostgreSQL   │
│     psql -U postgres -c "SELECT 1"  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Editar backend/.env             │
│     DATABASE_PASSWORD=SUA_SENHA     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Executar setup-db.bat           │
│     Depois executar start.bat       │
└─────────────────────────────────────┘
```

---

## 🔍 SENHAS MAIS COMUNS

Tente nesta ordem:
1. ✅ `postgres` (mais comum)
2. ✅ `admin`
3. ✅ (vazio - apenas Enter)
4. ✅ `root`
5. ✅ `password`

---

## 💡 ALTERNATIVA: Script Automático

Se preferir, execute:
```bash
fix-senha.bat
```

Este script testa as senhas automaticamente e atualiza o `.env` para você.

---

## 🆘 AINDA NÃO FUNCIONA?

### Opção 1: Resetar a Senha do PostgreSQL

1. Abra o arquivo: `C:\Program Files\PostgreSQL\[versão]\data\pg_hba.conf`
2. Encontre a linha: `host all all 127.0.0.1/32 md5`
3. Mude para: `host all all 127.0.0.1/32 trust`
4. Reinicie o PostgreSQL
5. Conecte sem senha e mude a senha:
```sql
psql -U postgres
ALTER USER postgres PASSWORD 'nova_senha';
```
6. Volte o `pg_hba.conf` para `md5`
7. Reinicie o PostgreSQL novamente

### Opção 2: Usar Outro Usuário

Se você tem outro usuário do PostgreSQL, edite o `.env`:
```env
DATABASE_USER=seu_usuario
DATABASE_PASSWORD=sua_senha
```

---

## ✅ COMO SABER SE FUNCIONOU?

Quando a senha estiver correta, você verá:

```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] LOG [NestApplication] Nest application successfully started
```

**SEM** a mensagem de erro: `autenticação do tipo senha falhou`

---

## 📞 PRÓXIMOS PASSOS

Depois de corrigir a senha:

1. ✅ `setup-db.bat` - Cria o banco de dados
2. ✅ `start.bat` - Inicia backend (porta 5000) e frontend (porta 5001)
3. ✅ Acesse: http://localhost:5001

**Login padrão:**
- Email: `admin@gestao.com`
- Senha: `admin123`

---

## 🎉 PRONTO!

Após seguir estes passos, seu sistema estará funcionando! 🚀
