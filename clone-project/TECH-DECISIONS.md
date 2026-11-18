# Architecture Decision Records (ADR) — Discord Clone

> Este documento registra as decisões arquiteturais significativas tomadas no projeto, com contexto, alternativas consideradas e justificativa.

---

## ADR-001 — NestJS como Framework Full-Stack

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Core Architecture

### Contexto
Precisamos de um framework backend robusto para construir a API REST, o Gateway WebSocket e servir as views do frontend.

### Decisão
Usar **NestJS** como único framework de aplicação, cobrindo:
- REST API (Controllers + Guards + Pipes)
- WebSocket Gateway (via `@nestjs/websockets` + Socket.io)
- Server-Side Rendering de views (via `@nestjs/serve-static` ou template engine)
- Background jobs (via BullMQ integrado ao NestJS)

### Alternativas Consideradas
| Alternativa | Motivo de Rejeição |
|---|---|
| React (SPA separada) | Complexidade de deploy duplo; overhead de build tooling adicional |
| Next.js | Adiciona dependência do ecossistema React que queremos evitar |
| Express.js puro | Sem estrutura opinativa; muito boilerplate para um app grande |
| Fastify puro | Mesma razão do Express |
| Hono | Ecossistema menor; menos recursos para real-time e DI |

### Consequências
- ✅ Uma única linguagem (TypeScript) em todo o stack
- ✅ Estrutura modular facilita onboarding e manutenção
- ✅ DI nativa reduz acoplamento entre módulos
- ✅ Decorators expressivos para auth guards, roles, validação
- ⚠️ Curva de aprendizado mais alta que Express puro
- ⚠️ SSR de UI pode exigir adapter de template engine (Handlebars/EJS)

---

## ADR-002 — PostgreSQL como Banco de Dados Principal

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Data Storage

### Contexto
Precisamos de um banco de dados relacional para armazenar usuários, guilds, canais e mensagens.

### Decisão
Usar **PostgreSQL 16** como banco de dados principal para todos os dados persistentes.

### Alternativas Consideradas
| Alternativa | Motivo de Rejeição |
|---|---|
| MySQL | Menos recursos avançados (JSON, full-text, arrays) |
| MongoDB | Sem transações ACID completas; schema flexível demais para nosso caso |
| ScyllaDB | Complexidade operacional; overkill para MVP |
| SQLite | Sem suporte a conexões concorrentes para produção |

### Consequências
- ✅ ACID completo para consistência de dados
- ✅ JSONB para metadados flexíveis (embeds, attachments)
- ✅ Full-text search nativo (fase 1; Elasticsearch na fase 4)
- ✅ Excelente suporte a Drizzle ORM e TypeORM
- ⚠️ Para escala de mensagens (> 100M registros), considerar migração para ScyllaDB

---

## ADR-003 — Drizzle ORM para Acesso ao Banco

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Data Access

### Contexto
Precisamos de um ORM/query builder que seja type-safe, performático e bem integrado com NestJS.

### Decisão
Usar **Drizzle ORM** com PostgreSQL.

### Alternativas Consideradas
| Alternativa | Motivo de Rejeição |
|---|---|
| Prisma | Gera tipos mas tem overhead de runtime; não é SQL-first |
| TypeORM | Decorators imperativos causam problemas com tipagem; bugs históricos |
| Kysely | Ótimo, mas menos integração com NestJS |
| SQL puro | Sem type-safety; propenso a erros |

### Consequências
- ✅ Schema definido em TypeScript = tipos inferidos automaticamente
- ✅ SQL-first: fácil de otimizar queries complexas
- ✅ Sem "magic" de ORM — o que você escreve é o que é executado
- ✅ Excelente performance (sem overhead de abstração pesada)
- ⚠️ Menos recursos de migração que Prisma (use `drizzle-kit`)

---

## ADR-004 — Socket.io para WebSocket Gateway

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Real-time Communication

### Contexto
Precisamos de um sistema de WebSocket que suporte múltiplas instâncias do servidor (scaling horizontal) e tenha integração nativa com NestJS.

### Decisão
Usar **Socket.io** com o **Redis Adapter** para escalonamento horizontal.

### Alternativas Consideradas
| Alternativa | Motivo de Rejeição |
|---|---|
| ws (nativo) | Sem rooms, sem reconnection automática, sem scaling adapter |
| µWebSockets | C++ binding; complexidade de deploy |
| Ably / Pusher | Dependência de terceiros; custo; menos controle |
| SSE (Server-Sent Events) | Unidirecional; não adequado para chat bidirecional |

### Consequências
- ✅ Rooms nativas = mapeamento direto para guilds/canais
- ✅ Reconnection automática com estado de sessão
- ✅ Redis Adapter para múltiplos pods sem código extra
- ✅ Integração perfeita com `@nestjs/websockets`
- ⚠️ Protocolo proprietário do Socket.io (clientes precisam da lib client-side)

