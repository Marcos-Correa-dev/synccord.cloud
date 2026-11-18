# SyncCord (SyncCord.cloud) — Project Overview

> A high-performance, production-ready communication and voice platform built with modern web and native desktop technologies.

---

## 🎯 Project Goals

Build a **production-quality Discord clone** with the following core features:

| Feature | Priority | Status |
|---------|----------|--------|
| User registration & authentication | P0 | Planned |
| Real-time messaging (guilds & DMs) | P0 | Planned |
| Guilds, channels, categories | P0 | Planned |
| Roles & permissions | P0 | Planned |
| Message history & pagination | P0 | Planned |
| File attachments | P1 | Planned |
| Voice channels (WebRTC) | P1 | Planned |
| Reactions & emoji | P1 | Planned |
| Message search | P2 | Planned |
| Video sharing & screen share | P2 | Planned |
| Rich Presence / activities | P3 | Planned |
| Threads | P3 | Planned |
| Server discovery | P3 | Planned |
| Mobile apps | P4 | Planned |

---

## 🏗️ MVP Definition

The **Minimum Viable Product** includes:

1. **Authentication** — Register, login, logout with JWT tokens
2. **Guilds** — Create, join (via invite), leave servers
3. **Channels** — Text channels organized in categories
4. **Real-time messaging** — Send/receive messages via WebSocket
5. **Message history** — Load past messages with infinite scroll
6. **User presence** — Online/offline status
7. **Basic permissions** — Admin, moderator, member roles

**MVP does NOT include:** voice/video, file attachments, threads, search

---

## 🗂️ Monorepo Structure

```
discord-clone/
├── apps/
│   ├── web/                    ← NestJS Full-Stack (REST API + WebSocket + SSR)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── GuildSidebar.tsx
│   │   │   │   │   ├── ChannelSidebar.tsx
│   │   │   │   │   └── MemberList.tsx
│   │   │   │   ├── chat/
│   │   │   │   │   ├── MessageList.tsx
│   │   │   │   │   ├── MessageItem.tsx
│   │   │   │   │   └── ChatInput.tsx
│   │   │   │   └── ui/              ← Shared UI primitives
│   │   │   ├── stores/              ← Zustand stores
│   │   │   ├── views/               <- Handlebars templates (SSR)
│   │   │   ├── services/            ← API client, WebSocket
│   │   │   └── types/               ← TypeScript types
│   │   └── package.json
│   │
│   ├── api/                    ← NestJS REST API
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── guilds/
│   │   │   ├── channels/
│   │   │   ├── messages/
│   │   │   ├── voice/
│   │   │   └── gateway/            ← WebSocket gateway
│   │   └── package.json
│   │
│   ├── voice/                  ← mediasoup voice server
│   │   ├── src/
│   │   └── package.json
│   │
│   └── desktop/                ← Electron wrapper (Phase 4)
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── shared/                 ← Shared TypeScript types
│   │   └── src/types/
│   │       ├── user.ts
│   │       ├── guild.ts
│   │       ├── channel.ts
│   │       ├── message.ts
│   │       └── gateway.ts       ← WebSocket event types
│   │
│   └── config/                 ← Shared configs (ESLint, TSConfig)
│
├── infrastructure/
│   ├── docker-compose.yml      ← Local development
│   ├── docker-compose.prod.yml ← Production
│   └── k8s/                    ← Kubernetes manifests
│
└── turbo.json                  ← Turborepo config
```

---

## 🏛️ Hexagonal Architecture (Ports & Adapters)

O projeto adota a **Arquitetura Hexagonal (Ports & Adapters)** com TypeScript e NestJS para isolar o domínio das tecnologias de infraestrutura:

```
[ Inbound Adapters ]              [ Application Layer ]              [ Outbound Adapters ]
- HTTP Controllers + Swagger ---> [ Inbound Ports / UseCases ]
- WebSocket Gateway          ---> [ Domain Entities & Rules  ]  ---> [ Outbound Ports ]
                                                                      - UserRepositoryPort    -> Drizzle / Postgres (Local/Neon/Supabase)
                                                                      - GuildRepositoryPort   -> Drizzle / Postgres
                                                                      - ChannelRepositoryPort -> Drizzle / Postgres
                                                                      - MessageRepositoryPort -> Drizzle / Postgres
                                                                      - MessageEventPublisher -> WebSocket Gateway
```

### Estrutura dos Módulos Hexagonais:
```
src/
├── app.module.ts
├── main.ts
├── shared/
│   ├── snowflake/                ← Snowflake ID 64-bit Generator (Discord Epoch)
│   └── constants/                ← Permissions, ChannelTypes, GatewayOpcodes
├── infrastructure/
│   ├── database/                 ← PostgreSQL + Drizzle ORM (Local / Neon / Supabase)
│   └── redis/                    ← Redis Client para cache, presença e pub/sub
└── modules/
    ├── auth/                     ← Autenticação (Register, Login, JWT Guard, Bcrypt)
    │   ├── domain/               ← User Entity puro
    │   ├── application/          ← Inbound/Outbound Ports & Use Cases
    │   └── infrastructure/       ← Controllers Swagger, DTOs tipados, Drizzle Adapter
    ├── guilds/                   ← Servidores / Guilds (Create, List, Default Channels)
    ├── channels/                 ← Canais (Texto, Voz, Categorias)
    ├── messages/                 ← Mensagens em tempo real e paginação cursor-based
    └── gateway/                  ← WebSocket Gateway (Socket.io) + Event Publisher
```

---

## 🚀 Getting Started

### Pré-requisitos

```bash
node -v    # >= 20.0.0
npm -v     # >= 10.0.0
docker -v  # Opcional (se usar PostgreSQL local)
```

