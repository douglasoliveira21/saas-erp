# Estrutura do Projeto

## 📁 Visão Geral

```
sistema-gestao-ti/
├── 📂 backend/                      # Backend NestJS + TypeScript
├── 📂 frontend/                     # Frontend React + TypeScript
├── 📄 README.md                     # Documentação principal
├── 📄 QUICKSTART.md                 # Guia rápido de início
├── 📄 INSTALL.md                    # Guia de instalação
├── 📄 API.md                        # Documentação da API
├── 📄 ARCHITECTURE.md               # Arquitetura do sistema
├── 📄 COMMANDS.md                   # Comandos úteis
├── 📄 TODO.md                       # Roadmap
├── 📄 SUMMARY.md                    # Resumo do projeto
├── 📄 CONTRIBUTING.md               # Guia de contribuição
├── 📄 LICENSE                       # Licença MIT
├── 📄 .gitignore                    # Arquivos ignorados pelo Git
└── 📄 package.json                  # Configuração raiz
```

## 🔧 Backend (NestJS)

```
backend/
├── 📂 src/
│   ├── 📂 common/                   # Código compartilhado
│   │   └── 📂 enums/               # Enumerações
│   │       ├── user-role.enum.ts
│   │       ├── sale-status.enum.ts
│   │       ├── commission-status.enum.ts
│   │       ├── commission-type.enum.ts
│   │       ├── payment-method.enum.ts
│   │       └── stock-movement-type.enum.ts
│   │
│   ├── 📂 config/                   # Configurações
│   │   └── database.config.ts      # Config do TypeORM
│   │
│   ├── 📂 modules/                  # Módulos da aplicação
│   │   │
│   │   ├── 📂 auth/                # Autenticação
│   │   │   ├── 📂 decorators/
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── 📂 dto/
│   │   │   │   └── login.dto.ts
│   │   │   ├── 📂 guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── 📂 strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── 📂 users/               # Usuários
│   │   │   ├── 📂 dto/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   └── update-user.dto.ts
│   │   │   ├── 📂 entities/
│   │   │   │   └── user.entity.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── 📂 customers/           # Clientes
│   │   │   ├── 📂 entities/
│   │   │   │   └── customer.entity.ts
│   │   │   ├── customers.controller.ts
│   │   │   ├── customers.service.ts
│   │   │   └── customers.module.ts
│   │   │
│   │   ├── 📂 products/            # Produtos
│   │   │   ├── 📂 entities/
│   │   │   │   └── product.entity.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   └── products.module.ts
│   │   │
│   │   ├── 📂 services/            # Serviços
│   │   │   ├── 📂 entities/
│   │   │   │   └── service.entity.ts
│   │   │   ├── services.controller.ts
│   │   │   ├── services.service.ts
│   │   │   └── services.module.ts
│   │   │
│   │   ├── 📂 sales/               # Vendas
│   │   │   ├── 📂 entities/
│   │   │   │   ├── sale.entity.ts
│   │   │   │   └── sale-item.entity.ts
│   │   │   ├── sales.controller.ts
│   │   │   ├── sales.service.ts
│   │   │   └── sales.module.ts
│   │   │
│   │   ├── 📂 commissions/         # Comissões
│   │   │   ├── 📂 entities/
│   │   │   │   └── commission.entity.ts
│   │   │   ├── commissions.controller.ts
│   │   │   ├── commissions.service.ts
│   │   │   └── commissions.module.ts
│   │   │
│   │   ├── 📂 stock/               # Estoque
│   │   │   ├── 📂 entities/
│   │   │   │   └── stock-movement.entity.ts
│   │   │   ├── stock.controller.ts
│   │   │   ├── stock.service.ts
│   │   │   └── stock.module.ts
│   │   │
│   │   ├── 📂 dashboard/           # Dashboard
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   └── dashboard.module.ts
│   │   │
│   │   ├── 📂 reports/             # Relatórios
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   └── reports.module.ts
│   │   │
│   │   └── 📂 audit/               # Auditoria
│   │       ├── 📂 entities/
│   │       │   └── audit-log.entity.ts
│   │       ├── audit.controller.ts
│   │       ├── audit.service.ts
│   │       └── audit.module.ts
│   │
│   ├── 📂 database/                 # Database
│   │   └── 📂 seeds/
│   │       └── seed.ts             # Dados iniciais
│   │
│   ├── app.module.ts               # Módulo principal
│   └── main.ts                     # Entry point
│
├── 📂 database/                     # SQL Scripts
│   ├── schema.sql                  # Schema do banco
│   └── 📂 seeds/
│       └── seed.sql                # Dados iniciais em SQL
│
├── 📄 package.json                 # Dependências
├── 📄 tsconfig.json                # Config TypeScript
├── 📄 nest-cli.json                # Config NestJS
└── 📄 .env.example                 # Exemplo de variáveis

Total Backend: ~50 arquivos
```