---

## ADR-005 — Redis para Cache, Sessões e Pub/Sub

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Caching & Real-time Infrastructure

### Contexto
Precisamos de armazenamento em memória para sessões de autenticação, dados de presença, rate limiting e sincronização entre instâncias do Gateway.

### Decisão
Usar **Redis 7** para todos os casos de uso em memória.

### Consequências
- ✅ Uma única dependência para múltiplos casos de uso
- ✅ Pub/Sub nativo para sincronizar gateways horizontais
- ✅ Estruturas de dados ricas (hashes, sorted sets para rate limiting)
- ✅ TTL nativo para dados efêmeros (presença, sessões)
- ⚠️ Sem persistência garantida (use AOF para dados críticos)

---

## ADR-006 — mediasoup como SFU WebRTC

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Voice/Video

### Contexto
Precisamos implementar canais de voz com suporte a múltiplos participantes simultâneos.

### Decisão
Usar **mediasoup** como Selective Forwarding Unit (SFU) para WebRTC.

### Alternativas Consideradas
| Alternativa | Motivo de Rejeição |
|---|---|
| LiveKit | Excelente, mas caixa-preta; menos controle |
| Janus Gateway | C, complexidade operacional |
| Jitsi (Videobridge) | Java, overhead de JVM |
| Mesh P2P | Não escala além de 4-5 participantes |
| MCU (Mixing) | CPU intensivo; latência maior |

### Consequências
- ✅ Performance nativa (C++ core)
- ✅ Controle total sobre a pipeline de mídia
- ✅ Suporte a Opus (voz) e VP8/VP9/H264 (vídeo)
- ✅ Node.js API (integra com NestJS)
- ⚠️ Requer porta UDP exposta (3000-3999 por padrão)
- ⚠️ Complexidade de configuração inicial maior

---

## ADR-007 — MinIO para Armazenamento de Arquivos

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: File Storage

### Contexto
Usuários precisam enviar arquivos, imagens e avatares. Precisamos de um sistema de armazenamento de objetos.

### Decisão
Usar **MinIO** em desenvolvimento e **AWS S3 / Cloudflare R2** em produção (mesma API S3-compatible).

### Consequências
- ✅ Self-hosted em dev = sem custo e sem dependência de internet
- ✅ API S3-compatible = migração para R2/S3 é só mudar endpoint/credenciais
- ✅ Console web embutido para inspeção de arquivos
- ⚠️ Requer CDN na frente para servir arquivos em produção (Cloudflare)

---

## ADR-008 — BullMQ para Filas de Background

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Async Processing

### Contexto
Diversas operações não devem bloquear o request-response cycle: envio de emails, notificações push, processamento de imagens, indexação de busca.

### Decisão
Usar **BullMQ** (Redis-backed) com `@nestjs/bull` para jobs assíncronos.

### Consequências
- ✅ Aproveita o Redis já existente (sem nova dependência)
- ✅ Dashboard visual (Bull Board)
- ✅ Retry automático com backoff configurável
- ✅ Integração nativa com NestJS
- ⚠️ Se Redis cair, jobs na fila são perdidos (usar persistência AOF)

---

## ADR-009 — Autenticação via JWT + Refresh Tokens

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Authentication

### Contexto
Precisamos de um sistema de autenticação stateless e seguro.

### Decisão
- **Access Token**: JWT de vida curta (15 minutos), assinado com RS256
- **Refresh Token**: Token opaco de vida longa (30 dias), armazenado no Redis
- **Rotação**: Refresh token é invalidado e um novo é emitido a cada uso (rotation)

### Consequências
- ✅ Access tokens stateless = sem hit no banco para validar cada request
- ✅ Refresh tokens revogáveis (logout = delete do Redis)
- ✅ Rotação previne replay attacks
- ⚠️ Access tokens não são revogáveis antes de expirar (15 min window)

---

## ADR-010 — Turborepo + pnpm Workspaces (Monorepo)

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Project Structure

### Contexto
O projeto tem múltiplos packages (api, voice, desktop, shared types, configs) que precisam compartilhar código e ter builds coordenados.

### Decisão
Usar **Turborepo** com **pnpm workspaces** para gerenciar o monorepo.

### Consequências
- ✅ Cache de build remoto (builds CI muito mais rápidos)
- ✅ Pipeline de tarefas paralelas com dependências declaradas
- ✅ pnpm workspace = `packages/shared` acessível como pacote nos outros apps
- ⚠️ Curva de aprendizado do `turbo.json` pipeline config


---

## ADR-011 — Arquitetura Hexagonal (Ports & Adapters) e Preparação para Microserviços

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Software Architecture & Design Patterns

