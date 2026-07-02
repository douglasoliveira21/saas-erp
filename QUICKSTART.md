# 🚀 Guia Rápido de Início

## ⚡ Início Rápido (5 minutos)

### 1. Pré-requisitos
Certifique-se de ter instalado:
- ✅ Node.js 18+ ([Download](https://nodejs.org/))
- ✅ PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))

### 2. Clonar/Baixar o Projeto
```bash
# Se estiver usando Git
git clone <url-do-repositorio>
cd sistema-gestao-ti

# Ou extraia o arquivo ZIP
```

### 3. Instalar Dependências
```bash
npm run install:all
```

### 4. Configurar Banco de Dados
```bash
# Criar banco
createdb gestao_ti

# Ou via psql
psql -U postgres
CREATE DATABASE gestao_ti;
\q
```

### 5. Configurar Variáveis de Ambiente

**Backend** (`backend/.env`):
```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env`:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=SUA_SENHA_AQUI
DATABASE_NAME=gestao_ti
JWT_SECRET=sua_chave_secreta_aqui
```

**Frontend** (`frontend/.env`):
```bash
cd frontend
cp .env.example .env
```

Conteúdo:
```env
VITE_API_URL=http://localhost:3000
```

### 6. Executar Seeds
```bash
cd backend
npm run seed
```

### 7. Iniciar o Sistema
```bash
# Na raiz do projeto
npm run dev
```

### 8. Acessar o Sistema
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000/api

### 9. Fazer Login
Use um dos usuários padrão:

| Perfil | Email | Senha |
|--------|-------|-------|
| **Admin** | admin@empresa.com | Admin@123 |
| **Financeiro** | financeiro@empresa.com | Financeiro@123 |
| **Técnico** | tecnico@empresa.com | Tecnico@123 |

## 🎯 Primeiros Passos

### Como Administrador

1. **Faça login** com admin@empresa.com
2. **Explore o Dashboard** - veja as métricas principais
3. **Cadastre Produtos** - vá em Produtos > Novo Produto
4. **Cadastre Serviços** - vá em Serviços > Novo Serviço
5. **Crie Usuários** - vá em Usuários > Novo Usuário
6. **Configure o Sistema** - ajuste conforme sua necessidade

### Como Técnico

1. **Faça login** com tecnico@empresa.com
2. **Veja o Dashboard** - suas métricas pessoais
3. **Registre uma Venda** - vá em Vendas > Nova Venda
4. **Acompanhe Comissões** - vá em Comissões

### Como Financeiro

1. **Faça login** com financeiro@empresa.com
2. **Veja o Dashboard** - métricas financeiras
3. **Aprove Vendas** - vá em Vendas > Pendentes
4. **Gerencie Comissões** - vá em Comissões
5. **Veja Relatórios** - vá em Relatórios

## 📚 Próximos Passos

### Personalização
1. Altere as senhas padrão
2. Cadastre seus produtos reais
3. Cadastre seus serviços
4. Configure percentuais de comissão
5. Cadastre seus clientes

### Aprendizado
- Leia o [README.md](README.md) para visão geral
- Consulte [API.md](API.md) para endpoints
- Veja [ARCHITECTURE.md](ARCHITECTURE.md) para arquitetura
- Use [COMMANDS.md](COMMANDS.md) para comandos úteis

## 🆘 Problemas Comuns

### Erro: "Cannot connect to database"
**Solução**: Verifique se o PostgreSQL está rodando e as credenciais no `.env` estão corretas.

```bash
# Verificar se PostgreSQL está rodando
# Windows: Services > PostgreSQL
# Linux: sudo systemctl status postgresql
# Mac: brew services list
```

### Erro: "Port 3000 already in use"
**Solução**: Outra aplicação está usando a porta 3000.

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Erro: "Module not found"
**Solução**: Reinstale as dependências.

```bash
rm -rf node_modules package-lock.json
npm install
```

### Página em branco no frontend
**Solução**: Verifique se o backend está rodando e a URL no `.env` está correta.

```bash
# Testar se backend está respondendo
curl http://localhost:3000/api
```

## 💡 Dicas

### Desenvolvimento
- Use **VS Code** com as extensões recomendadas
- Mantenha o terminal aberto para ver logs
- Use **Postman** ou **Thunder Client** para testar a API
- Use **pgAdmin** ou **DBeaver** para gerenciar o banco

### Produtividade
- Atalho para abrir terminal: `Ctrl + '` (VS Code)
- Atalho para buscar arquivos: `Ctrl + P` (VS Code)
- Use `Ctrl + C` para parar o servidor
- Use `npm run dev` para reiniciar tudo

### Boas Práticas
- Faça commits frequentes
- Use branches para novas features
- Teste antes de fazer commit
- Mantenha o `.env` seguro (nunca commite)
- Faça backup do banco regularmente

## 📞 Suporte

### Documentação
- [README.md](README.md) - Visão geral
- [INSTALL.md](INSTALL.md) - Instalação detalhada
- [API.md](API.md) - Documentação da API
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitetura
- [COMMANDS.md](COMMANDS.md) - Comandos úteis
- [TODO.md](TODO.md) - Roadmap

### Recursos
- [NestJS Docs](https://docs.nestjs.com)
- [React Docs](https://react.dev)
- [TypeORM Docs](https://typeorm.io)
- [Tailwind Docs](https://tailwindcss.com)

## ✅ Checklist de Instalação

- [ ] Node.js instalado
- [ ] PostgreSQL instalado
- [ ] Projeto clonado/baixado
- [ ] Dependências instaladas
- [ ] Banco de dados criado
- [ ] Arquivo `.env` configurado (backend)
- [ ] Arquivo `.env` configurado (frontend)
- [ ] Seeds executados
- [ ] Sistema rodando
- [ ] Login funcionando
- [ ] Dashboard carregando

## 🎉 Pronto!

Seu sistema está instalado e funcionando! Agora você pode:

1. **Explorar** todas as funcionalidades
2. **Personalizar** conforme sua necessidade
3. **Desenvolver** novas features
4. **Colocar em produção** quando estiver pronto

---

**Dúvidas?** Consulte a documentação completa ou abra uma issue no repositório.

**Boa sorte!** 🚀