## 🎨 Frontend (React)

```
frontend/
├── 📂 public/                       # Arquivos públicos
│   └── vite.svg
│
├── 📂 src/
│   ├── 📂 components/              # Componentes reutilizáveis
│   │   ├── Layout.tsx              # Layout principal
│   │   └── PrivateRoute.tsx        # Rota protegida
│   │
│   ├── 📂 contexts/                # Context API
│   │   └── AuthContext.tsx         # Contexto de autenticação
│   │
│   ├── 📂 pages/                   # Páginas da aplicação
│   │   ├── Login.tsx               # Página de login
│   │   ├── Dashboard.tsx           # Dashboard principal
│   │   ├── Products.tsx            # Listagem de produtos
│   │   ├── Services.tsx            # Listagem de serviços
│   │   ├── Customers.tsx           # Listagem de clientes
│   │   ├── Sales.tsx               # Listagem de vendas
│   │   ├── NewSale.tsx             # Nova venda
│   │   ├── Commissions.tsx         # Comissões
│   │   ├── Stock.tsx               # Estoque
│   │   ├── Users.tsx               # Usuários
│   │   └── Reports.tsx             # Relatórios
│   │
│   ├── 📂 services/                # Serviços
│   │   └── api.ts                  # Configuração Axios
│   │
│   ├── 📂 types/                   # TypeScript types
│   │   └── (tipos globais)
│   │
│   ├── App.tsx                     # Componente principal
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Estilos globais
│
├── 📄 index.html                   # HTML principal
├── 📄 package.json                 # Dependências
├── 📄 tsconfig.json                # Config TypeScript
├── 📄 tsconfig.node.json           # Config TypeScript (Node)
├── 📄 vite.config.ts               # Config Vite
├── 📄 tailwind.config.js           # Config Tailwind
├── 📄 postcss.config.js            # Config PostCSS
└── 📄 .env.example                 # Exemplo de variáveis

Total Frontend: ~25 arquivos
```

## 📊 Banco de Dados

### Tabelas

```
PostgreSQL Database: gestao_ti
│
├── 👥 users                        # Usuários do sistema
│   ├── id (UUID, PK)
│   ├── name (VARCHAR)
│   ├── email (VARCHAR, UNIQUE)
│   ├── password (VARCHAR)
│   ├── role (ENUM)
│   ├── active (BOOLEAN)
│   └── timestamps
│
├── 👤 customers                    # Clientes
│   ├── id (UUID, PK)
│   ├── name (VARCHAR)
│   ├── cpf_cnpj (VARCHAR)
│   ├── phone (VARCHAR)
│   ├── email (VARCHAR)
│   ├── address (TEXT)
│   └── timestamps
│
├── 📦 products                     # Produtos físicos
│   ├── id (UUID, PK)
│   ├── name (VARCHAR)
│   ├── code (VARCHAR, UNIQUE)
│   ├── category (VARCHAR)
│   ├── quantity (INTEGER)
│   ├── purchase_price (DECIMAL)
│   ├── sale_price (DECIMAL)
│   ├── tax_percentage (DECIMAL)
│   ├── supplier (VARCHAR)
│   ├── min_stock (INTEGER)
│   └── timestamps
│
├── 🔧 services                     # Serviços de TI
│   ├── id (UUID, PK)
│   ├── name (VARCHAR)
│   ├── description (TEXT)
│   ├── sale_price (DECIMAL)
│   ├── operational_cost (DECIMAL)
│   ├── tax_percentage (DECIMAL)
│   ├── estimated_time (INTEGER)
│   └── timestamps
│
├── 🛒 sales                        # Vendas
│   ├── id (UUID, PK)
│   ├── technician_id (UUID, FK)
│   ├── customer_id (UUID, FK)
│   ├── status (ENUM)
│   ├── payment_method (ENUM)
│   ├── subtotal (DECIMAL)
│   ├── tax_amount (DECIMAL)
│   ├── total_amount (DECIMAL)
│   ├── net_profit (DECIMAL)
│   ├── commission_percentage (DECIMAL)
│   ├── commission_amount (DECIMAL)
│   ├── approved_by (UUID, FK)
│   └── timestamps
│
├── 📝 sale_items                   # Itens da venda
│   ├── id (UUID, PK)
│   ├── sale_id (UUID, FK)
│   ├── product_id (UUID, FK, nullable)
│   ├── service_id (UUID, FK, nullable)
│   ├── name (VARCHAR)
│   ├── quantity (INTEGER)
│   ├── unit_price (DECIMAL)
│   ├── total_price (DECIMAL)
│   ├── tax_percentage (DECIMAL)
│   ├── tax_amount (DECIMAL)
│   ├── cost_price (DECIMAL)
│   └── net_profit (DECIMAL)
│
├── 💰 commissions                  # Comissões
│   ├── id (UUID, PK)
│   ├── technician_id (UUID, FK)
│   ├── type (ENUM)
│   ├── sale_id (UUID, FK, nullable)
│   ├── description (VARCHAR)
│   ├── base_value (DECIMAL)
│   ├── percentage (DECIMAL)
│   ├── amount (DECIMAL)
│   ├── status (ENUM)
│   ├── approved_by (UUID, FK)
│   ├── paid_by (UUID, FK)
│   └── timestamps
│
├── 📊 stock_movements              # Movimentações de estoque
│   ├── id (UUID, PK)
│   ├── product_id (UUID, FK)
│   ├── type (ENUM)
│   ├── quantity (INTEGER)
│   ├── previous_quantity (INTEGER)
│   ├── new_quantity (INTEGER)
│   ├── reason (TEXT)
│   ├── user_id (UUID, FK)
│   ├── sale_id (UUID, FK)
│   └── created_at
│
└── 📋 audit_logs                   # Logs de auditoria
    ├── id (UUID, PK)
    ├── user_id (UUID, FK)
    ├── action (VARCHAR)
    ├── entity (VARCHAR)
    ├── entity_id (UUID)
    ├── old_data (JSONB)
    ├── new_data (JSONB)
    ├── ip_address (VARCHAR)
    ├── user_agent (TEXT)
    └── created_at

Total: 8 tabelas
```

