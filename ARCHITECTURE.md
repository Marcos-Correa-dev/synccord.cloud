# Discord System Architecture (Inferred)

> This document describes Discord's inferred system architecture based on public engineering blog posts, job listings, conference talks, and observable network behavior. This is a best-effort reconstruction for educational purposes.

---

## High-Level Overview

Discord is a **microservices-based, event-driven platform** built for massive scale real-time communication. At its core, it separates:

1. **Gateway** — The stateful WebSocket layer that pushes events to clients
2. **API** — The stateless REST layer for CRUD operations
3. **Voice** — WebRTC-based media servers (Selective Forwarding Units)
4. **Services** — Dozens of specialized microservices for guilds, messages, presence, etc.

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Clients["Client Layer"]
        WEB["Web Browser"]
        DESK["Electron Desktop"]
        MOB["Mobile App (iOS/Android)"]
    end

    subgraph Edge["Edge / CDN Layer"]
        CF["Cloudflare CDN"]
        LB["Load Balancers (Anycast)"]
    end

    subgraph Gateway["Gateway Layer"]
        GW1["Gateway Node 1"]
        GW2["Gateway Node 2"]
        GW3["Gateway Node N"]
    end

    subgraph API["API Layer"]
        APIG["API Gateway"]
        AUTH["Auth Service"]
        REST["REST API Servers"]
    end

    subgraph Services["Core Microservices"]
        MSG["Message Service"]
        GUILD["Guild Service"]
        CHAN["Channel Service"]
        USER["User Service"]
        PRES["Presence Service"]
        NOTIF["Notification Service"]
        SEARCH["Search Service"]
        MEDIA["Media/CDN Service"]
    end

    subgraph RealTime["Real-time Infrastructure"]
        PUBSUB["Redis Pub/Sub (Cluster)"]
        KAFKA["Kafka Event Bus"]
    end

    subgraph Storage["Storage Layer"]
        PG["PostgreSQL (ScyllaDB for messages)"]
        REDIS["Redis Cluster"]
        S3["Object Storage (Attachments)"]
        ES["Elasticsearch (Search)"]
    end

    subgraph Voice["Voice/Video Layer"]
        SFU1["WebRTC SFU Node 1"]
        SFU2["WebRTC SFU Node 2"]
        SFUM["SFU Manager"]
    end

    WEB & DESK & MOB --> CF
    CF --> LB
    LB --> GW1 & GW2 & GW3
    LB --> APIG
    APIG --> AUTH
    APIG --> REST
    REST --> MSG & GUILD & CHAN & USER & PRES & NOTIF & SEARCH & MEDIA
    GW1 & GW2 & GW3 --> PUBSUB
    MSG & GUILD & PRES --> KAFKA
    KAFKA --> GW1 & GW2 & GW3
    MSG --> PG
    GUILD --> PG
    USER --> PG
    PRES --> REDIS
    GW1 & GW2 & GW3 --> REDIS
    MEDIA --> S3
    SEARCH --> ES
    WEB & DESK & MOB --> SFUM
    SFUM --> SFU1 & SFU2
```

---

## Microservices Breakdown

### 1. Gateway Service
- **Purpose**: Maintains persistent WebSocket connections with all clients
- **Tech**: Custom Erlang/Elixir service (later migrated to Rust for performance)
- **Scale**: Handles millions of concurrent WebSocket connections
- **Pattern**: Each gateway node maintains a session for connected clients; uses Redis pub/sub to receive events from other services and push them to relevant clients

### 2. API Service
- **Purpose**: Handles all REST HTTP requests
- **Tech**: Python (originally), Elixir/Go for high-throughput endpoints
- **Pattern**: Stateless, horizontally scalable. Routes requests to appropriate microservices.

### 3. Message Service
- **Purpose**: Store, retrieve, and fan-out messages
- **Storage**: Originally Cassandra, migrated to **ScyllaDB** for messages (chosen for time-series read patterns)
- **Pattern**: Write-heavy; messages are written to ScyllaDB then events published to Kafka

### 4. Guild Service
- **Purpose**: Manages server metadata, channels, roles, permissions
- **Storage**: PostgreSQL
- **Challenge**: Permission calculation for large servers (100k+ members)

### 5. Presence Service
- **Purpose**: Tracks online/idle/DND/offline status for all users
- **Storage**: Redis (purely in-memory, ephemeral)
- **Challenge**: Fan-out problem — when a user changes status, all friends/guild members must be notified
- **Solution**: Discord wrote a custom presence system; for large guilds, they use "lazy loading" (members presence is not sent for all members, only visible ones)

### 6. Voice Service
- **Purpose**: Route audio/video streams between participants
- **Tech**: WebRTC Selective Forwarding Units (SFUs)
- **Pattern**: Client connects to nearest SFU node; SFU forwards RTP streams between participants without decoding

### 7. Push Notification Service
- **Purpose**: Send push notifications to mobile devices
- **Tech**: Integrates with APNs (Apple) and FCM (Google)
- **Pattern**: Triggered by Kafka events; fans out to mobile-specific endpoints

---

## Data Flow: Sending a Message

```mermaid
sequenceDiagram
    participant C1 as Client (Sender)
    participant API as REST API
    participant MSG as Message Service
    participant DB as ScyllaDB
    participant K as Kafka
    participant GW as Gateway Nodes
    participant C2 as Client (Recipient)

    C1->>API: POST /channels/{id}/messages
    API->>MSG: CreateMessage(content, channelId, authorId)
    MSG->>DB: INSERT message
    DB-->>MSG: OK
    MSG->>K: Publish MESSAGE_CREATE event
    K->>GW: Fan-out to subscribed gateway nodes
    GW->>C2: WebSocket push: { op: 0, t: "MESSAGE_CREATE", d: {...} }
    API-->>C1: 200 OK { message object }
