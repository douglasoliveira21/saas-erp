# 🔧 Configurar PostgreSQL para Aceitar Conexões Remotas

## 🔴 Erro Atual

```
nenhuma entrada em pg_hba.conf para o hospedeiro "192.168.25.100", 
usuário "postgres", banco de dados "gestao_ti", sem encriptação
```

Isso significa que o PostgreSQL não está configurado para aceitar sua conexão.

---

## ✅ SOLUÇÃO - Configurar no Servidor PostgreSQL (192.168.25.100)

### Passo 1: Conectar ao Servidor

Conecte-se ao servidor 192.168.25.100 (via SSH, RDP ou acesso físico).

### Passo 2: Editar postgresql.conf

**Localização do arquivo:**
- Linux: `/etc/postgresql/14/main/postgresql.conf`
- Windows: `C:\Program Files\PostgreSQL\14\data\postgresql.conf`

**Editar:**
```bash
# Linux
sudo nano /etc/postgresql/14/main/postgresql.conf

# Windows (como Administrador)
notepad "C:\Program Files\PostgreSQL\14\data\postgresql.conf"
```

**Encontre e altere:**
```conf
# Antes:
#listen_addresses = 'localhost'

# Depois:
listen_addresses = '*'
```

### Passo 3: Editar pg_hba.conf

**Localização do arquivo:**
- Linux: `/etc/postgresql/14/main/pg_hba.conf`
- Windows: `C:\Program Files\PostgreSQL\14\data\pg_hba.conf`

**Editar:**
```bash
# Linux
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Windows (como Administrador)
notepad "C:\Program Files\PostgreSQL\14\data\pg_hba.conf"
```

**Adicione no final do arquivo:**

```conf
# Permitir conexões da rede local
host    all             all             192.168.25.0/24         md5

# Ou permitir de qualquer IP (menos seguro)
host    all             all             0.0.0.0/0               md5
```

**Explicação:**
- `host` = tipo de conexão TCP/IP
- `all` = todos os bancos de dados
- `all` = todos os usuários
- `192.168.25.0/24` = permite toda a rede 192.168.25.x
- `md5` = autenticação com senha

### Passo 4: Reiniciar PostgreSQL

**Linux:**
```bash
sudo systemctl restart postgresql
# ou
sudo service postgresql restart
```

**Windows:**
1. Abra "Serviços" (services.msc)
2. Encontre "postgresql-x64-14"
3. Clique com botão direito > Reiniciar

### Passo 5: Configurar Firewall

**Linux (Ubuntu/Debian):**
```bash
sudo ufw allow 5432/tcp
```

**Windows:**
1. Abra "Firewall do Windows com Segurança Avançada"
2. Clique em "Regras de Entrada"
3. Clique em "Nova Regra..."
4. Tipo: Porta
5. Protocolo: TCP
6. Porta: 5432
7. Ação: Permitir conexão
8. Nome: PostgreSQL

---

## 🧪 Testar Conexão

Do seu computador (192.168.25.100), teste:

```bash
psql -h 192.168.25.100 -U postgres -d postgres -c "SELECT version();"
```

Se pedir senha, digite: `Vsi@#$3303Vsi`

Se funcionar, verá a versão do PostgreSQL.

---

## 🔒 Configuração Mais Segura (Recomendado)

Se souber o IP exato do seu computador, use-o especificamente:

```conf
# No pg_hba.conf, substitua por:
host    gestao_ti       postgres        192.168.25.XXX/32       md5
```

Onde `XXX` é o último octeto do seu IP.

---

## 📋 Checklist

- [ ] Editou postgresql.conf (listen_addresses = '*')
- [ ] Editou pg_hba.conf (adicionou regra host)
- [ ] Reiniciou PostgreSQL
- [ ] Configurou firewall (porta 5432)
- [ ] Testou conexão com psql

---

## 🆘 Ainda Não Funciona?

### Verificar se PostgreSQL está rodando:

**Linux:**
```bash
sudo systemctl status postgresql
```

**Windows:**
```bash
sc query postgresql-x64-14
```

### Verificar porta 5432:

**Linux:**
```bash
sudo netstat -tlnp | grep 5432
```

**Windows:**
```bash
netstat -an | findstr :5432
```

### Ver logs do PostgreSQL:

**Linux:**
```bash
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

**Windows:**
```
C:\Program Files\PostgreSQL\14\data\log\
```

---

## 🔄 Alternativa: Usar Túnel SSH

Se não puder alterar as configurações do servidor, use um túnel SSH:

```bash
ssh -L 5432:localhost:5432 usuario@192.168.25.100
```

Depois altere o .env para:
```env
DATABASE_HOST=localhost
```

---

## 📞 Precisa de Ajuda?

Entre em contato com o administrador do servidor PostgreSQL (192.168.25.100) e peça para:

1. Permitir conexões remotas no PostgreSQL
2. Adicionar seu IP no pg_hba.conf
3. Liberar porta 5432 no firewall

---

## ✅ Após Configurar

Execute novamente:
```bash
npm run dev
```

O sistema deve conectar ao banco de dados! 🎉
