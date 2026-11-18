# Referências e Recursos — Discord Reverse Engineering & Clone

> Lista curada de recursos externos organizados por categoria.

---

## 📚 Documentação Oficial

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Discord Developer Portal | https://discord.com/developers/docs | API oficial, Gateway, OAuth2, bot docs |
| Discord API Reference v10 | https://discord.com/developers/docs/reference | Endpoints REST completos |
| Discord Gateway Reference | https://discord.com/developers/docs/topics/gateway | Protocolo WebSocket detalhado |
| Discord Opcodes | https://discord.com/developers/docs/topics/opcodes-and-status-codes | Opcodes do Gateway |
| Discord Permissions | https://discord.com/developers/docs/topics/permissions | Sistema de permissões em bitfield |
| Discord OAuth2 | https://discord.com/developers/docs/topics/oauth2 | Fluxo OAuth2 |

---

## 🛠️ NestJS (Framework Principal)

| Recurso | URL | Descrição |
|---------|-----|-----------|
| NestJS Docs | https://docs.nestjs.com | Documentação oficial |
| NestJS WebSockets | https://docs.nestjs.com/websockets/gateways | Gateway WebSocket com Socket.io |
| NestJS Guards | https://docs.nestjs.com/guards | Guards para auth e permissões |
| NestJS Pipes & Validation | https://docs.nestjs.com/techniques/validation | class-validator + class-transformer |
| NestJS BullMQ | https://docs.nestjs.com/techniques/queues | Filas de background |
| NestJS JWT | https://docs.nestjs.com/security/authentication | Autenticação com Passport + JWT |
| NestJS MVC (Views) | https://docs.nestjs.com/techniques/mvc | Server-side rendering com Handlebars |
| NestJS Serve Static | https://docs.nestjs.com/recipes/serve-static | Servir assets estáticos |

---

## 🗄️ Banco de Dados

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Drizzle ORM Docs | https://orm.drizzle.team/docs/overview | ORM type-safe para PostgreSQL |
| Drizzle Kit (migrations) | https://orm.drizzle.team/kit-docs/overview | CLI de migrations |
| PostgreSQL 16 Docs | https://www.postgresql.org/docs/16/ | Referência completa do PostgreSQL |
| Drizzle + NestJS | https://orm.drizzle.team/docs/guides/nestjs | Integração Drizzle com NestJS |

---

## ⚡ Real-time (Socket.io + Redis)

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Socket.io Docs | https://socket.io/docs/v4/ | Documentação oficial Socket.io |
| Socket.io Redis Adapter | https://socket.io/docs/v4/redis-adapter/ | Scaling horizontal com Redis |
| ioredis | https://github.com/redis/ioredis | Cliente Redis para Node.js |
| Redis Commands | https://redis.io/commands/ | Referência de comandos Redis |
| Redis Pub/Sub | https://redis.io/docs/manual/pubsub/ | Pub/Sub para sincronia entre instâncias |

---

## 🎙️ Voz e Vídeo (WebRTC + mediasoup)

