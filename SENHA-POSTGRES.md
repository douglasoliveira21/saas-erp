# 🔐 Configurar Senha do PostgreSQL

## ❌ Problema

A senha configurada (`Vsi@#$3303Vsi`) não está funcionando com o PostgreSQL local.

## ✅ Soluções

### Opção 1: Usar o Configurador Automático (RECOMENDADO)

Execute o script interativo:

```bash
configure-db.bat
```

Este script vai:
1. Perguntar qual PostgreSQL usar (local ou remoto)
2. Solicitar a senha correta
3. Testar a conexão
4. Criar o banco automaticamente

---

### Opção 2: Descobrir a Senha do PostgreSQL

#### Windows

1. **Verificar se PostgreSQL aceita sem senha:**
```bash
psql -U postgres
```

2. **Se pedir senha, tente as senhas comuns:**
   - `postgres`
   - `admin`
   - `root`
   - (vazio - apenas Enter)

3. **Resetar a senha (se necessário):**

   a. Abra o arquivo `pg_hba.conf`:
   ```
   C:\Program Files\PostgreSQL\14\data\pg_hba.conf
   ```

   b. Encontre a linha:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   ```

   c. Mude para:
   ```
   host    all             all             127.0.0.1/32            trust
   ```

   d. Reinicie o PostgreSQL:
   ```bash
   net stop postgresql-x64-14
   net start postgresql-x64-14
   ```

   e. Conecte sem senha e altere:
   ```bash
   psql -U postgres
   ALTER USER postgres PASSWORD 'nova_senha';
   ```

   f. Volte o `pg_hba.conf` para `scram-sha-256`

---

### Opção 3: Configurar Manualmente

Edite o arquivo `backend/.env`:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=SUA_SENHA_AQUI
DATABASE_NAME=gestao_ti
```

Substitua `SUA_SENHA_AQUI` pela senha correta do seu PostgreSQL.

---

### Opção 4: Usar Outro Usuário

Se você tem outro usuário no PostgreSQL:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=seu_usuario
DATABASE_PASSWORD=sua_senha
DATABASE_NAME=gestao_ti
```

---

## 🧪 Testar Conexão

Depois de configurar, teste:

```bash
# Windows
set PGPASSWORD=sua_senha
psql -U postgres -c "SELECT version();"
```

Se funcionar, você verá a versão do PostgreSQL.

---

## 🚀 Após Configurar

1. **Criar banco:**
```bash
setup-db.bat
```

2. **Iniciar sistema:**
```bash
start.bat
```

---

## 💡 Senhas Comuns do PostgreSQL

Tente estas senhas (em ordem):

1. `postgres` (mais comum)
2. `admin`
3. `root`
4. `password`
5. `12345`
6. (vazio - sem senha)
7. A senha que você definiu na instalação

---

## 🆘 Ainda com Problemas?

### Reinstalar PostgreSQL

Se nada funcionar, considere reinstalar o PostgreSQL:

1. Desinstale o PostgreSQL atual
2. Baixe em: https://www.postgresql.org/download/windows/
3. Durante a instalação, **anote a senha** que você definir
4. Use essa senha no arquivo `.env`

---

## 📞 Suporte

Execute o configurador automático:
```bash
configure-db.bat
```

Ele vai guiar você passo a passo! 🎯
