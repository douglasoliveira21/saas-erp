# 💻 Sistema de Gestão para Empresa de TI e Assistência Técnica

> Sistema completo de gestão com controle de estoque, vendas, financeiro e comissões.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

<div align="center">

**[🎉 Bem-vindo!](WELCOME.md)** | **[📑 Índice](INDEX.md)** | **[⚡ Início Rápido](QUICKSTART.md)**

</div>

---

## 🚨 ATENÇÃO: CONFIGURAÇÃO DO BANCO DE DADOS

### ☁️ Usando Supabase (Recomendado)

O sistema está configurado para usar **Supabase** como banco de dados na nuvem!

**INÍCIO RÁPIDO:**
```bash
setup-supabase.bat
```

📖 **Guias:**
- **[SUPABASE-QUICKSTART.md](SUPABASE-QUICKSTART.md)** - ⭐ Configuração em 3 minutos!
- **[CONFIGURAR-SUPABASE.md](CONFIGURAR-SUPABASE.md)** - Guia completo

**Informações do Projeto:**
- URL: https://opayspeyfojslopnczjn.supabase.co
- Host: db.opayspeyfojslopnczjn.supabase.co
- Porta: 5432

### 💻 Usando PostgreSQL Local (Alternativo)

Se preferir usar PostgreSQL local, veja:
- **[LEIA-ISTO-PRIMEIRO.md](LEIA-ISTO-PRIMEIRO.md)** - Configuração local
- **[PROBLEMA-AUTENTICACAO.md](PROBLEMA-AUTENTICACAO.md)** - Resolver problemas de senha

---

## 📚 Documentação Completa

### 🚀 Início Rápido
- **[QUICKSTART.md](QUICKSTART.md)** - Comece aqui! Guia rápido de 5 minutos
- **[INSTALL.md](INSTALL.md)** - Guia completo de instalação passo a passo

### 📖 Documentação Técnica
- **[API.md](API.md)** - Documentação completa da API REST
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Arquitetura detalhada do sistema
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Estrutura de arquivos e pastas

### 🛠️ Desenvolvimento
- **[COMMANDS.md](COMMANDS.md)** - Comandos úteis para desenvolvimento
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guia de contribuição
- **[TODO.md](TODO.md)** - Roadmap e funcionalidades futuras

### 📊 Gestão
- **[SUMMARY.md](SUMMARY.md)** - Resumo executivo do projeto
- **[CHANGELOG.md](CHANGELOG.md)** - Histórico de versões

## ⚡ Início Rápido

```bash
# 1. Instalar dependências
npm run install:all

# 2. Configurar ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Criar banco de dados
createdb gestao_ti

# 4. Executar seeds
cd backend && npm run seed

# 5. Iniciar sistema
npm run dev
```

**Acesse**: http://localhost:5173

**Login**: admin@empresa.com / Admin@123

📖 **Guia completo**: [QUICKSTART.md](QUICKSTART.md)

---

## 🚀 Funcionalidades

### Controle de Produtos e Serviços
- Produtos físicos (memória RAM, SSD, cooler, etc.)
- Serviços de TI (formatação, backup, manutenção, etc.)
- Controle de estoque automático
- Alertas de estoque baixo

### Sistema de Vendas
- Registro de vendas por técnicos
- Cálculo automático de impostos e lucro
- Múltiplas formas de pagamento
- Status de venda (pendente, pago, finalizado, etc.)

### Sistema de Comissões
- Comissão automática por venda
- Comissão avulsa (bônus, indicações, etc.)
- Aprovação pelo financeiro
- Controle de pagamento

### Gestão Financeira
- Faturamento e lucro
- Contas a receber
- Controle de impostos
- Relatórios financeiros completos

### Níveis de Acesso
- **Técnico**: Registra vendas e visualiza comissões
- **Financeiro**: Aprova vendas e gerencia comissões
- **Administrador**: Acesso total ao sistema

### Relatórios
- Vendas por período
- Comissões por técnico
- Produtos mais vendidos
- Lucro líquido
- Exportação em PDF e Excel

## 🛠️ Tecnologias