### Configuração Inicial

```bash
# 1. Acesse o diretório do projeto
cd clone-project

# 2. Configure as variáveis de ambiente
cp .env.example .env

# 3. Inicie os serviços locais (PostgreSQL, Redis, MinIO)
docker-compose up -d

# 4. Inicie o servidor em modo de desenvolvimento
npm run start:dev
```

A aplicação estará disponível em:
- **Discord Web App (Interface Completa)**: `http://localhost:3000` ou `http://localhost:3000/app`
- **Swagger UI Interativo**: `http://localhost:3000/api/docs`
- **API REST (v10)**: `http://localhost:3000/api/v10`
- **WebSocket Gateway**: `ws://localhost:3000`

---

## 💻 Aplicativo Desktop (Executável Electron)

O aplicativo Desktop do Discord (`Discord.exe`) na realidade é um **wrapper Electron** que empacota o motor Chromium e Node.js para rodar a Web App nativamente com suporte a bandeja do sistema (tray), atalhos globais e notificações.

Nosso projeto inclui a mesma implementação Desktop em [`desktop/`](./desktop/):

```bash
# 1. Iniciar o Discord Clone Desktop como janela nativa
npm run desktop

# 2. Gerar o instalador executável (.exe) para Windows
npm run desktop:build
```

O instalador `.exe` será gerado automaticamente na pasta `desktop/dist-electron/`.

---

## 🌐 Configuração do Banco de Dados (PostgreSQL / Neon.tech / Supabase)

O backend suporta qualquer PostgreSQL padrão configurado através da variável `DATABASE_URL` no `.env`:

### Opção 1: Docker Local (padrão)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/discord_clone
```

### Opção 2: Neon.tech (Serverless PostgreSQL)
```env
DATABASE_URL=postgresql://neondb_owner:password@ep-branch-name.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Opção 3: Supabase (PostgreSQL Gerenciado)
```env
# Conexão direta (porta 5432) ou Transaction Pooler (porta 6543)
DATABASE_URL=postgresql://postgres.your-project-ref:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 🧪 Estratégia de Testes Automatizados (Jest)

```bash
# Executar todos os testes
npm test

# Executar testes unitários (Use Cases e Domínio com portas 100% mockadas)
npm run test:unit

# Executar testes de integração / E2E com Supertest
npm run test:integration

# Gerar relatório de cobertura de código
npm run test:cov
```

---

## 🛡️ Quality Gates (ESLint & Vibe Coding Toolkit)

O projeto segue as regras estritas de qualidade de código do Vibe Coding Toolkit:
- **Ceiling de 350 linhas por arquivo**: Nenhum arquivo pode exceder 350 linhas (`quality/max-lines`).
- **Barreiras arquiteturais**: O domínio nunca acessa infraestrutura diretamente.
- **Validação das regras**:

```bash
# Verificar a integridade das regras customizadas
npm run verify:rules

# Executar o linter e verificar violações de tamanho
npm run lint

# Checagem estrita de tipos TypeScript
npm run typecheck
```

This starts:
- **Frontend** at `http://localhost:3000`
- **API** at `http://localhost:3000`
- **WebSocket Gateway** at `ws://localhost:3000/gateway`
- **Voice server** at `http://localhost:3001`

---

## 📋 Development Phases

### Phase 1 — Foundation (Weeks 1-4)
Focus: Get basic messaging working end-to-end.

- [x] Project setup (monorepo, TypeScript, linting)
- [ ] Database schema (users, guilds, channels, messages)
- [ ] Auth service (register, login, JWT)
- [ ] REST API endpoints (guilds CRUD, channels CRUD, messages CRUD)
- [ ] WebSocket gateway (message delivery, presence)
- [ ] NestJS Views setup (Handlebars + layout base)
- [ ] Auth pages (login, register)
- [ ] Guild sidebar + channel list
- [ ] Message list (virtual scroll)
- [ ] Message input (basic text)

### Phase 2 — Core Features (Weeks 5-8)
Focus: Make it feel like Discord.

- [ ] Roles & permissions system
- [ ] Server invites
- [ ] File attachments (images, documents)
- [ ] Emoji reactions
- [ ] User profiles & settings
- [ ] Message editing & deletion
- [ ] Typing indicators
- [ ] Unread message tracking
- [ ] Notifications (mentions, DMs)
- [ ] Dark/light theme

### Phase 3 — Voice & Video (Weeks 9-14)
Focus: Real-time audio/video.

- [ ] mediasoup SFU setup
- [ ] Voice channel join/leave flow
- [ ] Audio capture and streaming
- [ ] Mute/deafen controls
- [ ] Speaking indicator (VAD)
- [ ] Video sharing (camera)
- [ ] Screen sharing
- [ ] Noise suppression (RNNoise)

### Phase 4 — Advanced Features (Weeks 15-24)
Focus: Polish and power features.

- [ ] Message search (Elasticsearch)
- [ ] Thread support
- [ ] Server discovery
- [ ] Webhooks
- [ ] Rich embeds
- [ ] Server audit log
- [ ] Electron desktop app
- [ ] Mobile web optimizations
- [ ] Rate limiting (production-grade)
- [ ] Performance optimization

---

## 🧪 Testing Strategy

```
Unit tests:        Services, utilities, permission calculations
Integration tests: API endpoints (supertest)
E2E tests:         Critical user flows (Playwright)
Load tests:        Message throughput, WebSocket connections (k6)
```

```bash
# Run all tests
pnpm test

# Unit tests (services, gateways)
pnpm --filter api test:unit

# API integration tests
pnpm --filter api test:e2e

# Load test (message send)
k6 run infrastructure/load-tests/message-send.js
```
