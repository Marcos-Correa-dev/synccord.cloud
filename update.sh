#!/usr/bin/env bash
set -e

echo "========================================================"
echo "🔄 Atualizando SyncCord na VPS..."
echo "========================================================"

# 1. Ir para a raiz do repositório Git
if [ -d "$HOME/synccord.cloud" ]; then
    cd "$HOME/synccord.cloud"
elif [ -d "../clone-project" ]; then
    cd ..
fi

echo "📥 Baixando últimas atualizações do repositório..."
git fetch origin
git reset --hard origin/main

# 2. Entrar na pasta da aplicação
cd clone-project

# 3. Verificar contêineres Docker (PostgreSQL & Redis)
echo "🐳 Garantindo que os contêineres Docker estão ativos..."
sudo docker compose up -d

# 4. Instalar dependências se necessário e compilar
echo "🔨 Compilando o backend..."
npm install
npm run build

# 5. Reiniciar aplicação no PM2
echo "⚡ Reiniciando processo no PM2..."
pm2 restart synccord-api --update-env || pm2 start dist/src/main.js --name synccord-api

echo "========================================================"
echo "✅ SyncCord atualizado e rodando com sucesso!"
echo "========================================================"
pm2 status
sudo docker compose ps
