# Roadmap de Desenvolvimento — Discord Clone
# Stack: NestJS (Full-Stack) · PostgreSQL · Redis · Socket.io · mediasoup

> Roadmap de **24 semanas** (6 meses) dividido em 4 fases.  
> Cada sprint tem 2 semanas. Critérios de aceite são verificáveis.

---

## Visão Geral das Fases

```
Semanas  1-6   → Fase 1: Foundation (Core API + Gateway + UI básica via NestJS)
Semanas  7-12  → Fase 2: Core Features (Permissões, uploads, reações)
Semanas 13-18  → Fase 3: Voice & Video (mediasoup WebRTC)
Semanas 19-24  → Fase 4: Polish & Scale (Search, Electron, performance)
```

---

## 🏗️ Fase 1 — Foundation (Semanas 1–6)

**Meta**: Sistema de mensagens funcional end-to-end, acessível via browser.

### Sprint 1 (Semanas 1–2) — Projeto Base (NestJS + Hexagonal + Swagger + Jest)

**Objetivo**: Estrutura Hexagonal configurada, Swagger ativo, Jest configurado, banco modelado (Postgres/Neon/Supabase) e Auth funcionando.

| Tarefa | Responsável | Critério de Aceite |
|--------|------------|-------------------|
| Inicializar projeto NestJS + TypeScript | Dev | `npm run build` compila sem erros |
| Estruturar camadas Hexagonais (domain, application, infrastructure) | Dev | Regras de domínio isoladas sem dependência de framework |
| Configurar Swagger / OpenAPI (@nestjs/swagger) | Dev | Acesso interativo em `/api/docs` e spec em `/api/docs-json` |
| Configurar ESLint com limite de 350 linhas (Quality Gates) | Dev | `npm run lint` valida limites de linhas e boundaries |
| Configurar Jest para testes unitários e de integração | Dev | `npm run test:unit` e `npm run test:integration` funcionando |
| Modelar Schema PostgreSQL (users, guilds, channels, messages) | Dev | Compatível com Docker local, Neon.tech e Supabase |
| Implementar Auth (Register/Login) com Use Cases Hexagonais | Dev | `POST /api/v10/auth/login` retorna JWT e documentado no Swagger |
| Implementar JWT Guard + estratégia de refresh tokens | Dev | Endpoints protegidos retornam 401 sem token |
| Configurar Redis (sessões + presença) | Dev | Health check do Redis no startup |
| Docker Compose com postgres + redis + minio | Dev | `docker-compose up` sobe tudo em < 30s |

**Deliverable**: API Hexagonal com Swagger em `/api/docs`, Auth funcional e suite Jest operacional.

---

### Sprint 2 (Semanas 3–4) — Guilds, Canais e Mensagens (Hexagonal + DTOs Swagger)

**Objetivo**: CRUD completo de servidores e canais com portas/adaptadores, DTOs documentados no Swagger e testes Jest.

| Tarefa | Critério de Aceite |
|--------|-------------------|
| CRUD de Guilds (Use Cases + Drizzle Adapter + Controller Swagger) | GET /api/v10/guilds/{id} retorna guild e canais |
| CRUD de Channels (texto, categorias) | POST /api/v10/guilds/{id}/channels cria canal |
| CRUD de Messages (criar, listar com paginação cursor-based) | GET /api/v10/channels/{id}/messages?limit=50&before={id} |
| Documentação Swagger completa para todos os DTOs | `@ApiProperty()` com exemplos em todos os DTOs |
| Convites de servidor (invite links) | POST /api/v10/guilds/{id}/invites gera código único |
| Validação de DTOs com `class-validator` | Requests inválidos retornam 400 com erros descritivos |
| Testes unitários de Use Cases (Jest com mocks) | Coverage > 80% nos serviços da camada application |
| Testes de integração dos endpoints (Supertest) | Testes e2e cobrindo fluxos críticos |

**Deliverable**: API REST funcional para guilds + canais + mensagens.

---

### Sprint 3 (Semanas 5–6) — WebSocket Gateway + UI básica (NestJS Views)

