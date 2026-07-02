========================================
  ERRO: SENHA DO POSTGRESQL INCORRETA
========================================

SOLUÇÃO RÁPIDA:

1. Pare o servidor (Ctrl+C)

2. Execute: fix-senha.bat

3. Inicie: start.bat

========================================

O script fix-senha.bat vai:
- Testar senhas comuns
- Pedir a senha correta
- Atualizar o .env automaticamente

Senhas comuns para testar:
- postgres
- admin
- root
- (vazio)

========================================

Leia: RESOLVER-AGORA.md para mais detalhes

========================================
