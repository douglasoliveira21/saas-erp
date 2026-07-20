# UX e Design System

## Componentes

Os componentes base estão em `frontend/src/components/ui`:

- `Button`: variantes, tamanhos, loading e foco visível
- `Card`: superfície de conteúdo
- `Modal`: diálogo acessível, Escape e restauração de foco
- `PageHeader`: título, descrição e ações
- `TableContainer`: rolagem horizontal acessível
- `FeedbackProvider`: toast e confirmação padronizada
- `ErrorBoundary`: recuperação de erro inesperado

## Padrões

- Todo botão deve declarar comportamento e possuir nome acessível.
- Inputs devem ter `label` associado por `htmlFor`/`id`.
- Ações destrutivas usam confirmação do `FeedbackProvider`.
- Erros de API usam `getErrorMessage`.
- Tabelas devem estar dentro de `TableContainer` ou outro contêiner com rolagem horizontal.
- Páginas usam `PageHeader`; formulários extensos devem ser divididos em componentes de domínio.
- Modais novos devem usar o componente `Modal`.

## Responsividade

A interface adota abordagem mobile-first. Grupos de campos devem usar uma coluna no celular e expandir em `sm`/`lg`. Conteúdo principal mantém foco navegável e oferece link “Ir para o conteúdo principal”.
