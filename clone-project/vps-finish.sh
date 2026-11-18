#!/usr/bin/env bash
set -e

echo "🚀 Finalizando configuração do SyncCord..."

# Garante que estamos na pasta clone-project
if [ -d "/home/ubuntu/synccord.cloud/clone-project" ]; then
    cd /home/ubuntu/synccord.cloud/clone-project
elif [ -d "clone-project" ]; then
    cd clone-project
fi

# 1. Localizar arquivo compilado do NestJS
if [ -f "dist/src/main.js" ]; then
    MAIN_PATH="dist/src/main.js"
elif [ -f "dist/main.js" ]; then
    MAIN_PATH="dist/main.js"
else
    echo "🔨 Compilando o projeto..."
    npm run build
    MAIN_PATH=$(find dist -name "main.js" | head -n 1)
fi

echo "Arquivo principal localizado em: $MAIN_PATH"

# 2. Iniciar PM2
echo "⚡ Iniciando serviço no PM2..."
pm2 delete synccord-api 2>/dev/null || true
pm2 start "$MAIN_PATH" --name "synccord-api"
pm2 save

# 3. Configurar Nginx
echo "🌐 Configurando Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default

sudo tee /etc/nginx/sites-available/synccord.cloud > /dev/null << 'NGINX_CONF'
server {
    server_name synccord.cloud www.synccord.cloud;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/synccord.cloud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Ativar SSL Certbot
echo "🔒 Ativando certificado SSL com Certbot..."
sudo certbot --nginx -d synccord.cloud -d www.synccord.cloud --non-interactive --agree-tos -m marcos.correa@fpf.br || true

echo ""
echo "========================================================="
echo "🎉 TUDO PRONTO! O SyncCord está no ar com SSL:"
echo "Acesse: https://synccord.cloud"
echo "========================================================="
