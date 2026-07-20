# Arquitetura do Sistema

## Visão Geral

Sistema full-stack moderno para gestão de empresa de TI e assistência técnica, construído com arquitetura em camadas e separação clara de responsabilidades.

## Stack Tecnológica

### Backend
- **Framework**: NestJS (Node.js + TypeScript)
- **ORM**: TypeORM
- **Banco de Dados**: PostgreSQL
- **Autenticação**: JWT (JSON Web Tokens)
- **Validação**: class-validator + class-transformer
- **Segurança**: bcrypt para hash de senhas

### Frontend
- **Framework**: React 18 + TypeScript
- **Roteamento**: React Router v6
- **Estilização**: Tailwind CSS
- **Requisições HTTP**: Axios
- **Formulários**: React Hook Form
- **Gráficos**: Recharts
- **Ícones**: Lucide React

## Arquitetura Backend

### Estrutura de Pastas

```
backend/
├── src/
│   ├── common/              # Código compartilhado
│   │   └── enums/          # Enumerações
│   ├── config/             # Configurações
│   │   └── database.config.ts
│   ├── modules/            # Módulos da aplicação
│   │   ├── auth/          # Autenticação
│   │   ├── users/         # Usuários
│   │   ├── customers/     # Clientes
│   │   ├── products/      # Produtos
│   │   ├── services/      # Serviços
│   │   ├── sales/         # Vendas
│   │   ├── commissions/   # Comissões
│   │   ├── stock/         # Estoque
│   │   ├── dashboard/     # Dashboard
│   │   ├── reports/       # Relatórios
│   │   └── audit/         # Auditoria
│   ├── database/          # Migrations e seeds
│   ├── app.module.ts      # Módulo principal
│   └── main.ts            # Entry point
└── package.json
```

### Padrões Utilizados

#### 1. Módulos NestJS
Cada funcionalidade é um módulo independente com:
- **Controller**: Rotas e validação de entrada
- **Service**: Lógica de negócio
- **Entity**: Modelo de dados (TypeORM)
- **DTOs**: Data Transfer Objects para validação

#### 2. Guards e Decorators
- **JwtAuthGuard**: Protege rotas autenticadas
- **RolesGuard**: Controla acesso por perfil
- **@Roles()**: Decorator para definir permissões

#### 3. Interceptors
- Tratamento global de erros
- Transformação de respostas
- Logging de requisições

## Arquitetura Frontend

### Estrutura de Pastas

```
frontend/
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   ├── Layout.tsx
│   │   └── PrivateRoute.tsx
│   ├── contexts/          # Context API
│   │   └── AuthContext.tsx
│   ├── pages/             # Páginas da aplicação
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── Services.tsx
│   │   ├── Customers.tsx
│   │   ├── Sales.tsx
│   │   ├── Commissions.tsx
│   │   ├── Stock.tsx
│   │   ├── Users.tsx
│   │   └── Reports.tsx
│   ├── services/          # Serviços de API
│   │   └── api.ts
│   ├── types/             # TypeScript types
│   ├── App.tsx            # Componente principal
│   ├── main.tsx           # Entry point
│   └── index.css          # Estilos globais
└── package.json
```

### Padrões Utilizados

#### 1. Context API
- **AuthContext**: Gerenciamento de autenticação global
- Estado compartilhado entre componentes
- Hooks customizados (useAuth)

#### 2. Protected Routes
- Verificação de autenticação
- Redirecionamento automático
- Loading states

#### 3. Axios Interceptors
- Adiciona token JWT automaticamente
- Trata erros 401 (não autenticado)
- Redireciona para login quando necessário

## Modelo de Dados

### Entidades Principais

```
users (Usuários)
├── id: UUID
├── name: string
├── email: string (unique)
├── password: string (hashed)
├── role: enum (admin, financeiro, tecnico)
└── active: boolean

customers (Clientes)
├── id: UUID
├── name: string
├── cpf_cnpj: string
├── phone: string
├── email: string
└── address: text

products (Produtos)
├── id: UUID
├── name: string
├── code: string (unique)
├── category: string
├── quantity: integer
├── purchase_price: decimal
├── sale_price: decimal
├── tax_percentage: decimal
└── min_stock: integer

services (Serviços)
├── id: UUID
├── name: string
├── description: text
├── sale_price: decimal
├── operational_cost: decimal
├── tax_percentage: decimal
└── estimated_time: integer

sales (Vendas)
├── id: UUID
├── technician_id: UUID (FK)
├── customer_id: UUID (FK)
├── status: enum
├── payment_method: enum
├── total_amount: decimal
├── net_profit: decimal
└── commission_amount: decimal

sale_items (Itens da Venda)
├── id: UUID
├── sale_id: UUID (FK)
├── product_id: UUID (FK, nullable)
├── service_id: UUID (FK, nullable)
├── quantity: integer
├── unit_price: decimal
└── total_price: decimal

commissions (Comissões)
├── id: UUID
├── technician_id: UUID (FK)
├── type: enum (venda, avulsa)
├── sale_id: UUID (FK, nullable)
├── base_value: decimal
├── percentage: decimal
├── amount: decimal
└── status: enum

stock_movements (Movimentações de Estoque)
├── id: UUID
├── product_id: UUID (FK)
├── type: enum (entrada, saida, ajuste, venda)
├── quantity: integer
├── previous_quantity: integer
└── new_quantity: integer

audit_logs (Logs de Auditoria)
├── id: UUID
├── user_id: UUID (FK)
├── action: string
├── entity: string
├── entity_id: UUID
├── old_data: jsonb
└── new_data: jsonb
```