| Recurso | URL | Descrição |
|---------|-----|-----------|
| mediasoup Docs | https://mediasoup.org/documentation/ | SFU WebRTC Node.js |
| mediasoup-client | https://mediasoup.org/documentation/v3/mediasoup-client/ | Lib cliente WebRTC |
| WebRTC Basics (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API | Conceitos WebRTC |
| coturn | https://github.com/coturn/coturn | Servidor STUN/TURN open-source |
| Opus Codec | https://opus-codec.org/ | Codec de áudio usado no Discord |
| RNNoise | https://jmvalin.ca/demo/rnnoise/ | Noise suppression neural network |

---

## 🗂️ Projetos Open-Source de Referência

| Projeto | URL | O Que Aprender |
|---------|-----|----------------|
| **Fosscord / Spacebar** | https://github.com/spacebarchat | Clone Discord-compatible mais avançado |
| **Guilded** | https://www.guilded.gg | Concorrente do Discord, bons conceitos |
| **Revolt.chat** | https://github.com/revoltchat | Clone moderno, stack Rust/React |
| **Rocket.Chat** | https://github.com/RocketChat/Rocket.Chat | Chat platform completa open-source |
| **Matrix/Element** | https://github.com/element-hq/element-web | Protocolo federado de chat |
| **NestJS Realtime Chat** | https://github.com/nestjs/nest/tree/master/sample | Exemplos oficiais NestJS |

---

## 📖 Blog Posts de Engenharia do Discord

| Artigo | URL | Conteúdo |
|--------|-----|----------|
| How Discord Stores Billions of Messages | https://discord.com/blog/how-discord-stores-billions-of-messages | Cassandra → ScyllaDB migration |
| Discord's Pastebin Clone | https://discord.com/blog/how-discord-supercharges-network-disks | Latência de storage |
| How Discord Scaled Elixir to 5M Concurrent Users | https://discord.com/blog/scaling-elixir-at-discord | Arquitetura de Gateway |
| How Discord Maintains Performance While Adding Features | https://discord.com/blog/how-discord-maintains-performance-while-adding-features | Performance engineering |
| How Discord Resizes 150 Million Images | https://discord.com/blog/how-discord-resizes-150-million-images | Image processing pipeline |
| Why Discord is Switching from Go to Rust | https://discord.com/blog/why-discord-is-switching-from-go-to-rust | Read States service Rust migration |
| How Discord Stores Trillions of Messages | https://discord.com/blog/how-discord-stores-trillions-of-messages | ScyllaDB deep dive |

---

## 🏗️ Arquitetura e Padrões

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Designing Data-Intensive Applications | https://dataintensive.net/ | Livro essencial para sistemas distribuídos |
| System Design Primer | https://github.com/donnemartin/system-design-primer | Design de sistemas em escala |
| Building Realtime Apps | https://ably.com/blog | Blog técnico da Ably sobre real-time |
| Redis Architecture Patterns | https://redis.com/redis-best-practices/introduction/ | Padrões de uso do Redis |
| Socket.io Scaling | https://socket.io/docs/v4/using-multiple-nodes/ | Multi-node Socket.io |

---

## 🔐 Segurança

| Recurso | URL | Descrição |
|---------|-----|-----------|
| JWT Best Practices | https://datatracker.ietf.org/doc/html/rfc8725 | RFC de segurança JWT |
| OWASP Top 10 | https://owasp.org/www-project-top-ten/ | Vulnerabilidades mais comuns |
| Helmet.js | https://helmetjs.github.io/ | Headers HTTP de segurança |
| NestJS Security | https://docs.nestjs.com/security/helmet | Configuração de segurança no NestJS |
| bcrypt | https://www.npmjs.com/package/bcrypt | Hash de senhas |
| argon2 | https://github.com/ranisalt/node-argon2 | Alternativa mais moderna ao bcrypt |

---

## 🛳️ DevOps e Infraestrutura

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Turborepo Docs | https://turbo.build/repo/docs | Monorepo build system |
| pnpm Workspaces | https://pnpm.io/workspaces | Gerenciamento de monorepo |
| Docker Best Practices | https://docs.docker.com/develop/dev-best-practices/ | Boas práticas de containerização |
| Kubernetes Docs | https://kubernetes.io/docs/home/ | Orquestração de containers |
| Caddy Server | https://caddyserver.com/docs/ | Reverse proxy com TLS automático |
| Prometheus + Grafana | https://prometheus.io/docs/ | Monitoramento e alertas |

---

## 🎨 UI / Frontend (NestJS Views)

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Handlebars.js | https://handlebarsjs.com/guide/ | Template engine para NestJS |
| Alpine.js | https://alpinejs.dev/ | Reatividade leve para views SSR |
| HTMX | https://htmx.org/docs/ | Interatividade sem JS framework completo |
| Tailwind CSS | https://tailwindcss.com/docs | Utility-first CSS |
| Radix UI (Primitives) | https://www.radix-ui.com/primitives | Componentes acessíveis sem opinionated styling |

---

## 🧰 Ferramentas de Análise / Debugging

| Ferramenta | URL | Uso |
|------------|-----|-----|
| mitmproxy | https://mitmproxy.org | Interceptar tráfego HTTPS |
| Wireshark | https://www.wireshark.org | Análise de pacotes de rede |
| @electron/asar | https://github.com/electron/asar | Extrair conteúdo do app Electron |
| Postman | https://www.postman.com | Testar APIs REST e WebSocket |
| RedisInsight | https://redis.io/insight/ | GUI para inspecionar dados Redis |
| TablePlus | https://tableplus.com | GUI para PostgreSQL |
| Grafana k6 | https://k6.io/docs/ | Load testing de APIs e WS |

---

## 📺 Vídeos e Talks

| Conteúdo | URL | Descrição |
|----------|-----|-----------|
| Discord Engineering at Scale (Talk) | https://www.youtube.com/watch?v=... | Arquitetura interna do Discord |
| Building Real-time Apps with NestJS | https://www.youtube.com/results?search_query=nestjs+websocket | Tutoriais NestJS WebSocket |
| mediasoup SFU Tutorial | https://www.youtube.com/results?search_query=mediasoup+webrtc | Implementação de SFU com mediasoup |
| System Design: Discord | https://www.youtube.com/results?search_query=system+design+discord | Vídeos de system design do Discord |
