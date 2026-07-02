# ⚠️ LEIA-ME PRIMEIRO - Configuração do Banco

## 🔴 Problema Atual

A senha do PostgreSQL não está correta!

## ✅ SOLUÇÃO RÁPIDA

### Execute este comando:

```bash
configure-db.bat
```

Este script vai:
1. ✅ Perguntar qual PostgreSQL usar
2. ✅ Solicitar a senha correta
3. ✅ Testar a conexão
4. ✅ Criar o banco automaticamente
5. ✅ Executar os seeds

---

## 🔍 Descobrir a Senha

### Tente estas senhas comuns:

1. `postgres` (mais comum)
2. `admin`
3. `root`
4. (vazio - apenas Enter)

### Testar senha:

```bash
psql -U postgres
```

Se conectar, essa é a senha correta!

---

## 📝 Configuração Manual

Se preferir configurar manualmente:

1. **Edite**: `backend\.env`

2. **Altere a linha**:
```env
DATABASE_PASSWORD=SUA_SENHA_AQUI
```

3. **Salve o arquivo**

4. **Execute**:
```bash
setup-db.bat
start.bat
```

---

## 🎯 Próximos Passos

### Opção A: Automático (Recomendado)
```bash
configure-db.bat
```

### Opção B: Manual
1. Descubra a senha do PostgreSQL
2. Edite `backend\.env`
3. Execute `setup-db.bat`
4. Execute `start.bat`

---

## 📚 Documentação

- **[SENHA-POSTGRES.md](SENHA-POSTGRES.md)** - Guia completo de senhas
- **[SETUP-LOCAL.md](SETUP-LOCAL.md)** - Setup local
- **[QUICK_SETUP.md](QUICK_SETUP.md)** - Setup rápido

---

## 🆘 Precisa de Ajuda?

Execute o configurador:
```bash
configure-db.bat
```

Ele vai resolver tudo para você! 🚀
