# Documentação da API

## Base URL
```
http://localhost:3000/api
```

## Autenticação

Todas as rotas (exceto login) requerem autenticação via JWT Bearer Token.

```
Authorization: Bearer {token}
```

## Endpoints

### Autenticação

#### POST /auth/login
Fazer login no sistema

**Body:**
```json
{
  "email": "admin@empresa.com",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "Administrador",
    "email": "admin@empresa.com",
    "role": "admin"
  }
}
```

#### GET /auth/me
Obter dados do usuário autenticado

**Response:**
```json
{
  "id": "uuid",
  "name": "Administrador",
  "email": "admin@empresa.com",
  "role": "admin"
}
```

### Usuários

#### GET /users
Listar todos os usuários (Admin, Financeiro)

#### POST /users
Criar novo usuário (Admin)

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@empresa.com",
  "password": "senha123",
  "role": "tecnico",
  "observations": "Técnico especializado em hardware"
}
```

#### GET /users/:id
Obter usuário por ID (Admin)

#### PATCH /users/:id
Atualizar usuário (Admin)

#### DELETE /users/:id
Remover usuário (Admin)

#### GET /users/technicians
Listar apenas técnicos ativos

### Clientes

#### GET /customers
Listar todos os clientes

#### POST /customers
Criar novo cliente

**Body:**
```json
{
  "name": "Cliente Exemplo",
  "cpfCnpj": "123.456.789-00",
  "phone": "(11) 98765-4321",
  "email": "cliente@email.com",
  "address": "Rua Exemplo, 123",
  "observations": "Cliente VIP"
}
```

#### GET /customers/:id
Obter cliente por ID

#### PATCH /customers/:id
Atualizar cliente

#### DELETE /customers/:id
Remover cliente

### Produtos

#### GET /products
Listar todos os produtos

**Query params:**
- `category`: Filtrar por categoria
- `lowStock`: true/false - Produtos com estoque baixo

#### POST /products
Criar novo produto (Admin)

**Body:**
```json
{
  "name": "Memória RAM DDR4 8GB",
  "code": "RAM-DDR4-8GB",
  "category": "Memória",
  "quantity": 50,
  "purchasePrice": 150.00,
  "salePrice": 250.00,
  "taxPercentage": 18.00,
  "supplier": "Fornecedor A",
  "minStock": 10,
  "description": "Memória RAM DDR4 8GB 2666MHz"
}
```

#### GET /products/:id
Obter produto por ID

#### PATCH /products/:id
Atualizar produto (Admin)

#### DELETE /products/:id
Remover produto (Admin)

### Serviços

#### GET /services
Listar todos os serviços

#### POST /services
Criar novo serviço (Admin)

**Body:**
```json
{
  "name": "Formatação Completa",
  "description": "Formatação do sistema operacional",
  "salePrice": 150.00,
  "operationalCost": 20.00,
  "taxPercentage": 10.00,
  "estimatedTime": 120
}
```

#### GET /services/:id
Obter serviço por ID

#### PATCH /services/:id
Atualizar serviço (Admin)

#### DELETE /services/:id
Remover serviço (Admin)

### Vendas

#### GET /sales
Listar todas as vendas

**Query params:**
- `status`: Filtrar por status
- `technicianId`: Filtrar por técnico
- `startDate`: Data inicial
- `endDate`: Data final

#### POST /sales
Criar nova venda (Técnico)

**Body:**
```json
{
  "customerId": "uuid",
  "paymentMethod": "pix",
  "observations": "Cliente solicitou urgência",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 250.00
    },
    {
      "serviceId": "uuid",
      "quantity": 1,
      "unitPrice": 150.00
    }
  ]
}
```

#### GET /sales/:id
Obter venda por ID

#### PATCH /sales/:id/approve
Aprovar venda (Financeiro)

#### PATCH /sales/:id/cancel
Cancelar venda

### Comissões

#### GET /commissions
Listar todas as comissões

**Query params:**
- `status`: Filtrar por status
- `technicianId`: Filtrar por técnico
- `type`: venda ou avulsa

#### POST /commissions
Criar comissão avulsa (Admin, Financeiro)

**Body:**
```json
{
  "technicianId": "uuid",
  "description": "Comissão por indicação",
  "baseValue": 1000.00,
  "percentage": 10.00,
  "observations": "Cliente indicado fechou contrato"
}
```

#### GET /commissions/:id
Obter comissão por ID

#### PATCH /commissions/:id/approve
Aprovar comissão (Financeiro)

#### PATCH /commissions/:id/pay
Marcar comissão como paga (Financeiro)

#### PATCH /commissions/:id/cancel
Cancelar comissão (Financeiro)

### Estoque

#### GET /stock/movements
Listar movimentações de estoque

**Query params:**
- `productId`: Filtrar por produto
- `type`: entrada, saida, ajuste, venda
- `startDate`: Data inicial
- `endDate`: Data final

#### POST /stock/movements
Registrar movimentação de estoque (Admin, Financeiro)

**Body:**
```json
{
  "productId": "uuid",
  "type": "entrada",
  "quantity": 10,
  "reason": "Compra de fornecedor"
}
```

#### GET /stock/low
Produtos com estoque baixo

### Dashboard

#### GET /dashboard
Obter dados do dashboard

**Response:**
```json
{
  "totalSales": 150,
  "totalRevenue": 45000.00,
  "totalProfit": 12000.00,
  "pendingCommissions": 2500.00,
  "lowStockProducts": 5,
  "monthlySales": [
    { "month": "Jan", "total": 5000 },
    { "month": "Fev", "total": 7000 }
  ]
}
```

### Relatórios

#### GET /reports/sales
Relatório de vendas

**Query params:**
- `startDate`: Data inicial (obrigatório)
- `endDate`: Data final (obrigatório)
- `technicianId`: Filtrar por técnico
- `format`: pdf ou excel

#### GET /reports/commissions
Relatório de comissões

#### GET /reports/financial
Relatório financeiro

#### GET /reports/products
Relatório de produtos mais vendidos

### Auditoria

#### GET /audit/logs
Listar logs de auditoria (Admin)

**Query params:**
- `userId`: Filtrar por usuário
- `entity`: Filtrar por entidade
- `action`: Filtrar por ação
- `startDate`: Data inicial
- `endDate`: Data final

## Códigos de Status

- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Requisição inválida
- `401` - Não autenticado
- `403` - Sem permissão
- `404` - Não encontrado
- `409` - Conflito (ex: email já cadastrado)
- `500` - Erro interno do servidor

## Permissões por Perfil

### Admin
- Acesso total ao sistema
- Gerenciar usuários
- Gerenciar produtos e serviços
- Visualizar todos os relatórios
- Configurar sistema

### Financeiro
- Visualizar vendas
- Aprovar vendas
- Gerenciar comissões
- Visualizar relatórios financeiros
- Controlar estoque

### Técnico
- Registrar vendas
- Visualizar suas comissões
- Visualizar clientes
- Ver histórico de vendas