### Backend
- Node.js + NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT Authentication
- Class Validator

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- React Router
- Axios
- Recharts (gráficos)
- React Hook Form

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- npm ou yarn

### Configuração do Banco de Dados

1. Crie um banco de dados PostgreSQL:
```sql
CREATE DATABASE gestao_ti;
```

2. Configure as variáveis de ambiente no backend (veja `.env.example`)

### Instalação das Dependências

```bash
# Instalar todas as dependências
npm run install:all
```

### Configuração do Backend

1. Entre na pasta backend:
```bash
cd backend
```

2. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

3. Configure as variáveis no arquivo `.env`:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=sua_senha
DATABASE_NAME=gestao_ti
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d
PORT=3000
```

4. Execute as migrations:
```bash
npm run migration:run
```

5. Execute os seeds (dados iniciais):
```bash
npm run seed
```

### Configuração do Frontend

1. Entre na pasta frontend:
```bash
cd frontend
```

2. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

3. Configure a URL da API:
```env
VITE_API_URL=http://localhost:3000
```

## 🚀 Executando o Projeto

### Desenvolvimento

```bash
# Executar backend e frontend simultaneamente
npm run dev

# Ou executar separadamente:
npm run dev:backend
npm run dev:frontend
```

### Produção

```bash
# Build completo
npm run build

# Executar backend em produção
cd backend && npm run start:prod

# Servir frontend (usar nginx ou similar)
```

## 👥 Usuários Padrão

Após executar os seeds, você terá os seguintes usuários:

### Administrador
- Email: admin@empresa.com
- Senha: Admin@123

### Financeiro
- Email: financeiro@empresa.com
- Senha: Financeiro@123

### Técnico
- Email: tecnico@empresa.com
- Senha: Tecnico@123

## 📊 Estrutura do Banco de Dados

### Principais Tabelas
- `users` - Usuários do sistema
- `customers` - Clientes
- `products` - Produtos físicos
- `services` - Serviços de TI
- `stock_movements` - Movimentações de estoque
- `sales` - Vendas
- `sale_items` - Itens da venda
- `commissions` - Comissões
- `audit_logs` - Logs de auditoria

## 📱 Funcionalidades por Perfil

### Técnico
- ✅ Registrar vendas
- ✅ Visualizar suas comissões
- ✅ Ver histórico de vendas
- ✅ Dashboard com métricas pessoais

### Financeiro
- ✅ Visualizar todas as vendas
- ✅ Aprovar vendas
- ✅ Gerenciar comissões
- ✅ Controlar pagamentos
- ✅ Relatórios financeiros

### Administrador
- ✅ Gerenciar usuários
- ✅ Gerenciar produtos e serviços
- ✅ Configurar regras de comissão
- ✅ Relatórios completos
- ✅ Auditoria do sistema

## 🔒 Segurança

- Autenticação JWT
- Senhas criptografadas com bcrypt
- Proteção contra SQL Injection (TypeORM)
- Validação de dados com class-validator
- Guards de permissão por rota
- Logs de auditoria completos

## 📈 Roadmap Futuro

- [ ] Sistema SaaS multiempresa
- [ ] Integração com WhatsApp
- [ ] Backup automático
- [ ] Dashboard em tempo real (WebSocket)
- [ ] App mobile
- [ ] Integração com sistemas de pagamento

## 📊 Status do Projeto

```
✅ Backend: Completo e funcional
✅ Frontend: Completo e responsivo
✅ Banco de Dados: Estruturado e otimizado
✅ Documentação: Extensa e detalhada
✅ Segurança: Implementada
🚧 Testes: Em desenvolvimento
🚧 Deploy: Pendente
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Veja [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes.

## 📄 Licença

Este projeto está sob a licença MIT. Veja [LICENSE](LICENSE) para mais informações.

## 👨‍💻 Suporte

- 📧 Email: suporte@empresa.com
- 📚 Documentação: Veja os arquivos .md
- 🐛 Issues: Abra uma issue no repositório

## ⭐ Agradecimentos

Desenvolvido com ❤️ usando as melhores práticas de desenvolvimento.

---

<div align="center">

**[⬆ Voltar ao topo](#-sistema-de-gestão-para-empresa-de-ti-e-assistência-técnica)**

</div>
