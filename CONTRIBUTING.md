# Guia de Contribuição

Obrigado por considerar contribuir com o Sistema de Gestão TI! 🎉

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Padrões de Código](#padrões-de-código)
- [Processo de Pull Request](#processo-de-pull-request)
- [Reportar Bugs](#reportar-bugs)
- [Sugerir Funcionalidades](#sugerir-funcionalidades)

## Código de Conduta

Este projeto adota um Código de Conduta. Ao participar, você concorda em manter um ambiente respeitoso e acolhedor para todos.

### Nossas Promessas

- Usar linguagem acolhedora e inclusiva
- Respeitar pontos de vista e experiências diferentes
- Aceitar críticas construtivas com elegância
- Focar no que é melhor para a comunidade
- Mostrar empatia com outros membros da comunidade

## Como Contribuir

### 1. Fork o Projeto

```bash
# Clone seu fork
git clone https://github.com/seu-usuario/sistema-gestao-ti.git
cd sistema-gestao-ti

# Adicione o repositório original como upstream
git remote add upstream https://github.com/original/sistema-gestao-ti.git
```

### 2. Crie uma Branch

```bash
# Atualize sua main
git checkout main
git pull upstream main

# Crie uma branch para sua feature/fix
git checkout -b feature/nome-da-feature
# ou
git checkout -b fix/nome-do-bug
```

### 3. Faça suas Alterações

- Escreva código limpo e bem documentado
- Siga os padrões de código do projeto
- Adicione testes quando aplicável
- Atualize a documentação se necessário

### 4. Commit suas Alterações

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Formato
<tipo>(<escopo>): <descrição>

# Exemplos
feat(products): adiciona filtro por categoria
fix(sales): corrige cálculo de comissão
docs(readme): atualiza instruções de instalação
style(frontend): ajusta espaçamento do header
refactor(backend): melhora estrutura de módulos
test(sales): adiciona testes unitários
chore(deps): atualiza dependências
```

**Tipos de commit:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação, ponto e vírgula, etc
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Tarefas de manutenção

### 5. Push para seu Fork

```bash
git push origin feature/nome-da-feature
```

### 6. Abra um Pull Request

- Vá para o repositório original no GitHub
- Clique em "New Pull Request"
- Selecione sua branch
- Preencha o template de PR
- Aguarde review

## Padrões de Código

### Backend (NestJS)

#### Estrutura de Arquivos
```
modules/
└── nome-modulo/
    ├── dto/
    │   ├── create-nome.dto.ts
    │   └── update-nome.dto.ts
    ├── entities/
    │   └── nome.entity.ts
    ├── nome.controller.ts
    ├── nome.service.ts
    └── nome.module.ts
```

#### Nomenclatura
- **Classes**: PascalCase (`UserService`, `ProductController`)
- **Arquivos**: kebab-case (`user.service.ts`, `product.controller.ts`)
- **Variáveis**: camelCase (`userName`, `productList`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_ITEMS`, `API_URL`)

#### Exemplo de Service
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    
    return product;
  }
}
```

#### Exemplo de Controller
```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }
}
```

### Frontend (React)

#### Estrutura de Arquivos
```
src/
├── components/
│   └── NomeComponente.tsx
├── pages/
│   └── NomePagina.tsx
├── contexts/
│   └── NomeContext.tsx
├── services/
│   └── nome.service.ts
└── types/
    └── nome.types.ts
```

#### Nomenclatura
- **Componentes**: PascalCase (`UserCard`, `ProductList`)
- **Arquivos**: PascalCase para componentes (`UserCard.tsx`)
- **Hooks**: camelCase com prefixo `use` (`useAuth`, `useProducts`)
- **Funções**: camelCase (`handleSubmit`, `fetchData`)

#### Exemplo de Componente
```typescript
import { useState, useEffect } from 'react'
import { api } from '../services/api'