**Objetivo**: Mensagens em tempo real via WebSocket. Interface mínima servida pelo NestJS.

| Tarefa | Critério de Aceite |
|--------|-------------------|
| WebSocket Gateway com Socket.io | Conexão WS autenticada em < 100ms |
| Rooms: usuário entra nos rooms de seus guilds | `guild:{id}` room broadcast funciona |
| Eventos: `message:new`, `message:edit`, `message:delete` | Dois browsers recebem eventos em tempo real |
| Presença: online/offline via heartbeat | Status muda ao fechar a aba |
| Redis Adapter para scaling horizontal | Dois pods do NestJS sincronizando eventos |
| Configurar template engine (Handlebars) no NestJS | NestJS serve views `.hbs` em `/views` |
| View: Login e Registro | Formulário HTML funcional, sem JS framework |
| View: Layout principal (sidebar + chat) | HTML/CSS do layout Discord-like |
| View: Lista de guilds na sidebar | Guilds do usuário renderizadas server-side |
| View: Chat com histórico de mensagens | Mensagens carregadas no SSR |
| Client-side JS vanilla para WebSocket | Novas mensagens aparecem sem reload |

**Deliverable**: App funcional no browser. Usuário pode se registrar, entrar em um servidor e trocar mensagens em tempo real.

---

## 🚀 Fase 2 — Core Features (Semanas 7–12)

**Meta**: App que se parece e funciona como o Discord para uso diário.

### Sprint 4 (Semanas 7–8) — Sistema de Permissões

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Modelo de Roles (permissões em bitfield 64-bit) | Roles criados e atribuídos a membros |
| Channel-level permission overrides | Usuário sem permissão recebe 403 |
| Guards no NestJS para verificação de permissões | `@RequirePermissions(SEND_MESSAGES)` funciona |
| Hierarquia de permissões (guild > role > channel override) | Ordem correta de resolução |
| Moderação: kick, ban, timeout | POST /guilds/{id}/members/{id}/kick funciona |
| Audit Log básico (ações registradas no banco) | Ações moderativas salvas com autor e timestamp |

---

### Sprint 5 (Semanas 9–10) — Uploads e Mídia

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Upload de arquivos via MinIO/S3 | POST /channels/{id}/attachments aceita multipart |
| Visualização de imagens inline no chat | `<img>` tags renderizadas para .jpg/.png/.gif |
| Upload de avatar (usuário e servidor) | PATCH /users/@me com `avatar` base64 ou multipart |
| Presigned URLs para upload direto | Cliente pode fazer upload sem passar pelo servidor |
| Validação de tipo/tamanho de arquivo | Arquivos > 10MB rejeitados |
| Thumbnails de imagem (sharp.js) | Imagens redimensionadas no upload |

---

### Sprint 6 (Semanas 11–12) — UX & Features de Chat

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Reações com emoji | POST /channels/{id}/messages/{id}/reactions/{emoji}/@me |
| Edição de mensagens | PATCH /channels/{id}/messages/{id} com `edited_at` |
| Deleção de mensagens | DELETE (soft delete) com evento WS |
| Indicador de digitação (`typing:start`) | "Usuário está digitando..." aparece via WS |
| Menções (@usuário, @role, @everyone) | Parsing e highlight de menções no chat |
| DMs (Direct Messages) | Canais privados entre dois usuários |
| Notificações de menção (badge no sidebar) | Contador de não-lidos persiste entre sessões |
| Dark/light theme via CSS variables | Toggle no settings do usuário |

---

## 🎙️ Fase 3 — Voice & Video (Semanas 13–18)

**Meta**: Canais de voz funcionando com múltiplos participantes.

### Sprint 7 (Semanas 13–14) — Infraestrutura de Voz

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Configurar servidor mediasoup separado | `apps/voice` rodando com mediasoup workers |
| API de coordenação de voz no NestJS | POST /voice/channels/{id}/join retorna SDP |
| Sinalização WebRTC via WebSocket | ICE candidates trocados corretamente |
| STUN/TURN com coturn | Conexões funcionam atrás de NAT |
| Dois clientes no mesmo canal de voz | Audio flui entre participantes |

---

