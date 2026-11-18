#!/usr/bin/env bash
set -e

echo "🔄 Atualizando SyncCord..."

# Determinar diretório do projeto
if [ -d "/home/ubuntu/synccord.cloud/clone-project" ]; then
    cd /home/ubuntu/synccord.cloud/clone-project
elif [ -d "clone-project" ]; then
    cd clone-project
fi

echo "📥 Baixando últimas atualizações do GitHub..."
git pull origin main

echo "🔨 Recompilando o backend..."
npm run build

echo "⚡ Reiniciando o processo no PM2..."
pm2 restart synccord-api --update-env

echo "✅ SyncCord atualizado e rodando com sucesso!"
pm2 status
