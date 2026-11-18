# Discord Reverse Engineering & Clone Project

> **⚠️ Ethical Disclaimer**: This project is intended **strictly for educational purposes**. The goal is to learn about modern real-time application architecture, Electron app structure, WebSocket protocols, and WebRTC by studying how Discord works. **Do not use this knowledge to:**
> - Violate Discord's Terms of Service
> - Create bots that automate user accounts (self-bots)
> - Scrape user data without consent
> - Impersonate Discord or deceive users
>
> All reverse engineering here relies on publicly available Discord developer documentation, legally captured network traffic from your own account, and open-source community research.

---

## 📋 Project Overview

This repository documents a deep-dive analysis of Discord's architecture, protocols, and design patterns — with the ultimate goal of building a **fully functional Discord clone** from scratch.

**Discord** is one of the most sophisticated real-time communication platforms ever built. It handles:
- 500+ million registered users
- 19+ million active servers (guilds)
- Real-time messaging with sub-100ms latency
- Voice/video calls with millions of concurrent users
- A cross-platform Electron desktop app
- Native mobile apps (iOS/Android)

By studying Discord, we learn about **distributed systems at scale**, **real-time protocols**, **WebRTC voice/video**, and **modern Electron app architecture**.

---

## 🗂️ Repository Structure

```
reverse-engineering/
├── README.md                        ← You are here
├── ARCHITECTURE.md                  ← Discord's inferred system architecture
│
├── docs/                            ← Deep-dive documentation
│   ├── 01-electron-structure.md     ← Electron app analysis & asar extraction
│   ├── 02-api-endpoints.md          ← Discord REST API reference
│   ├── 03-websocket-gateway.md      ← Gateway WebSocket protocol
│   ├── 04-auth-flow.md              ← Authentication & OAuth2
│   ├── 05-ui-components.md          ← UI structure & component hierarchy
│   ├── 06-voice-video.md            ← WebRTC voice/video implementation
│   ├── 07-data-models.md            ← Data models & TypeScript interfaces
│   └── 08-tech-stack.md             ← Recommended tech stack for clone
│
├── analysis/                        ← Raw analysis artifacts
│   ├── asar-contents.txt            ← Notes from asar extraction
│   └── network-capture-guide.md    ← How to capture Discord traffic
│
├── clone-project/                   ← Clone project planning
│   ├── README.md                    ← Phase-by-phase development plan
│   ├── TECH-DECISIONS.md            ← Architecture Decision Records
│   └── ROADMAP.md                   ← 6-month sprint roadmap
│
└── resources/
    └── references.md                ← Curated resource list
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ (for tooling)
- `asar` CLI: `npm install -g @electron/asar`
- Wireshark or mitmproxy (optional, for traffic analysis)
- A Discord developer account: https://discord.com/developers/applications

### Step 1: Understand the Architecture

Start with [ARCHITECTURE.md](./ARCHITECTURE.md) to get a high-level picture of how Discord's backend is structured.

### Step 2: Analyze the Electron App

Read [docs/01-electron-structure.md](./docs/01-electron-structure.md) to understand the app's structure and how to safely inspect it.

**Discord's app.asar location:**
```
C:\Users\marcos.correa\AppData\Local\Discord\app-1.0.9267\resources\app.asar
```

Extract it safely:
```bash
# Create a working directory
mkdir C:\discord-analysis
cd C:\discord-analysis

# Extract the asar (read-only analysis)
asar extract "C:\Users\marcos.correa\AppData\Local\Discord\app-1.0.9267\resources\app.asar" ./extracted
```

### Step 3: Set Up API Access

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Navigate to the "Bot" section
4. Copy your bot token
5. Use the token to explore the REST API (see [docs/02-api-endpoints.md](./docs/02-api-endpoints.md))

### Step 4: Monitor Network Traffic

Follow [analysis/network-capture-guide.md](./analysis/network-capture-guide.md) to capture and analyze Discord's network traffic from your own account.

### Step 5: Start Building

Once you understand the fundamentals, head to [clone-project/README.md](./clone-project/README.md) to begin building.

---

## 🛠️ Tech Stack for the Clone

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | NestJS SSR + Handlebars + Alpine.js | Server-side views + reatividade leve |
| **Styling** | Tailwind CSS | Design system utility-first |
| **Backend API** | Node.js + NestJS | REST API + WebSocket Gateway |
| **Real-time** | Socket.io + Redis Adapter | WebSocket escalável horizontalmente |
| **Architecture** | Hexagonal Architecture (Ports & Adapters) | Domínio isolado, desacoplado, microservices-ready |
| **Database** | PostgreSQL Padrão (Local / Neon.tech / Supabase) | Persistência relacional via Drizzle ORM |
| **API Docs** | Swagger / OpenAPI 3.0 (@nestjs/swagger) | Documentação interativa em `/api/docs` e DTOs tipados |
| **Testing** | Jest (Unit & Integration) | Testes unitários com mocks e integração com Supertest |
| **Quality Gates** | ESLint (Vibe Coding Toolkit - 350 max lines) | Teto de 350 linhas por arquivo e boundaries arquiteturais |
| **Cache** | Redis | Sessões, presença, pub/sub |
| **Voice/Video** | mediasoup (WebRTC SFU) | Canais de voz |
| **File Storage** | MinIO (S3-compatible) | Attachments, avatars |
| **Auth** | JWT + Refresh tokens | Autenticação |
| **Queue** | BullMQ + Redis | Background jobs |
| **Search** | Elasticsearch | Busca de mensagens |
| **Desktop App** | Electron (wrapping NestJS views) | App desktop |
| **Monorepo** | Turborepo + npm/pnpm workspaces | Gerenciamento de packages |

---

## 📚 Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture diagrams and microservices breakdown |
| [01 - Electron Structure](./docs/01-electron-structure.md) | How Discord's Electron app is organized |
| [02 - API Endpoints](./docs/02-api-endpoints.md) | Complete REST API reference |
| [03 - WebSocket Gateway](./docs/03-websocket-gateway.md) | Real-time event protocol |
| [04 - Auth Flow](./docs/04-auth-flow.md) | Authentication & token management |
| [05 - UI Components](./docs/05-ui-components.md) | Interface structure analysis |
| [06 - Voice & Video](./docs/06-voice-video.md) | WebRTC voice/video architecture |
| [07 - Data Models](./docs/07-data-models.md) | Entities & TypeScript interfaces |
| [08 - Tech Stack](./docs/08-tech-stack.md) | Technology recommendations for clone |
| [Clone README](./clone-project/README.md) | Clone project overview and MVP |
| [Tech Decisions](./clone-project/TECH-DECISIONS.md) | Architecture Decision Records |
| [Roadmap](./clone-project/ROADMAP.md) | 6-month development roadmap |
| [References](./resources/references.md) | Curated external resources |

---

## 🔗 Key External Resources

- [Discord Developer Portal](https://discord.com/developers/docs) — Official API docs
- [Discord API Server](https://discord.gg/discord-api) — Community server for API discussion
- [Fosscord/Spacebar](https://github.com/spacebarchat) — Open source Discord-compatible server
- [Better Discord](https://betterdiscord.app/) — Plugin ecosystem (community research)

---

## 📄 License

This research repository is for educational use only. Code examples are provided under MIT license. Research notes are for learning purposes only.
