# Banco do Brasil por empresa (tenant)

Esta integração permite registrar, consultar e cancelar boletos e Pix imediatos. As vendas parceladas emitem um boleto por parcela. Contratos emitem cobranças com referências separadas por mês e vencimento. O PDF usa a linha digitável e o código de barras retornados pelo BB. O recebimento é consultado pela conciliação periódica já existente no ERP e pelo botão de consulta de status.

Extratos, pagamentos de fornecedores em lote, devoluções de Pix e webhook do BB não fazem parte desta entrega. O catálogo fica **em teste** até a homologação com a conta beneficiária. Os testes automatizados usam respostas simuladas; não comprovam autorização da conta real.

## Antes de abrir o sistema

1. No Developers BB, abra sua aplicação e clique em **Credenciais**.
2. Escolha **Ambiente de teste** para homologação ou **Ambiente de produção** para cobranças reais. Copie o Client ID, Client Secret e App Key desse mesmo ambiente para o cadastro abaixo.
3. Tenha em mãos o convênio de cobrança com **7 dígitos**, a carteira, a variação e a modalidade informados pelo BB. Outros formatos de convênio não estão contemplados nesta versão.
4. Para Pix, tenha uma chave Pix ativa no BB e o A1 da empresa em PFX/P12, com a senha do arquivo, ou o certificado e a chave privada em PEM. O certificado público e a cadeia devem estar aprovados no Developers BB para o ambiente utilizado. O certificado público do servidor do banco não substitui o A1 da empresa.
5. Confira as permissões da aplicação: boletos usam `cobrancas.boletos-info` e `cobrancas.boletos-requisicao`; Pix imediato usa `cob.read` e `cob.write`.

## Cadastrar pelo Super Admin

1. Entre no painel **Super Admin**.
2. Clique em **Clientes** no menu.
3. Na linha da empresa, escolha **Banco do Brasil** no campo de banco. Aguarde a atualização.
4. Na mesma linha, clique no ícone de chave com o título **Configurar Banco do Brasil**.
5. No formulário, escolha o ambiente correspondente às credenciais.
6. Cole Client ID, Client Secret e App Key. Preencha convênio, carteira, variação, agência, conta e dados do beneficiário. Não use dados de outra empresa.
7. Em **Arquivo .pfx ou .p12**, clique para selecionar o A1 da empresa. Preencha **Senha do arquivo A1**. Se já possui PEM, abra **Já tenho certificado e chave em PEM** e cole os conteúdos nos dois campos.
8. Se o convênio permite boleto com QR Code Pix, marque **Incluir Pix no boleto**. Isso é diferente de emitir um Pix imediato separado.
9. Clique em **Salvar configuração**. Os campos de segredo ficam vazios depois de salvar; isso é esperado. Na próxima edição, deixe-os vazios para conservar os valores salvos.
10. Clique em **Testar boleto** e depois em **Testar Pix**. Cada botão verifica autenticação e permissões, sem emitir cobrança. Um teste aprovado não confirma convênio, cadastro do pagador nem liquidação.
11. Para permitir emissão, marque **Ativar emissão por esta empresa** e clique em **Salvar configuração** novamente.

## Cadastrar dentro do próprio tenant

1. Entre na empresa com um usuário administrador e plano com módulo de pagamentos.
2. Clique em **Banco do Brasil** no menu do ERP. A tela abre como **Banco do Brasil Avançado**.
3. Preencha o formulário e siga os passos 5 a 11 acima. É a mesma configuração que o Super Admin acessa para essa empresa.

## Testar uma emissão

1. Cadastre um cliente com documento e endereço válidos para o ambiente de homologação do BB. O BB exige pagadores de teste específicos; consulte os dados na documentação da API.
2. Crie uma venda e escolha **boleto**, informando valor e vencimento.
3. Emita o boleto. Confira o recebimento vinculado à venda, baixe o PDF e valide beneficiário, valor, vencimento, linha digitável e leitura do código de barras no banco.
4. Faça outra venda escolhendo **Pix**, emita e confira o código copia e cola.
5. Consulte o status no ERP após a liquidação simulada/confirmada pelo banco. O status de baixa/cancelamento do BB não é tratado como pagamento.
6. Em produção, o teste de emissão cria uma cobrança real. Use a conta e o cliente corretos; homologue o fluxo completo antes de iniciar o uso regular.

O BB informa que cancelamento de boleto somente é aceito após 30 minutos da emissão. Se a tentativa for recusada, o ERP informa o erro e não confirma um cancelamento local fictício.

## Backend / EasyPanel

As credenciais BB são cadastradas no formulário de cada empresa; não é necessário criar `BB_CLIENT_ID` ou `BB_CLIENT_SECRET` globais. O backend já deve possuir `CREDENTIAL_ENCRYPTION_KEY`, a chave persistente usada para criptografar credenciais. Não a altere ao trocar uma credencial bancária. Em rotação planejada, configure a antiga em `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS`.

Após publicar esta versão, o entrypoint do Docker executa a migração `1794900000000-BancoBrasilIntegration` antes de iniciar o backend. Ela cria as tabelas de configuração e referências bancárias e habilita BB no catálogo como **em teste**. Fora do Docker, rode o procedimento de migrations do projeto antes de subir o serviço. Esta migração não altera sequências fiscais nem boletos Inter existentes.

O backend precisa de acesso HTTPS aos hosts oficiais de autenticação, Cobranças e Pix do BB. A validação TLS permanece ligada. Dados de A1, chave privada e credenciais não são devolvidos pela API de leitura e são ocultados nos registros de auditoria/operação. Versões anteriores das credenciais ficam criptografadas para consultar e cancelar cobranças emitidas com aquela configuração.

Se uma emissão sofrer timeout, tente consultar/repetir a mesma operação. O ERP guarda a referência antes do envio e consulta o mesmo título antes de reenviar. Não crie outra venda para contornar uma falha sem antes conferir a cobrança no banco.

## Documentação de referência

- [Cobranças BB v2: emissão, consulta e cancelamento](https://apoio.developers.bb.com.br/apis/5?topico=18894721&versaoApi=2)
- [API Pix do BB](https://www.bb.com.br/site/developers/api-pix/)
- [Autenticação mTLS no BB](https://apoio.developers.bb.com.br/guias-e-tutoriais/seguranca/autenticacao-mtls)
- [Especificação oficial da API Pix do Banco Central](https://github.com/bacen/pix-api/blob/master/openapi.yaml)