```

---

## Real-time Communication Architecture

### WebSocket Gateway Protocol

Discord uses a custom binary/JSON WebSocket protocol called the **Discord Gateway**:

```
Client <──── WSS ────> Gateway Node
                           │
                       Session Store (Redis)
                           │
                       Event Router (Kafka/Redis Pub/Sub)
                           │
                       Microservices
```

**Key design decisions:**
- Clients connect to `wss://gateway.discord.gg`
- Gateway returns a `HELLO` opcode with heartbeat interval
- Clients send periodic `HEARTBEAT` to maintain connection
- On disconnect, session is preserved for ~90 seconds (resumable)
- Clients send `RESUME` with sequence number to replay missed events

### Lazy Loading for Large Guilds

For guilds with many members, Discord does **not** send the full member list on `GUILD_CREATE`. Instead:
- Members are sent in chunks: `GUILD_MEMBERS_CHUNK` events
- Presence is "lazy-loaded" — only visible members have their presence updated
- Client requests member data as users scroll the member list

---

## Scalability Patterns

### 1. Read Replicas
- PostgreSQL read replicas for guild metadata
- ScyllaDB multi-region replication for messages

### 2. Caching Strategy
- Redis L1 cache for hot data (sessions, presence, rate limits)
- CDN caching for static assets and avatars

### 3. Rate Limiting
- Token bucket algorithm at the API gateway
- Per-route, per-user, per-guild limits
- Implemented in Redis using sliding window counters

### 4. Database Sharding
- Messages sharded by channel ID (time-series access pattern)
- Users/Guilds sharded by ID range in PostgreSQL

### 5. Event Sourcing via Kafka
- All significant state changes published as events to Kafka
- Enables async processing, audit logs, and event replay
- Powers features like message search indexing

---

## Network Topology

Discord uses **Anycast** routing via Cloudflare to route clients to the nearest edge node. Gateway connections are established to regional endpoints:

| Region | Endpoint |
|--------|---------|
| US East | gateway.discord.gg (default) |
| US West | gateway-us-west.discord.gg |
| Europe | gateway-eu.discord.gg |
| Asia | gateway-asia.discord.gg |

Voice servers are selected based on RTT (Round Trip Time) measurements during connection establishment.

---

## Security Architecture

### Authentication
- **User tokens**: Long-lived tokens stored in client; refreshed periodically
- **Bot tokens**: Static tokens for bots; can be reset manually
- **OAuth2 Bearer tokens**: Short-lived, scoped tokens for third-party apps

### Transport Security
- All connections use TLS 1.3
- WebSocket connections use WSS (WebSocket Secure)
- Voice/Video uses SRTP (Secure Real-time Transport Protocol)
- DTLS for WebRTC signaling

### Permission System
- Role-based access control (RBAC) with channel-level overrides
- Permissions stored as 64-bit integers (bitfields)
- Computed at request time by layering guild-level and channel-level overrides

---

## Known Technology Choices (from public sources)

| Component | Technology | Source |
|-----------|-----------|--------|
| Message Store | ScyllaDB (originally Cassandra) | Discord Engineering Blog |
| Cache | Redis | Discord Engineering Blog |
| Event Bus | Kafka | Discord Engineering Blog |
| Voice Infra | Custom Rust services | Discord Engineering Blog |
| CDN | Cloudflare | Observable |
| Desktop App | Electron | Observable |
| Mobile | React Native | Job listings |
| API (legacy) | Python/Elixir | Early blog posts |