### Contexto
O Discord é um sistema massivo e distribuído com múltiplos domínios (identidade, mensagens, canais, presença e voz). Acoplar a lógica de negócio diretamente aos controllers do NestJS ou ao ORM tornaria o sistema frágil, difícil de testar e com acoplamento excessivo, dificultando a extração futura de microserviços.

### Decisão
Adotar a **Arquitetura Hexagonal (Ports & Adapters)** em conjunto com princípios de **Domain-Driven Design (DDD)**:

```
[ Driving Adapters ]            [ Application Layer ]            [ Driven Adapters ]
  - REST Controllers (Swagger) -> [ Inbound Ports / UseCases ]
  - WebSocket Gateways        -> [ Core Domain Entities ]      -> [ Outbound Ports / Interfaces ]
  - Microservice Consumers    ->                                    - Repository Port -> Postgres / Neon / Supabase
                                                                   - Cache Port      -> Redis
                                                                   - Event Port      -> EventBus / Microservices
```

1. **Core Domain (`domain/`)**: Entidades puras (ex: `User`, `Guild`, `Channel`, `Message`), Value Objects (ex: `SnowflakeId`, `Email`), regras invariantes de negócio sem dependência de bibliotecas externas ou do NestJS.
2. **Application (`application/`)**:
   - **Inbound Ports**: Interfaces dos Casos de Uso (ex: `SendMessageUseCase`, `CreateGuildUseCase`).
   - **Outbound Ports**: Interfaces de persistência e comunicação externa (ex: `UserRepositoryPort`, `EventPublisherPort`, `CachePort`).
3. **Adapters & Infrastructure (`infrastructure/`)**:
   - **Driving (Inbound)**: Controllers HTTP do NestJS com decorators Swagger, Gateways WebSocket (`@nestjs/websockets`).
   - **Driven (Outbound)**: Implementações de repositórios com Drizzle ORM / PostgreSQL, adaptadores de Redis, clientes de fila/microserviços.

### Consequências
- ✅ Regras de negócio 100% testáveis sem banco de dados ou servidor HTTP
- ✅ Módulos desacoplados que podem ser extraídos como microserviços independentes (ex: Voice SFU, Presence Gateway)
- ✅ Troca simplificada de infraestrutura (ex: trocar Postgres local por Neon.tech ou Supabase) sem tocar no domínio
- ⚠️ Mais arquivos e interfaces iniciais (compensado pela clareza e manutenção)

---

## ADR-012 — Documentação de APIs e DTOs com Swagger / OpenAPI

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: API Documentation & Developer Experience

### Contexto
Para facilitar o desenvolvimento, consumo por clientes (web, desktop, bots) e alinhamento com a especificação da API do Discord (v10), a API precisa de documentação viva, tipada e interativa.

### Decisão
Integrar `@nestjs/swagger` com especificação OpenAPI 3.0:
- Configurar Swagger Module no bootstrap da aplicação apontando para `/api/docs`.
- Documentar todos os DTOs com decorators `@ApiProperty()`, `@ApiPropertyOptional()` e validações `class-validator`.
- Documentar controllers com `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` e `@ApiBearerAuth()`.
- Exportar schema OpenAPI em `/api/docs-json` para geração automática de SDKs ou testes de contrato.

### Consequências
- ✅ Documentação sempre sincronizada com o código e DTOs
- ✅ Interface visual interativa para testar rotas sem ferramentas externas
- ✅ Validação automática de payloads com mensagens claras

---

## ADR-013 — Estratégia de Testes Automatizados com Jest

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Quality Assurance & Testing

### Contexto
Precisamos garantir a confiabilidade do sistema através de testes unitários rápidos e testes de integração confiáveis.

### Decisão
Padronizar o **Jest** como runner de testes unitários e de integração:
1. **Testes Unitários (`*.spec.ts`)**:
   - Foco em Use Cases, Entidades de Domínio e Helpers (ex: Snowflake generator).
   - Portas externas (repositórios, cache) 100% mockadas através de interfaces TypeScript.
   - Execução ultra rápida em memória (sem I/O, sem banco).
2. **Testes de Integração e E2E (`*.integration.spec.ts` / `*.e2e-spec.ts`)**:
   - Validação dos endpoints HTTP com `supertest` e do WebSocket Gateway.
   - Teste de adaptadores de persistência contra banco PostgreSQL real (local ou de teste).
3. **Scripts definidos**:
   - `npm run test` (todos os testes unitários)
   - `npm run test:unit` (somente unitários)
   - `npm run test:integration` (testes de integração/e2e)
   - `npm run test:cov` (relatório de cobertura)

### Consequências
- ✅ Feedback imediato durante refatoração
- ✅ Alta cobertura na camada de regras de negócio
- ✅ Conformidade com o prompt 09 e 02 de quality gates

---

## ADR-014 — Banco de Dados Padrão PostgreSQL com Suporte a Neon.tech e Supabase

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Database & Cloud Infrastructure