### Relacionamentos

- **User** 1:N **Sales** (técnico)
- **User** 1:N **Commissions** (técnico)
- **Customer** 1:N **Sales**
- **Sale** 1:N **SaleItems**
- **Sale** 1:N **Commissions**
- **Product** 1:N **SaleItems**
- **Product** 1:N **StockMovements**
- **Service** 1:N **SaleItems**

## Fluxos Principais

### 1. Autenticação
```
1. Usuário envia email/senha
2. Backend valida credenciais
3. Backend gera JWT token
4. Frontend armazena token no localStorage
5. Token é enviado em todas as requisições
```

### 2. Registro de Venda
```
1. Técnico seleciona cliente
2. Adiciona produtos/serviços
3. Sistema calcula:
   - Subtotal
   - Impostos
   - Lucro líquido
   - Comissão
4. Salva venda com status "pendente"
5. Atualiza estoque automaticamente
6. Cria comissão automática
7. Notifica financeiro
```

### 3. Aprovação de Comissão
```
1. Financeiro visualiza comissões pendentes
2. Revisa valores e detalhes
3. Aprova comissão
4. Status muda para "aprovada"
5. Após pagamento, marca como "paga"
```

### 4. Controle de Estoque
```
1. Entrada manual de produtos
2. Saída automática em vendas
3. Ajustes manuais quando necessário
4. Histórico completo de movimentações
5. Alertas de estoque baixo
```

## Segurança

### Backend
- ✅ Senhas criptografadas com bcrypt (salt rounds: 10)
- ✅ JWT com expiração configurável
- ✅ Guards de autenticação em todas as rotas
- ✅ Guards de autorização por perfil
- ✅ Validação de dados com class-validator
- ✅ Proteção contra SQL Injection (TypeORM)
- ✅ CORS configurável
- ✅ Logs de auditoria completos

### Frontend
- ✅ Token armazenado no localStorage
- ✅ Rotas protegidas com PrivateRoute
- ✅ Interceptor para adicionar token
- ✅ Logout automático em 401
- ✅ Validação de formulários
- ✅ Sanitização de inputs

## Performance

### Backend
- Índices no banco de dados
- Paginação em listagens
- Eager/Lazy loading configurável
- Cache de queries frequentes (futuro)

### Frontend
- Code splitting por rota
- Lazy loading de componentes
- Otimização de re-renders
- Debounce em buscas

## Escalabilidade

### Horizontal
- Stateless backend (JWT)
- Load balancer ready
- Database connection pooling

### Vertical
- Otimização de queries
- Índices estratégicos
- Compressão de respostas

## Monitoramento

### Logs
- Logs de aplicação (console)
- Logs de erro (arquivo)
- Logs de auditoria (banco)

### Métricas (Futuro)
- Tempo de resposta
- Taxa de erro
- Uso de recursos
- Usuários ativos

## Deploy

### Backend
```bash
npm run build
npm run start:prod
```

### Frontend
```bash
npm run build
# Servir pasta dist/ com nginx/apache
```

### Banco de Dados
```bash
# Executar migrations
npm run migration:run

# Executar seeds
npm run seed
```

## Testes (Futuro)

### Backend
- Unit tests (Jest)
- Integration tests
- E2E tests

### Frontend
- Component tests (React Testing Library)
- E2E tests (Playwright/Cypress)

## Roadmap

### Fase 1 (Atual)
- ✅ Estrutura base
- ✅ Autenticação
- ✅ CRUD básico
- ✅ Dashboard inicial

### Fase 2
- [ ] Implementar todas as páginas
- [ ] Relatórios completos
- [ ] Exportação PDF/Excel
- [ ] Gráficos avançados

### Fase 3
- [ ] Sistema SaaS multiempresa
- [ ] Integração WhatsApp
- [ ] Backup automático
- [ ] Dashboard em tempo real

### Fase 4
- [ ] App mobile
- [ ] Integração pagamentos
- [ ] BI avançado
- [ ] API pública

## Manutenção

### Atualizações
- Dependências: mensal
- Segurança: imediato
- Features: sprint de 2 semanas

### Backup
- Banco de dados: diário
- Arquivos: semanal
- Configurações: versionado (Git)

## Suporte

### Documentação
- README.md - Visão geral
- INSTALL.md - Instalação
- API.md - Documentação da API
- ARCHITECTURE.md - Este arquivo

### Contato
- Issues no repositório
- Email de suporte
- Documentação online
