#!/bin/bash

# Script para iniciar o sistema completo

echo "🚀 Iniciando Sistema de Gestão TI..."
echo ""

# Verificar se as dependências estão instaladas
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm run install:all
    echo ""
fi

# Verificar se os arquivos .env existem
if [ ! -f "backend/.env" ]; then
    echo "⚙️ Criando arquivo backend/.env..."
    cp backend/.env.example backend/.env
fi

if [ ! -f "frontend/.env" ]; then
    echo "⚙️ Criando arquivo frontend/.env..."
    cp frontend/.env.example frontend/.env
fi

echo "✅ Configuração completa!"
echo ""
echo "🔧 Iniciando backend na porta 5000..."
echo "🎨 Iniciando frontend na porta 5001..."
echo ""
echo "📍 Acesse: http://localhost:5001"
echo "📍 API: http://localhost:5000/api"
echo ""
echo "👤 Login: admin@empresa.com / Admin@123"
echo ""

# Iniciar backend e frontend
npm run dev
