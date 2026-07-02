# 🔴 Erro de Conexão com PostgreSQL

## Problema

```
nenhuma entrada em pg_hba.conf para o hospedeiro "192.168.25.100"
```

O PostgreSQL no servidor **192.168.25.100** não está configurado para aceitar conexões remotas.

---

## ⚡ Solução Rápida

### Você tem acesso ao servidor 192.168.25.100?

#### ✅ SIM - Siga estes passos:

1. **Acesse o servidor** 192.168.25.100

2. **Edite o arquivo pg_hba.conf:**
   - Linux: `/etc/postgresql/14/main/pg_hba.conf`
   - Windows: `C:\Program Files\PostgreSQL\14\data\pg_hba.conf`

3. **Adicione esta linha no final:**
   ```
   host    all    all    192.168.25.0/24    md5
   ```

4. **Edite o arquivo postgresql.conf:**
   - Linux: `/etc/postgresql/14/main/postgresql.conf`
   - Windows: `C:\Program Files\PostgreSQL\14\data\postgresql.conf`

5. **Encontre e altere:**
   ```
   listen_addresses = '*'
   ```

6. **Reinicie o PostgreSQL:**
   - Linux: `sudo systemctl restart postgresql`
   - Windows: Reinicie o serviço "postgresql-x64-14"

7. **Libere o firewall (porta 5432)**

8. **Teste a conexão:**
   ```bash
   test-connection.bat
   ```

#### ❌ NÃO - Peça ao administrador:

Envie este email para o administrador do servidor:

```
Assunto: Liberar acesso PostgreSQL

Olá,

Preciso acessar o PostgreSQL no servidor 192.168.25.100.

Por favor, configure:

1. No arquivo pg_hba.conf, adicione:
   host    all    all    192.168.25.0/24    md5

2. No arquivo postgresql.conf, configure:
   listen_addresses = '*'

3. Reinicie o PostgreSQL

4. Libere a porta 5432 no firewall

Banco: gestao_ti
Usuário: postgres

Obrigado!
```

---

## 🔄 Alternativa: Banco Local

Se não conseguir configurar o servidor remoto, use um banco local:

### 1. Instalar PostgreSQL localmente

Baixe em: https://www.postgresql.org/download/

### 2. Alterar configuração

Edite `backend/.env`:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=sua_senha_local
DATABASE_NAME=gestao_ti
```

### 3. Criar banco local

```bash
createdb gestao_ti
setup-db-local.bat
```

---

## 📞 Precisa de Ajuda?

Consulte: **[CONFIGURAR_POSTGRESQL.md](CONFIGURAR_POSTGRESQL.md)**

Ou execute: `test-connection.bat` para testar a conexão.
