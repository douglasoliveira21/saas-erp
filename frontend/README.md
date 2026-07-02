# Frontend - Sistema de Gestão TI

Frontend do sistema de gestão para empresa de TI e assistência técnica.

## 🛠️ Tecnologias

- **React** 18
- **TypeScript** 5
- **Vite** 5
- **Tailwind CSS** 3
- **React Router** 6
- **Axios** para requisições HTTP
- **React Hook Form** para formulários
- **Recharts** para gráficos
- **Lucide React** para ícones

## 📁 Estrutura

```
src/
├── components/      # Componentes reutilizáveis
│   ├── Layout.tsx
│   └── PrivateRoute.tsx
├── contexts/        # Context API
│   └── AuthContext.tsx
├── pages/           # Páginas da aplicação
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Products.tsx
│   ├── Services.tsx
│   ├── Customers.tsx
│   ├── Sales.tsx
│   ├── NewSale.tsx
│   ├── Commissions.tsx
│   ├── Stock.tsx
│   ├── Users.tsx
│   └── Reports.tsx
├── services/        # Serviços de API
│   └── api.ts
├── types/           # TypeScript types
├── App.tsx          # Componente principal
├── main.tsx         # Entry point
└── index.css        # Estilos globais
```

## 🚀 Instalação

```bash
# Instalar dependências
npm install

# Configurar .env
cp .env.example .env

# Editar .env com a URL da API
```

## ⚙️ Configuração

Edite o arquivo `.env`:

```env
VITE_API_URL=http://localhost:3000
```

## 🏃 Executando

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Preview do build
npm run preview
```

## 🌐 Acesso

A aplicação estará disponível em: `http://localhost:5173`

### Usuários Padrão

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | admin@empresa.com | Admin@123 |
| Financeiro | financeiro@empresa.com | Financeiro@123 |
| Técnico | tecnico@empresa.com | Tecnico@123 |

## 📱 Páginas

### Login
Autenticação de usuários com email e senha.

### Dashboard
Visão geral com métricas principais:
- Total de vendas
- Faturamento
- Lucro líquido
- Estoque baixo

### Produtos
Listagem e gerenciamento de produtos físicos.

### Serviços
Listagem e gerenciamento de serviços de TI.

### Clientes
Listagem e gerenciamento de clientes.

### Vendas
Listagem de vendas e formulário de nova venda.

### Comissões
Visualização e gerenciamento de comissões.

### Estoque
Controle de movimentações de estoque.

### Usuários
Gerenciamento de usuários do sistema (Admin).

### Relatórios
Relatórios gerenciais e financeiros.

## 🎨 Estilização

### Tailwind CSS

Classes utilitárias pré-configuradas:

```tsx
// Botões
<button className="btn btn-primary">Salvar</button>
<button className="btn btn-secondary">Cancelar</button>
<button className="btn btn-danger">Excluir</button>

// Inputs
<input className="input" />

// Cards
<div className="card">Conteúdo</div>

// Tabelas
<table className="table">...</table>
```

### Dark Mode

O sistema está preparado para dark mode:

```tsx
// Adicione a classe 'dark' no html
<html className="dark">
```

## 🔐 Autenticação

### Context API

```tsx
import { useAuth } from '../contexts/AuthContext'

function Component() {
  const { user, login, logout, isAdmin } = useAuth()
  
  // user: dados do usuário
  // login: função de login
  // logout: função de logout
  // isAdmin: boolean se é admin
}
```

### Rotas Protegidas

```tsx
<Route element={<PrivateRoute><Layout /></PrivateRoute>}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>
```

## 📡 API

### Configuração

```typescript
// src/services/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})
```

### Uso

```typescript
import { api } from '../services/api'

// GET
const response = await api.get('/products')

// POST
const response = await api.post('/products', data)

// PUT
const response = await api.put('/products/id', data)

// DELETE
const response = await api.delete('/products/id')
```

## 🧪 Testes

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch
```

## 📦 Scripts

```bash
npm run dev        # Desenvolvimento
npm run build      # Build para produção
npm run preview    # Preview do build
npm run lint       # Linting
```

## 🎯 Componentes

### Layout

Layout principal com sidebar e header.

```tsx
<Layout>
  <Outlet />
</Layout>
```

### PrivateRoute

Protege rotas que requerem autenticação.

```tsx
<PrivateRoute>
  <Component />
</PrivateRoute>
```

## 🔧 Desenvolvimento

### Criar Nova Página

1. Crie o arquivo em `src/pages/NomePagina.tsx`
2. Adicione a rota em `App.tsx`
3. Adicione no menu em `Layout.tsx`

```tsx
// src/pages/NomePagina.tsx
export function NomePagina() {
  return (
    <div>
      <h1>Título</h1>
      <div className="card">
        Conteúdo
      </div>
    </div>
  )
}
```

### Criar Novo Componente

```tsx
// src/components/NomeComponente.tsx
interface Props {
  title: string
}

export function NomeComponente({ title }: Props) {
  return (
    <div className="card">
      <h2>{title}</h2>
    </div>
  )
}
```

## 📚 Documentação

- [README Principal](../README.md)
- [Guia de Instalação](../INSTALL.md)
- [Documentação da API](../API.md)
- [Arquitetura](../ARCHITECTURE.md)

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](../CONTRIBUTING.md) para detalhes.

## 📄 Licença

MIT
