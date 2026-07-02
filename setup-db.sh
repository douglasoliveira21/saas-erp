#!/bin/bash

# Script para criar o banco de dados local

echo "🗄️ Criando banco de dados localmente..."
echo ""

# Executar o script SQL
PGPASSWORD='Vsi@#$3303Vsi' psql -U postgres -p 5432 -f setup-database.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Banco de dados criado com sucesso!"
    echo ""
    echo "📊 Executando seeds..."
    cd backend
    npm run seed
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Seeds executados com sucesso!"
        echo ""
        echo "🎉 Setup completo!"
        echo ""
        echo "Próximo passo: Execute ./start.sh para iniciar o sistema"
    else
        echo ""
        echo "❌ Erro ao executar seeds"
        echo "Verifique se as dependências estão instaladas: npm install"
    fi
else
    echo ""
    echo "❌ Erro ao criar banco de dados"
    echo ""
    echo "Verifique:"
    echo "1. PostgreSQL está rodando localmente"
    echo "2. Usuário e senha estão corretos"
    echo "3. Você tem permissões para criar bancos"
fi