### Sprint 8 (Semanas 15–16) — Features de Voz

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Mute/Deafen (microfone e saída) | Outros participantes não recebem áudio mutado |
| Indicador de quem está falando (VAD) | Bordão verde animado ao falar |
| Lista de participantes na UI | Sidebar direita mostra membros no canal de voz |
| Desconexão limpa ao sair | Resources do mediasoup liberados |
| Push-to-talk | Microfone só abre enquanto tecla pressionada |

---

### Sprint 9 (Semanas 17–18) — Video & Screen Share

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Vídeo de câmera | Câmera transmitida para outros participantes |
| Compartilhamento de tela | `getDisplayMedia()` → SFU → participantes |
| Múltiplos streams de video na UI | Grid de vídeos no canal de voz |
| Controles de qualidade (720p/1080p) | Usuário pode selecionar qualidade |
| Noise suppression (opcional: RNNoise via WASM) | Ruído de fundo reduzido |

---

## ✨ Fase 4 — Polish & Scale (Semanas 19–24)

**Meta**: App production-ready com busca, desktop app e performance optimizada.

### Sprint 10 (Semanas 19–20) — Busca

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Integrar Elasticsearch | Índice `messages` criado |
| Indexar mensagens no ES ao criar/editar/deletar | Mensagens indexadas via BullMQ worker |
| API de busca: GET /guilds/{id}/search?q=texto | Resultados retornados em < 200ms |
| UI de busca com highlights | Termos buscados destacados nos resultados |

---

### Sprint 11 (Semanas 21–22) — Electron Desktop

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Criar app Electron (`apps/desktop`) | `pnpm dev:desktop` abre janela Electron |
| Electron carrega a UI servida pelo NestJS | App funciona completamente no Electron |
| Controles de janela nativos (custom titlebar) | Minimize, maximize, close funcionam |
| System tray + notificações nativas | Notificações aparecem na bandeja do sistema |
| Auto-updater (electron-updater) | Updates baixados em background |
| Build para Windows/macOS/Linux | Instaladores gerados via `electron-builder` |
| IPC: push-to-talk hotkey global | Tecla funciona mesmo com app em background |

---

### Sprint 12 (Semanas 23–24) — Performance & Hardening

| Tarefa | Critério de Aceite |
|--------|-------------------|
| Rate limiting por IP e por usuário | 429 retornado ao exceder limits |
| Paginação e índices no PostgreSQL | EXPLAIN mostra uso de índices |
| Connection pooling (PgBouncer) | App suporta > 100 conexões simultâneas |
| Load test com k6 | 1000 usuários simultâneos sem degradação > 20% |
| Monitoramento (Prometheus + Grafana) | Dashboard de latência, conexões WS, erros |
| Logging estruturado (Pino + ELK ou Loki) | Logs searcháveis com trace IDs |
| Health checks e readiness probes | Kubernetes pode detectar pods unhealthy |
| Dockerfile multi-stage otimizado | Imagem final < 200MB |
| Kubernetes manifests (HPA) | Auto-scaling baseado em CPU/conexões WS |

---

## 📊 Marcos Principais

| Marco | Semana | Descrição |
|-------|--------|-----------|
| **M1 — Alpha** | 6 | Mensagens funcionam em tempo real no browser |
| **M2 — Beta** | 12 | App completo de chat com uploads e reações |
| **M3 — Voice** | 18 | Canais de voz funcionando |
| **M4 — Release** | 24 | App desktop + production-ready |

---

## 🔧 Decisões de Prioridade

```
P0 — Sem isso o app não funciona: auth, mensagens, WebSocket
P1 — Core UX: uploads, reações, permissões, DMs
P2 — Features Discord-like: voz, busca, threads
P3 — Polish: Electron, screen share, noise suppression
P4 — Scale: Kubernetes, Elasticsearch clusters, CDN global
```

---

## ⏭️ Fora do Escopo (Para Futuro)

- Mobile apps (React Native ou PWA)
- Slash commands (bot framework)
- Plugins/extensões
- Server boosting / Nitro equivalente
- Stage channels
- Forum channels
- Activities (mini-games)
