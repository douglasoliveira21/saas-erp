# 🔧 PROBLEMA DE AUTENTICAÇÃO POSTGRESQL

## 🎯 SITUAÇÃO

Você consegue conectar com `psql` mas o NestJS falha com:
```
error: autenticação do tipo senha falhou para o usuário "postgres"
```

## 🔍 CAUSA PROVÁVEL

O PostgreSQL tem **dois métodos de autenticação diferentes**:

1. **`trust`** - Sem senha (usado pelo `psql` localmente)
2. **`md5`** ou **`scram-sha-256`** - Com senha (usado por aplicações)

O `psql` pode estar usando `trust` (sem senha), mas o NestJS precisa de autenticação com senha.

---

## ✅ SOLUÇÃO RÁPIDA

### PASSO 1: Executar Diagnóstico

```bash
diagnostico.bat
```

Este script vai:
- ✅ Testar a conexão usando a mesma biblioteca do NestJS
- ✅ Testar várias senhas automaticamente
- ✅ Atualizar o `.env` automaticamente se encontrar a senha
- ✅ Mostrar exatamente qual é o problema

---

## 🔧 SOLUÇÃO MANUAL

Se o diagnóstico não resolver, siga estes passos:

### 1. Verificar o arquivo pg_hba.conf

**Localização:**
```
C:\Program Files\PostgreSQL\14\data\pg_hba.conf
```
(Mude `14` para sua versão do PostgreSQL)

**Abra o arquivo e procure por linhas como:**
```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             127.0.0.1/32            trust
host    all             all             127.0.0.1/32            md5
host    all             all             127.0.0.1/32            scram-sha-256
```

### 2. Entender os Métodos

| Método | Descrição | Precisa Senha? |
|--------|-----------|----------------|
| `trust` | Sem autenticação | ❌ Não |
| `md5` | Senha com hash MD5 | ✅ Sim |
| `scram-sha-256` | Senha com hash SHA-256 | ✅ Sim |

### 3. Configurar para Aceitar Senha

**Opção A: Usar senha vazia (não recomendado para produção)**

1. Abra `pg_hba.conf`
2. Encontre a linha: `host all all 127.0.0.1/32 md5`
3. Mude para: `host all all 127.0.0.1/32 trust`
4. Salve o arquivo
5. Reinicie o PostgreSQL:
   ```bash
   net stop postgresql-x64-14
   net start postgresql-x64-14
   ```
6. No `.env`, deixe a senha vazia:
   ```env
   DATABASE_PASSWORD=
   ```

**Opção B: Definir uma senha (recomendado)**

1. Abra `pg_hba.conf`
2. Mude temporariamente para `trust`:
   ```
   host all all 127.0.0.1/32 trust
   ```
3. Reinicie o PostgreSQL
4. Conecte sem senha:
   ```bash
   psql -U postgres
   ```
5. Defina uma senha:
   ```sql
   ALTER USER postgres PASSWORD 'postgres';
   \q
   ```
6. Volte o `pg_hba.conf` para `md5`:
   ```
   host all all 127.0.0.1/32 md5
   ```
7. Reinicie o PostgreSQL novamente
8. Atualize o `.env`:
   ```env
   DATABASE_PASSWORD=postgres
   ```

---

## 🎯 VERIFICAR SE FUNCIONOU

Após fazer as mudanças, teste:

```bash
# Teste 1: Com psql
psql -U postgres -c "SELECT 1"

# Teste 2: Com o diagnóstico
diagnostico.bat

# Teste 3: Iniciar o sistema
start.bat
```

Se o NestJS iniciar sem erros de autenticação, funcionou! ✅

---

## 🔍 COMANDOS ÚTEIS

### Ver versão do PostgreSQL
```bash
psql --version
```

### Ver onde está o pg_hba.conf
```bash
psql -U postgres -c "SHOW hba_file"
```

### Reiniciar PostgreSQL (Windows)
```bash
# Parar
net stop postgresql-x64-14

# Iniciar
net start postgresql-x64-14

# Ou use o Gerenciador de Serviços
services.msc
```

### Testar conexão com senha específica
```bash
set PGPASSWORD=sua_senha
psql -U postgres -c "SELECT 1"
```

---

## 📋 CHECKLIST DE DIAGNÓSTICO

- [ ] PostgreSQL está rodando?
  ```bash
  sc query postgresql-x64-14
  ```

- [ ] Qual método de autenticação está configurado?
  ```bash
  psql -U postgres -c "SHOW hba_file"
  # Depois abra o arquivo e veja o método
  ```

- [ ] A senha no `.env` está correta?
  ```bash
  # Veja o arquivo
  type backend\.env
  ```

- [ ] O diagnóstico encontra a senha?
  ```bash
  diagnostico.bat
  ```

- [ ] A conexão funciona com a biblioteca `pg`?
  ```bash
  node diagnostico-conexao.js
  ```

---

## 🆘 AINDA NÃO FUNCIONA?

### Problema: "psql não é reconhecido"

**Solução:** Adicione o PostgreSQL ao PATH:
```
C:\Program Files\PostgreSQL\14\bin
```

### Problema: "Acesso negado ao pg_hba.conf"

**Solução:** Abra o editor de texto como Administrador

### Problema: "Não consigo reiniciar o PostgreSQL"

**Solução:** Use o Gerenciador de Serviços:
1. Pressione `Win + R`
2. Digite `services.msc`
3. Procure por "postgresql"
4. Clique com botão direito → Reiniciar

### Problema: "Senha vazia não funciona"

**Solução:** O PostgreSQL pode estar configurado para exigir senha. Use a Opção B acima para definir uma senha.

---

## 💡 ENTENDENDO O PROBLEMA

### Por que `psql` funciona mas NestJS não?

O `psql` pode usar diferentes métodos de autenticação:

1. **Conexão local via socket Unix** (sem senha)
2. **Conexão via TCP com `trust`** (sem senha)
3. **Conexão via TCP com senha**

O NestJS **sempre** usa conexão TCP, então precisa que o método de autenticação esteja configurado corretamente no `pg_hba.conf`.

### Arquivo pg_hba.conf

Este arquivo controla **quem** pode conectar e **como**:

```
# Tipo  Banco   Usuário  Endereço         Método
host    all     all      127.0.0.1/32     md5
```

- **host**: Conexão TCP/IP
- **all**: Todos os bancos
- **all**: Todos os usuários
- **127.0.0.1/32**: Apenas localhost
- **md5**: Requer senha com hash MD5

---

## 🎯 RESUMO

1. Execute: `diagnostico.bat`
2. Se não resolver, edite `pg_hba.conf`
3. Defina uma senha ou use `trust`
4. Reinicie o PostgreSQL
5. Atualize o `.env`
6. Execute: `start.bat`

---

## ✅ SUCESSO!

Quando funcionar, você verá:

```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] LOG [NestApplication] Nest application successfully started
```

**SEM** erros de autenticação! 🎉

---

## 📞 PRÓXIMOS PASSOS

Após resolver:

1. ✅ `setup-db.bat` - Criar o banco
2. ✅ `start.bat` - Iniciar o sistema
3. ✅ Acessar: http://localhost:5001

Boa sorte! 🚀
