#!/usr/bin/env bash
set -e

echo "========================================================"
echo "🚀 INICIANDO DEPLOY AUTOMATIZADO DO SYNCCORD"
echo "========================================================"

# 1. Instalar pacotes de sistema se necessário
echo "📦 Verificando dependências do sistema..."
sudo apt-get update -y
sudo apt-get install -y docker.io docker-compose-v2 git curl nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER" || true

# 2. Node.js 22 LTS & PM2
echo "📦 Configurando Node.js 22 LTS..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Baixar ou atualizar o repositório
cd "$HOME"
if [ ! -d "synccord.cloud" ]; then
    echo "📥 Clonando repositório..."
    git clone https://github.com/Marcos-Correa-dev/synccord.cloud.git
    cd synccord.cloud
else
    echo "🔄 Atualizando repositório..."
    cd synccord.cloud
    git fetch origin
    git reset --hard origin/main
fi

cd clone-project

# 4. Configurar .env de produção (preservando SMTP_PASS caso já exista na VPS)
echo "⚙️ Configurando .env de produção..."
EXISTING_SMTP_PASS=""
if [ -f ".env" ]; then
    EXISTING_SMTP_PASS=$(grep -E '^SMTP_PASS=' .env | head -n 1 | cut -d '=' -f2- || true)
    if [[ "$EXISTING_SMTP_PASS" == \$\{* ]]; then
        EXISTING_SMTP_PASS=""
    fi
fi

FINAL_SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
FINAL_SMTP_PORT="${SMTP_PORT:-465}"
FINAL_SMTP_SECURE="${SMTP_SECURE:-true}"
FINAL_SMTP_USER="${SMTP_USER:-correa.marcospaulo@gmail.com}"
FINAL_SMTP_PASS="${SMTP_PASS:-$EXISTING_SMTP_PASS}"
FINAL_SMTP_FROM="${SMTP_FROM:-\"SyncCord\" <correa.marcospaulo@gmail.com>}"

cat << EOF > .env
PORT=3000
NODE_ENV=production
API_PREFIX=api/v10
FRONTEND_URL=https://synccord.cloud
DATABASE_URL=postgresql://postgres:postgres@localhost:5435/synccord_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=synccord_prod_secret_key_cloud_2026_secure
JWT_EXPIRATION=900s
REFRESH_TOKEN_EXPIRATION=30d
SMTP_HOST=${FINAL_SMTP_HOST}
SMTP_PORT=${FINAL_SMTP_PORT}
SMTP_SECURE=${FINAL_SMTP_SECURE}
SMTP_USER=${FINAL_SMTP_USER}
SMTP_PASS=${FINAL_SMTP_PASS}
SMTP_FROM=${FINAL_SMTP_FROM}
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./public/uploads
MAX_FILE_SIZE_MB=25
MEDIASOUP_ANNOUNCED_IP=77.113.21.82
EOF

# 5. Subir Docker (PostgreSQL & Redis)
echo "🐳 Iniciando contêineres Docker (synccord_postgres & synccord_redis)..."
sudo docker compose up -d

echo "⏳ Aguardando banco de dados inicializar..."
sleep 4

# 6. Compilar e inicializar o Backend
echo "🔨 Instalando dependências e compilando backend..."
npm install
npm run build

echo "🌱 Criando tabelas e executando seed do banco de dados..."
npm run db:seed

# 7. Iniciar com PM2 (detectando caminho correto do dist)
echo "⚡ Inicializando aplicação com PM2..."
MAIN_JS="dist/main.js"
if [ -f "dist/src/main.js" ]; then
    MAIN_JS="dist/src/main.js"
fi

echo "Arquivo de entrada: $MAIN_JS"
pm2 delete synccord-api 2>/dev/null || true
pm2 start "$MAIN_JS" --name "synccord-api"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$USER" --hp "$HOME" || true

# 8. Configurar Nginx
echo "🌐 Configurando Nginx para synccord.cloud..."
sudo rm -f /etc/nginx/sites-enabled/default

cat << 'EOF' | sudo tee /etc/nginx/sites-available/synccord.cloud > /dev/null
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
EOF

sudo ln -sf /etc/nginx/sites-available/synccord.cloud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 9. Gerar Certificado SSL (HTTPS)
echo "🔒 Gerando Certificado SSL Let's Encrypt com Certbot..."
sudo certbot --nginx -d synccord.cloud -d www.synccord.cloud --non-interactive --agree-tos -m marcos.correa@fpf.br || true

echo "========================================================"
echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "Acesse agora: https://synccord.cloud"
echo "========================================================"
