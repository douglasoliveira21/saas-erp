# ⚡ Solução Rápida - Erro de Instalação

## 🔴 Problema

Você está em um caminho de rede (UNC): `\\Srv-vgon\e\SaaS-ERP`

O npm não consegue instalar dependências em caminhos UNC.

---

## ✅ SOLUÇÃO RÁPIDA

### Opção A: Mapear Unidade (Mais Rápido)

1. **Abra o CMD como Administrador**

2. **Mapear a unidade Z:**
```cmd
net use Z: \\Srv-vgon\e /persistent:yes
```

3. **Navegar para o projeto:**
```cmd
Z:
cd SaaS-ERP
```

4. **Instalar:**
```cmd
install-manual.bat
```

---

### Opção B: Copiar para C:\ (Mais Seguro)

1. **Copiar projeto:**
```cmd
xcopy "\\Srv-vgon\e\SaaS-ERP" "C:\SaaS-ERP" /E /I /H /Y
```

2. **Navegar:**
```cmd
cd C:\SaaS-ERP
```

3. **Instalar:**
```cmd
install-manual.bat
```

---

### Opção C: Instalação Manual (Sempre Funciona)

Execute estes comandos **um por vez**:

```cmd
# 1. Instalar raiz
npm install

# 2. Instalar backend
cd backend
npm install
cd ..

# 3. Instalar frontend
cd frontend
npm install
cd ..
```

---

## 🚀 Após Instalar

1. **Criar banco:**
```cmd
setup-db.bat
```

2. **Iniciar sistema:**
```cmd
start.bat
```

3. **Acessar:**
http://localhost:5001

---

## 💡 Recomendação

**Use a Opção B** (copiar para C:\) para melhor performance e evitar problemas de rede.

---

## 🆘 Ainda com Problemas?

Execute o CMD como **Administrador**:
1. Clique com botão direito no ícone do CMD
2. Selecione "Executar como administrador"
3. Tente novamente
