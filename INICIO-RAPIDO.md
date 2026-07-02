# 🚀 INÍCIO RÁPIDO - Sistema de Gestão TI

## ⚠️ PROBLEMA ATUAL

Você está vendo este erro:
```
error: autenticação do tipo senha falhou para o usuário "postgres"
```

**Causa:** A senha no arquivo `backend/.env` está incorreta.

---

## ✅ SOLUÇÃO EM 3 COMANDOS

### 1️⃣ Descobrir e Corrigir a Senha

```bash
testar-senha.bat
```

Este script vai:
- ✅ Testar senhas comuns automaticamente
- ✅ Pedir para você digitar se necessário
- ✅ Atualizar o `.env` automaticamente
- ✅ Mostrar os próximos passos

### 2️⃣ Criar o Banco de Dados

```bash
setup-db.bat
```

Cria o banco `gestao_ti` com todas as tabelas e dados iniciais.

### 3️⃣ Iniciar o Sistema

```bash
start.bat
```

Inicia:
- 🔧 Backend na porta 5000
- 🎨 Frontend na porta 5001

---

## 🎯 ACESSO AO SISTEMA

Após executar os 3 comandos acima:

**URL:** http://localhost:5001

**Login Administrador:**
- 📧 Email: `admin@gestao.com`
- 🔑 Senha: `admin123`

**Outros Usuários de Teste:**
- Financeiro: `financeiro@gestao.com` / `financeiro123`
- Técnico: `tecnico@gestao.com` / `tecnico123`

---

## 📋 RESUMO VISUAL

```
┌──────────────────────────────┐
│  1. testar-senha.bat         │
│     (Corrige a senha)        │
└──────────────────────────────┘
            ↓
┌──────────────────────────────┐
│  2. setup-db.bat             │
│     (Cria o banco)           │
└──────────────────────────────┘
            ↓
┌──────────────────────────────┐
│  3. start.bat                │
│     (Inicia o sistema)       │
└──────────────────────────────┘
            ↓
┌──────────────────────────────┐
│  4. http://localhost:5001    │
│     (Acessa o sistema)       │
└──────────────────────────────┘
```

---

## 🔧 FUNCIONALIDADES DO SISTEMA

### 👥 Gestão de Usuários
- Cadastro de usuários (Admin, Financeiro, Técnico)
- Controle de acesso por perfil

### 👤 Gestão de Clientes
- Cadastro completo de clientes
- CPF/CNPJ, telefone, email, endereço

### 📦 Gestão de Produtos
- Cadastro de produtos
- Controle de estoque
- Preços de custo e venda

### 🛠️ Gestão de Serviços
- Cadastro de serviços
- Preços e descrições

### 💰 Gestão de Vendas
- Registro de vendas (produtos + serviços)
- Múltiplas formas de pagamento
- Cálculo automático de totais

### 💵 Gestão de Comissões
- Cálculo automático de comissões
- Comissões por venda e por recebimento
- Relatórios de comissões

### 📊 Estoque
- Movimentações de entrada/saída
- Histórico completo
- Alertas de estoque baixo

### 📈 Dashboard
- Visão geral do negócio
- Gráficos e métricas
- Vendas, comissões, estoque

### 📑 Relatórios
- Relatórios de vendas
- Relatórios financeiros
- Relatórios de comissões
- Exportação de dados

### 🔍 Auditoria
- Log de todas as ações
- Rastreabilidade completa

---

## 🛠️ TECNOLOGIAS

### Backend
- **NestJS** - Framework Node.js
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados
- **JWT** - Autenticação
- **Bcrypt** - Criptografia de senhas

### Frontend
- **React** - Interface do usuário
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Axios** - Requisições HTTP
- **React Router** - Navegação

---

## 📁 ESTRUTURA DO PROJETO

```
SaaS-ERP/
├── backend/
│   ├── src/
│   │   ├── modules/          # Módulos do sistema
│   │   │   ├── auth/         # Autenticação
│   │   │   ├── users/        # Usuários
│   │   │   ├── customers/    # Clientes
│   │   │   ├── products/     # Produtos
│   │   │   ├── services/     # Serviços
│   │   │   ├── sales/        # Vendas
│   │   │   ├── commissions/  # Comissões
│   │   │   ├── stock/        # Estoque
│   │   │   ├── dashboard/    # Dashboard
│   │   │   ├── reports/      # Relatórios
│   │   │   └── audit/        # Auditoria
│   │   ├── config/           # Configurações
│   │   └── main.ts           # Entrada da aplicação
│   └── .env                  # Variáveis de ambiente
│
├── frontend/
│   ├── src/
│   │   ├── pages/            # Páginas do sistema
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── contexts/         # Contextos React
│   │   └── App.tsx           # Componente principal
│   └── .env                  # Variáveis de ambiente
│
└── Scripts de Configuração
    ├── testar-senha.bat      # ⭐ Corrige senha do PostgreSQL
    ├── setup-db.bat          # Cria o banco de dados
    └── start.bat             # Inicia o sistema
```

---

## 🆘 PROBLEMAS COMUNS

### ❌ Erro: "autenticação do tipo senha falhou"

**Solução:** Execute `testar-senha.bat`

### ❌ Erro: "database gestao_ti does not exist"

**Solução:** Execute `setup-db.bat`

### ❌ Erro: "Port 5000 is already in use"

**Solução:** Feche outros programas usando a porta 5000 ou mude a porta no `backend/.env`

### ❌ Erro: "Cannot find module"

**Solução:** Execute `npm install` no backend e frontend

### ❌ Frontend não conecta ao backend

**Solução:** Verifique se o backend está rodando na porta 5000

---

## 📚 DOCUMENTAÇÃO COMPLETA

- **README.md** - Visão geral do projeto
- **QUICKSTART.md** - Guia de início rápido
- **INSTALL.md** - Instalação detalhada
- **API.md** - Documentação da API
- **ARCHITECTURE.md** - Arquitetura do sistema
- **CORRIGIR-SENHA.md** - Guia detalhado para corrigir senha
- **COMMANDS.md** - Lista de comandos disponíveis

---

## 🎉 PRONTO PARA COMEÇAR!

Execute agora:

```bash
testar-senha.bat
```

E siga os passos na tela! 🚀

---

## 💡 DICA

A senha mais comum do PostgreSQL é: **`postgres`**

Se você não lembra qual senha usou na instalação, o script `testar-senha.bat` vai descobrir para você! 😉