interface Product {
  id: string
  name: string
  price: number
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    try {
      const response = await api.get('/products')
      setProducts(response.data)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Carregando...</div>
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <div key={product.id} className="card">
          <h3>{product.name}</h3>
          <p>R$ {product.price.toFixed(2)}</p>
        </div>
      ))}
    </div>
  )
}
```

### Estilo de Código

#### TypeScript
- Use tipos explícitos sempre que possível
- Evite `any`, use `unknown` se necessário
- Use interfaces para objetos complexos
- Use enums para valores fixos

#### Comentários
```typescript
// ✅ Bom: Explica o "porquê"
// Calcula comissão baseada no lucro líquido para evitar
// que comissões sejam pagas sobre impostos
const commission = netProfit * percentage

// ❌ Ruim: Explica o "o quê" (óbvio)
// Multiplica lucro líquido por percentual
const commission = netProfit * percentage
```

#### Funções
- Funções pequenas e focadas
- Um nível de abstração por função
- Nomes descritivos
- Máximo de 3 parâmetros (use objetos se precisar mais)

```typescript
// ✅ Bom
async function calculateSaleCommission(sale: Sale): Promise<number> {
  const netProfit = sale.totalAmount - sale.costs - sale.taxes
  return netProfit * sale.commissionPercentage
}

// ❌ Ruim
async function calc(s: any): Promise<any> {
  return (s.total - s.costs - s.taxes) * s.comm
}
```

## Processo de Pull Request

### Checklist antes de abrir PR

- [ ] Código segue os padrões do projeto
- [ ] Testes passando (se aplicável)
- [ ] Documentação atualizada
- [ ] Commits seguem Conventional Commits
- [ ] Branch atualizada com main
- [ ] Sem conflitos

### Template de PR

```markdown
## Descrição
Breve descrição das mudanças

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Breaking change
- [ ] Documentação

## Como Testar
1. Passo 1
2. Passo 2
3. Passo 3

## Screenshots (se aplicável)
Cole aqui

## Checklist
- [ ] Código testado localmente
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Sem warnings no console
```

### Processo de Review

1. **Automated Checks**: CI/CD roda testes automaticamente
2. **Code Review**: Pelo menos 1 aprovação necessária
3. **Testing**: Revisor testa as mudanças
4. **Merge**: Após aprovação, merge para main

## Reportar Bugs

### Antes de Reportar
- Verifique se o bug já foi reportado
- Teste na versão mais recente
- Colete informações sobre o ambiente

### Template de Bug Report

```markdown
**Descrição do Bug**
Descrição clara e concisa do bug

**Como Reproduzir**
1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

**Comportamento Esperado**
O que deveria acontecer

**Screenshots**
Se aplicável, adicione screenshots

**Ambiente**
- OS: [ex: Windows 10]
- Browser: [ex: Chrome 120]
- Versão: [ex: 1.0.0]

**Informações Adicionais**
Qualquer outra informação relevante
```

## Sugerir Funcionalidades

### Template de Feature Request

```markdown
**A funcionalidade está relacionada a um problema?**
Descrição clara do problema

**Descreva a solução que você gostaria**
Descrição clara da solução proposta

**Descreva alternativas consideradas**
Outras soluções que você considerou

**Contexto Adicional**
Qualquer outro contexto ou screenshots
```

## Desenvolvimento Local

### Setup Inicial
```bash
# Instalar dependências
npm run install:all

# Configurar ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Criar banco
createdb gestao_ti

# Executar seeds
cd backend && npm run seed

# Iniciar desenvolvimento
npm run dev
```

### Comandos Úteis
```bash
# Backend
cd backend
npm run start:dev    # Desenvolvimento
npm run test         # Testes
npm run lint         # Linting

# Frontend
cd frontend
npm run dev          # Desenvolvimento
npm run build        # Build
npm run lint         # Linting
```

## Perguntas?

- Abra uma issue com a tag `question`
- Entre em contato com os mantenedores
- Consulte a documentação

## Agradecimentos

Obrigado por contribuir! Sua ajuda é muito apreciada. 🙏

---

**Happy Coding!** 💻