### Relacionamentos

```
users (1) ──────< (N) sales
users (1) ──────< (N) commissions
customers (1) ──< (N) sales
sales (1) ───────< (N) sale_items
sales (1) ───────< (N) commissions
products (1) ────< (N) sale_items
products (1) ────< (N) stock_movements
services (1) ────< (N) sale_items
users (1) ───────< (N) audit_logs
```

## 📄 Documentação

```
Documentação/
├── 📄 README.md                    # Visão geral do projeto
├── 📄 QUICKSTART.md                # Guia rápido (5 min)
├── 📄 INSTALL.md                   # Instalação detalhada
├── 📄 API.md                       # Documentação da API
├── 📄 ARCHITECTURE.md              # Arquitetura do sistema
├── 📄 COMMANDS.md                  # Comandos úteis
├── 📄 TODO.md                      # Roadmap e tarefas
├── 📄 SUMMARY.md                   # Resumo executivo
├── 📄 CONTRIBUTING.md              # Guia de contribuição
├── 📄 PROJECT_STRUCTURE.md         # Este arquivo
└── 📄 LICENSE                      # Licença MIT

Total: 10 arquivos de documentação
```

## 📊 Estatísticas

### Código
- **Total de arquivos**: ~85
- **Linhas de código**: ~5.000+
- **Módulos backend**: 9
- **Páginas frontend**: 10
- **Componentes**: 2
- **Entidades**: 8
- **Enums**: 6

### Funcionalidades
- **Rotas da API**: 50+
- **Endpoints protegidos**: 45+
- **Níveis de acesso**: 3
- **Status de venda**: 6
- **Status de comissão**: 4
- **Tipos de movimentação**: 4
- **Formas de pagamento**: 6

### Documentação
- **Arquivos de docs**: 10
- **Páginas de documentação**: ~50
- **Exemplos de código**: 30+
- **Diagramas**: 3

## 🎯 Arquivos Principais

### Backend
1. **main.ts** - Entry point do backend
2. **app.module.ts** - Módulo principal
3. **database.config.ts** - Configuração do banco
4. **auth.service.ts** - Lógica de autenticação
5. **sales.service.ts** - Lógica de vendas

### Frontend
1. **main.tsx** - Entry point do frontend
2. **App.tsx** - Componente principal
3. **AuthContext.tsx** - Contexto de autenticação
4. **Layout.tsx** - Layout principal
5. **Dashboard.tsx** - Dashboard

### Configuração
1. **package.json** (raiz) - Scripts principais
2. **backend/package.json** - Deps do backend
3. **frontend/package.json** - Deps do frontend
4. **.env.example** - Variáveis de ambiente
5. **tsconfig.json** - Config TypeScript

### Banco de Dados
1. **schema.sql** - Schema completo
2. **seed.sql** - Dados iniciais (SQL)
3. **seed.ts** - Dados iniciais (TypeScript)

## 🔍 Como Navegar

### Para Desenvolvedores
1. Comece pelo **QUICKSTART.md**
2. Leia **ARCHITECTURE.md** para entender a estrutura
3. Consulte **API.md** para endpoints
4. Use **COMMANDS.md** para comandos úteis
5. Veja **CONTRIBUTING.md** para contribuir

### Para Usuários
1. Leia **README.md** para visão geral
2. Siga **INSTALL.md** para instalar
3. Use **QUICKSTART.md** para começar rápido

### Para Gestores
1. Leia **SUMMARY.md** para resumo executivo
2. Consulte **TODO.md** para roadmap
3. Veja **ARCHITECTURE.md** para decisões técnicas

---

**Última atualização**: 2024
**Versão**: 1.0.0
