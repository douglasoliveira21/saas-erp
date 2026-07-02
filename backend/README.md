# Backend - Sistema de Gestão TI

Backend do sistema de gestão para empresa de TI e assistência técnica.

## 🛠️ Tecnologias

- **Node.js** 18+
- **NestJS** 10
- **TypeScript** 5
- **PostgreSQL** 14+
- **TypeORM** 0.3
- **JWT** para autenticação
- **bcrypt** para hash de senhas
- **class-validator** para validação

## 📁 Estrutura

```
src/
├── common/          # Código compartilhado (enums, etc)
├── config/          # Configurações (database, etc)
├── modules/         # Módulos da aplicação
│   ├── auth/       # Autenticação
│   ├── users/      # Usuários
│   ├── customers/  # Clientes
│   ├── products/   # Produtos
│   ├── services/   # Serviços
│   ├── sales/      # Vendas
│   ├── commissions/# Comissões
│   ├── stock/      # Estoque
│   ├── dashboard/  # Dashboard
│   ├── reports/    # Relatórios
│   └── audit/      # Auditoria
├── database/        # Migrations e seeds
├── app.module.ts    # Módulo principal
└── main.ts          # Entry point
```

## 🚀 Instalação

```bash
# Instalar dependências
npm install

# Configurar .env
cp .env.example .env

# Editar .env com suas configurações
```

## ⚙️ Configuração

Edite o arquivo `.env`:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=sua_senha
DATABASE_NAME=gestao_ti

JWT_SECRET=sua_chave_secreta
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development
```

## 🗄️ Banco de Dados

```bash
# Criar banco
createdb gestao_ti

# Executar migrations
npm run migration:run

# Executar seeds
npm run seed
```

## 🏃 Executando

```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod
```

## 📡 API

A API estará disponível em: `http://localhost:3000/api`

### Endpoints Principais

- `POST /auth/login` - Login
- `GET /auth/me` - Usuário autenticado
- `GET /users` - Listar usuários
- `GET /products` - Listar produtos
- `GET /services` - Listar serviços
- `GET /customers` - Listar clientes
- `GET /sales` - Listar vendas
- `POST /sales` - Criar venda
- `GET /commissions` - Listar comissões
- `GET /dashboard` - Dados do dashboard

Veja [API.md](../API.md) para documentação completa.

## 🧪 Testes

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 📦 Scripts

```bash
npm run start:dev      # Desenvolvimento
npm run start:prod     # Produção
npm run build          # Build
npm run lint           # Linting
npm run migration:run  # Executar migrations
npm run seed           # Executar seeds
```

## 🔒 Segurança

- JWT com expiração configurável
- Senhas criptografadas com bcrypt (10 rounds)
- Guards de autenticação
- Guards de autorização por perfil
- Validação de dados com class-validator
- Proteção contra SQL Injection (TypeORM)
- CORS configurável
- Logs de auditoria

## 📝 Módulos

### Auth
Autenticação JWT com login e validação de usuário.

### Users
CRUD de usuários com 3 perfis: admin, financeiro, tecnico.

### Customers
CRUD de clientes com informações completas.

### Products
CRUD de produtos com controle de estoque.

### Services
CRUD de serviços de TI.

### Sales
Sistema de vendas com cálculo automático de impostos, lucro e comissões.

### Commissions
Gestão de comissões automáticas e avulsas.

### Stock
Controle de movimentações de estoque.

### Dashboard
Métricas e estatísticas do sistema.

### Reports
Relatórios gerenciais.

### Audit
Logs de auditoria de todas as ações.

## 🔧 Desenvolvimento

### Adicionar Novo Módulo

```bash
nest g module modules/nome
nest g controller modules/nome
nest g service modules/nome
```

### Criar Entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('nome')
export class Nome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
```

### Criar DTO

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateNomeDto {
  @IsString()
  @IsNotEmpty()
  name: string;
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
