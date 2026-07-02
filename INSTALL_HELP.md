# 🆘 Ajuda com Instalação em Rede

## Problema: Caminho UNC não suportado

O erro ocorre porque você está em um caminho de rede: `\\Srv-vgon\e\SaaS-ERP`

## ✅ Solução 1: Mapear Unidade de Rede (RECOMENDADO)

### Passo 1: Mapear a unidade

```cmd
# Abra o CMD como Administrador e execute:
net use Z: \\Srv-vgon\e /persistent:yes
```

### Passo 2: Navegar para a pasta

```cmd
Z:
cd SaaS-ERP
```

### Passo 3: Instalar

```cmd
npm run install:all
```

---

## ✅ Solução 2: Copiar para Disco Local

### Passo 1: Copiar projeto

```cmd
# Copiar para C:\
xcopy "\\Srv-vgon\e\SaaS-ERP" "C:\SaaS-ERP" /E /I /H /Y
```

### Passo 2: Navegar e instalar

```cmd
cd C:\SaaS-ERP
npm run install:all
```

---

## ✅ Solução 3: Instalar Manualmente

Se as soluções acima não funcionarem, instale manualmente:

### Passo 1: Navegar para o backend

```cmd
cd backend
npm install
```

### Passo 2: Navegar para o frontend

```cmd
cd ..\frontend
npm install
```

### Passo 3: Voltar para raiz

```cmd
cd ..
npm install
```

---

## 🚀 Após Instalar

### 1. Criar banco de dados

```cmd
setup-db.bat
```

### 2. Iniciar sistema

```cmd
start.bat
```

---

## 🐛 Outros Problemas Comuns

### Erro de Permissão

Execute o CMD como **Administrador**:
1. Clique com botão direito no CMD
2. Selecione "Executar como administrador"

### Antivírus Bloqueando

Adicione a pasta do projeto às exceções do antivírus.

### Node/npm não encontrado

Verifique se o Node.js está instalado:
```cmd
node --version
npm --version
```

Se não estiver, baixe em: https://nodejs.org/

---

## 📞 Precisa de Ajuda?

Consulte [SETUP.md](SETUP.md) para mais detalhes.
