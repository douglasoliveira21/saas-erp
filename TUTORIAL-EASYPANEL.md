# Tutorial Completo: Deploy do SaaS ERP no EasyPanel (Para Iniciantes)

## O que você vai precisar

- Um servidor VPS (DigitalOcean, Hetzner, Contabo, etc.) com no mínimo 2GB RAM
- EasyPanel instalado no servidor
- Conta no GitHub (o código já está em: https://github.com/douglasoliveira21/saas-erp)

---

## Etapa 1: Instalar o EasyPanel no Servidor

Se ainda não tem o EasyPanel instalado, acesse seu servidor via SSH e rode:

```bash
curl -sSL https://get.easypanel.io | sh
```

Após a instalação, acesse: `http://IP-DO-SEU-SERVIDOR:3000`

Crie sua conta de administrador no primeiro acesso.

---

## Etapa 2: Criar o Projeto

1. No painel do EasyPanel, clique em **"+ Create Project"**
2. No campo nome, digite: `saas-erp`
3. Clique em **"Create"**

![Criar Projeto](https://i.imgur.com/placeholder.png)

---

## Etapa 3: Criar o Banco de Dados PostgreSQL

1. Dentro do projeto `saas-erp`, clique em **"+ Create Service"**
2. Selecione **"Postgres"** (na seção Databases)
3. Configure:
   - **Service Name:** `db`
   - **Image:** `postgres:16` (já vem preenchido)
   - **Password:** Clique para gerar ou defina uma senha forte (ANOTE ESSA SENHA!)
   - **Database:** `gestao_ti`
   - **User:** `postgres`
4. Clique em **"Create"**
5. Aguarde o status ficar **verde (Running)**

> ⚠️ **IMPORTANTE:** Anote a senha que você definiu. Você vai precisar dela nos próximos passos.

---

## Etapa 4: Criar o Serviço Backend (API)

1. Clique em **"+ Create Service"**
2. Selecione **"App"**
3. Configure:
   - **Service Name:** `backend`
   - **Source:** selecione **"GitHub"**
   - **Repository:** `douglasoliveira21/saas-erp`
   - **Branch:** `main`

4. Na aba **"Build"**, configure:
   - **Build Path:** `./backend`
   - **Dockerfile Path:** `./Dockerfile`

5. Na aba **"Environment"**, adicione estas variáveis (uma por linha):

```
DATABASE_HOST=saas-erp-db
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=COLE_AQUI_A_SENHA_DO_PASSO_3
DATABASE_NAME=gestao_ti
JWT_SECRET=minha-chave-super-secreta-trocar-em-producao
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
CORS_ORIGIN=*
```

> 📝 **Explicando o DATABASE_HOST:**
> No EasyPanel, o nome do host segue o padrão: `nome-do-projeto-nome-do-servico`
> Como o projeto é `saas-erp` e o serviço do banco é `db`, o host fica: `saas-erp-db`

6. Na aba **"Network"** (ou "Domains"):
   - **Port:** `5000`
   - Por enquanto, **NÃO** precisa adicionar domínio público aqui

7. Clique em **"Create"** e depois em **"Deploy"**
8. Aguarde o build finalizar (pode levar 2-5 minutos)

---

## Etapa 5: Criar o Serviço Frontend (Interface Web)

1. Clique em **"+ Create Service"**
2. Selecione **"App"**
3. Configure:
   - **Service Name:** `frontend`
   - **Source:** selecione **"GitHub"**
   - **Repository:** `douglasoliveira21/saas-erp`
   - **Branch:** `main`

4. Na aba **"Build"**, configure:
   - **Build Path:** `./frontend`
   - **Dockerfile Path:** `./Dockerfile`

5. Na aba **"Network"** (ou "Domains"):
   - **Port:** `80`
   - **Domain:** Adicione seu domínio aqui (ex: `erp.seudominio.com.br`)
   - Ou use o domínio gratuito do EasyPanel se disponível

6. Clique em **"Create"** e depois em **"Deploy"**
7. Aguarde o build finalizar (pode levar 2-3 minutos)

---

## Etapa 6: Ajustar o Frontend para Conectar ao Backend

O nginx do frontend precisa saber o nome correto do backend. Por padrão está configurado como `backend:5000`, mas no EasyPanel o nome interno é `saas-erp-backend:5000`.

**Opção A: Editar antes do deploy (recomendado)**

No seu computador, edite o arquivo `frontend/nginx.conf`:

Encontre a linha:
```nginx
proxy_pass http://backend:5000;
```

Troque por:
```nginx
proxy_pass http://saas-erp-backend:5000;
```

Faça commit e push:
```bash
git add frontend/nginx.conf
git commit -m "fix: adjust backend hostname for EasyPanel"
git push
```

Depois, no EasyPanel, clique em **"Redeploy"** no serviço frontend.

**Opção B: Se não quiser editar o código**

No EasyPanel, acesse o serviço `frontend` → aba **"Build"** → **"Build Arguments"** e não precisa mudar nada no build. Vá direto editar via terminal (aba "Terminal" do serviço frontend):

```bash
sed -i 's|http://backend:5000|http://saas-erp-backend:5000|g' /etc/nginx/conf.d/default.conf
nginx -s reload
```

---

## Etapa 7: Criar as Tabelas no Banco de Dados

Agora precisamos criar as tabelas. Existem duas formas:

### Forma 1: Automática (mais fácil)

1. Vá no serviço `backend` → aba **"Environment"**
2. Mude temporariamente: `NODE_ENV=development`
3. Clique em **"Save"** e depois **"Redeploy"**
4. Aguarde o backend reiniciar (ele vai criar todas as tabelas automaticamente)
5. Depois mude de volta: `NODE_ENV=production`
6. Clique em **"Save"** e **"Redeploy"** novamente

### Forma 2: Manual (via SQL)

1. No EasyPanel, clique no serviço `db` (PostgreSQL)
2. Vá na aba **"Terminal"** ou **"Console"**
3. Execute:
```bash
psql -U postgres -d gestao_ti
```
4. Cole todo o conteúdo do arquivo `backend/database/schema.sql` e aperte Enter
5. Digite `\q` para sair

---

## Etapa 8: Criar os Usuários Iniciais

1. No EasyPanel, vá no serviço `backend` → aba **"Terminal"**
2. Execute este comando:

```bash
node -e "
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function seed() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: 5432,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  await client.connect();

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const financeiroHash = await bcrypt.hash('Financeiro@123', 10);
  const tecnicoHash = await bcrypt.hash('Tecnico@123', 10);

  await client.query(\`
    INSERT INTO users (name, email, password, role, active) VALUES
    ('Administrador', 'admin@empresa.com', '\${adminHash}', 'admin', true),
    ('Maria Financeiro', 'financeiro@empresa.com', '\${financeiroHash}', 'financeiro', true),
    ('João Técnico', 'tecnico@empresa.com', '\${tecnicoHash}', 'tecnico', true)
    ON CONFLICT DO NOTHING
  \`);

  console.log('Usuarios criados com sucesso!');
  await client.end();
}

seed().catch(console.error);
"
```

---

## Etapa 9: Testar o Sistema

1. Acesse o domínio que você configurou no frontend (ex: `https://erp.seudominio.com.br`)
2. Na tela de login, use:
   - **Email:** `admin@empresa.com`
   - **Senha:** `Admin@123`
3. Se tudo estiver funcionando, você verá o Dashboard!

---

## Resumo das Credenciais

| Perfil | Email | Senha | Permissões |
|--------|-------|-------|------------|
| Administrador | admin@empresa.com | Admin@123 | Acesso total |
| Financeiro | financeiro@empresa.com | Financeiro@123 | Finanças e aprovações |
| Técnico | tecnico@empresa.com | Tecnico@123 | Vendas e rotas |

> ⚠️ **TROQUE AS SENHAS** após o primeiro login!

---

## Checklist Final

- [ ] PostgreSQL rodando (status verde)
- [ ] Backend rodando (status verde)
- [ ] Frontend rodando (status verde)
- [ ] Domínio apontando para o frontend
- [ ] Tabelas criadas no banco
- [ ] Usuários criados
- [ ] Login funcionando

---

## Problemas Comuns e Soluções

### "Tela branca" ou "Erro 502"

**Causa:** O backend ainda não iniciou ou o nginx não encontra o backend.

**Solução:**
1. Verifique se o backend está com status verde
2. Verifique os logs do frontend (aba "Logs")
3. Confirme que o `nginx.conf` aponta para `saas-erp-backend:5000`

---

### "Erro de conexão com banco"

**Causa:** Senha errada ou nome do host incorreto.

**Solução:**
1. Verifique se o `DATABASE_HOST` é exatamente `saas-erp-db`
2. Verifique se a `DATABASE_PASSWORD` é a mesma que definiu no serviço `db`
3. Verifique os logs do backend (aba "Logs")

---

### "Login não funciona" ou "Usuário não encontrado"

**Causa:** As tabelas ou usuários não foram criados.

**Solução:**
1. Siga a Etapa 7 para criar as tabelas
2. Siga a Etapa 8 para criar os usuários
3. Verifique nos logs do backend se há erros

---

### "Build falhou"

**Causa:** Erro durante a compilação.

**Solução:**
1. Vá na aba "Logs" do serviço que falhou
2. Leia a mensagem de erro
3. Geralmente é falta de variável de ambiente ou branch errada
4. Confirme que o **Branch** é `main` e o **Build Path** está correto

---

### "HTTPS não funciona"

**Causa:** Certificado SSL não foi gerado.

**Solução:**
1. No serviço frontend → aba "Domains"
2. Certifique-se que o domínio está apontando para o IP do servidor (DNS)
3. O EasyPanel gera SSL automático via Let's Encrypt
4. Aguarde 1-2 minutos após configurar o domínio

---

## Como Atualizar o Sistema

Quando houver atualizações no código:

1. No EasyPanel, vá no serviço que deseja atualizar (backend ou frontend)
2. Clique em **"Redeploy"**
3. O EasyPanel vai puxar o código novo do GitHub e refazer o build

---

## Configuração de DNS (Domínio)

Para seu domínio funcionar, configure no seu provedor de DNS:

| Tipo | Nome | Valor |
|------|------|-------|
| A | erp | IP-DO-SEU-SERVIDOR |

Ou se usar subdomínio:

| Tipo | Nome | Valor |
|------|------|-------|
| A | erp.seudominio.com.br | IP-DO-SEU-SERVIDOR |

Aguarde propagação (pode levar até 24h, geralmente 5-30 minutos).

---

## Estrutura no EasyPanel (Resultado Final)

```
Projeto: saas-erp
├── db (PostgreSQL 16)
│   └── Database: gestao_ti
├── backend (NestJS API)
│   └── Port: 5000
└── frontend (React + Nginx)
    └── Port: 80
    └── Domain: erp.seudominio.com.br
```

---

## Dúvidas?

Se algo não funcionar, verifique sempre os **Logs** de cada serviço no EasyPanel. Eles mostram exatamente o que está acontecendo.