### Contexto
O projeto requer um banco de dados relacional robusto. Desenvolvedores e ambientes de produção podem optar por PostgreSQL local (Docker), PostgreSQL serverless via **Neon.tech** (ramificação de branches de dados e pooling eficiente) ou **Supabase** (Postgres gerenciado com extensões ricas).

### Decisão
Utilizar PostgreSQL padrão (SQL ANSI + extensões Postgres) através de uma camada de conexão flexível:
- Conexão configurada via string de conexão padrão `DATABASE_URL` (RFC 3986).
- Suporte a conexões SSL com `sslmode=require` / flags seguras, garantindo compatibilidade direta com Neon.tech e Supabase (via Transaction Pooler / PgBouncer na porta 6543 ou conexão direta na 5432).
- Schemas com Drizzle ORM definidos em código TypeScript sem travas proprietárias.

### Consequências
- ✅ Portabilidade total: o mesmo código roda em Docker local, Neon.tech Serverless ou Supabase
- ✅ Zero vendor lock-in
- ✅ Possibilidade de usar branches de banco no Neon para testes em CI/CD

---

## ADR-015 — Quality Gates: ESLint Ceiling (350 Linhas) e Limites Arquiteturais

**Data**: 2026-11-09  
**Status**: ✅ Aceito  
**Área**: Code Quality & Governance

### Contexto
A manutenção a longo prazo e a separação hexagonal exigem limites claros de tamanho de arquivos e de dependência entre camadas.

### Decisão
Adotar os quality gates baseados no Vibe Coding Toolkit:
1. **Limite de 350 linhas (`MAX_LINES=350`)**: Nenhum arquivo de lógica pode ultrapassar 350 linhas. Ao exceder, deve ser dividido respeitando responsabilidade única (Prompt 09).
2. **Fronteiras Arquiteturais**: A camada `domain` nunca pode importar de `infrastructure` ou bibliotecas de I/O.
3. **Burndown Contínuo**: Processo estruturado para zerar warnings (Prompt 02) com comandos estritos de verificação.

---

## ADR-016 — Armazenamento Local em VPS para Uploads e Anexos (Substituição de S3/MinIO)

**Data**: 2026-11-17  
**Status**: ✅ Aceito  
**Área**: File Storage & Cloud Cost Optimization

### Contexto
A utilização de serviços de nuvem como AWS S3 ou instâncias de MinIO para uploads gera custos adicionais recorrentes, latência de rede externa e dependência desnecessária para projetos auto-hospedados.

### Decisão
Utilizar o sistema de arquivos local da **VPS** para armazenamento de uploads (anexos, avatares e ícones):
- Diretório dedicado configurável via variável de ambiente `STORAGE_LOCAL_PATH` (ex: `/var/data/discord-clone/uploads`).
- Arquivos indexados por Snowflake ID e hash SHA-256 para evitar colisões e duplicatas.
- Servidos com cache HTTP estático de alta performance diretamente pelo Nginx / Caddy ou Express com suporte a streaming de vídeo e áudio.

### Consequências
- ✅ Custo zero adicional em nuvem (utiliza o disco NVMe da própria VPS).
- ✅ Latência ultrabaixa de escrita e leitura local.
- ✅ Backups simples e confiáveis via `rsync` ou snapshots periódicos da VPS.

---

## ADR-017 — Servidor SFU Dedicado com Mediasoup para Chamadas de Voz e Vídeo em Escala

**Data**: 2026-11-17  
**Status**: ✅ Aceito  
**Área**: Real-time Voice & Video Infrastructure

### Contexto
Chamadas em formato Mesh P2P não escalam além de 4 ou 5 participantes (consumo de banda de upload $O(n^2)$). É necessário um servidor Selective Forwarding Unit (SFU) para rotear fluxos RTP de áudio (Opus 48kHz) e vídeo/tela (VP8/H264) com sub-100ms de latência.

### Decisão
Implementar o módulo [`VoiceModule`](./src/modules/voice/voice.module.ts) utilizando **Mediasoup 3.x** integrado ao NestJS:
- Workers em C++ nativo gerenciando Routers isolados por canal de voz.
- Criação e conexão de `WebRtcTransport` para envio (`send`) e recepção (`recv`).
- Suporte a `MEDIASOUP_ANNOUNCED_IP` para auto-descoberta do IP público da VPS.
- Sinalização WebRTC em tempo real via [`VoiceGateway`](./src/modules/voice/voice.gateway.ts).

### Consequências
- ✅ Capacidade para dezenas de usuários simultâneos no mesmo canal de voz com baixo uso de CPU.
- ✅ Transmissão de tela e câmera em alta resolução (VP8/H264 60fps).
- ✅ Controle total sobre codecs, ICE candidates e DTLS.
