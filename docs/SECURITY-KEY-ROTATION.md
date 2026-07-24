# Rotação de chaves e webhooks

## Chaves obrigatórias em produção

- `CERT_ENCRYPTION_KEY`: protege certificado PFX e senha fiscal.
- `CREDENTIAL_ENCRYPTION_KEY`: protege tokens de integrações, incluindo GLPI.
- `INTER_WEBHOOK_SECRET`: segredo incluído no header `x-inter-webhook-secret` ou no parâmetro `token` da URL cadastrada no Inter.

Use valores aleatórios com pelo menos 32 bytes. Nunca reutilize JWT, senha do banco ou segredo de webhook como chave de criptografia.

## Rotação sem indisponibilidade

1. Mova a chave atual para `CERT_ENCRYPTION_KEY_PREVIOUS` ou `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`.
2. Configure a nova chave na variável principal.
3. Faça o deploy. Registros legados serão lidos com a chave anterior e regravados com AES-256-GCM quando aplicável.
4. Confirme emissão fiscal, conexão GLPI e logs.
5. Remova a variável `*_PREVIOUS` somente depois de confirmar que todos os registros foram migrados.

Mantenha backup seguro das chaves anteriores durante a janela de rotação. Perder todas as chaves torna os dados criptografados irrecuperáveis.

## Webhook Banco Inter

Cadastre a URL no formato `https://seu-dominio/api/inter/webhook?token=SEGREDO` quando o produto não permitir header personalizado. O callback apenas dispara o processamento: o ERP consulta a cobrança diretamente na API Inter com mTLS antes de alterar o pagamento.

Eventos são identificados por SHA-256 do payload e persistidos em `inter_webhook_events`. Repetições retornam sucesso sem reaplicar o pagamento.
