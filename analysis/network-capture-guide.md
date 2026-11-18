# Guia de Captura de Tráfego de Rede — Discord

> **⚠️ IMPORTANTE**: Capture apenas o tráfego da **sua própria conta**. Nunca intercepte ou analize tráfego de outros usuários. Isso viola a LGPD/GDPR e os Termos de Serviço do Discord.

---

## Objetivo

Entender os protocolos de rede usados pelo Discord capturando o tráfego HTTP/WebSocket da **sua própria sessão**. Isso nos ajuda a replicar fielmente o protocolo no clone.

---

## Ferramenta 1 — Chrome DevTools (mais simples)

### Passo a Passo

1. Abra o Discord no navegador: `https://discord.com/app`
2. Pressione `F12` → aba **Network**
3. Filtre por `WS` para ver as conexões WebSocket
4. Filtre por `XHR` para ver as chamadas REST

### O Que Observar

#### Conexão WebSocket (Gateway)
```
URL: wss://gateway.discord.gg/?v=10&encoding=json
```

Clique na conexão WS → aba **Messages** para ver os frames:

**Enviados pelo cliente (↑):**
```json
// Heartbeat
{ "op": 1, "d": 12345 }

// Identify (autenticação)
{
  "op": 2,
  "d": {
    "token": "SEU_TOKEN_AQUI",
    "properties": {
      "os": "Windows",
      "browser": "Chrome",
      "device": ""
    },
    "intents": 32767
  }
}
```

**Recebidos do servidor (↓):**
```json
// Hello (heartbeat interval)
{ "op": 10, "d": { "heartbeat_interval": 41250 } }

// Ready event
{ "op": 0, "t": "READY", "s": 1, "d": { "v": 10, "user": {...}, "guilds": [...] } }

// Message Create
{ "op": 0, "t": "MESSAGE_CREATE", "s": 42, "d": { "id": "...", "content": "hello", ... } }
```

#### REST API Calls
Filtre por `XHR` e observe:
- `GET /api/v10/channels/{id}/messages?limit=50` — carregar mensagens
- `POST /api/v10/channels/{id}/messages` — enviar mensagem
- `GET /api/v10/users/@me/guilds` — listar servidores
- `PATCH /api/v10/users/@me` — atualizar perfil

---

## Ferramenta 2 — mitmproxy (Análise HTTPS completa)

### Instalação
```bash
# Windows
winget install mitmproxy

# Ou via pip
pip install mitmproxy
```

### Configuração

1. **Iniciar o proxy:**
```bash
mitmweb --listen-port 8080
```

2. **Configurar proxy no Windows:**
   - Settings → Network → Proxy → Manual proxy
   - Host: `127.0.0.1`, Port: `8080`

3. **Instalar certificado raiz:**
   - Acesse `http://mitm.it` no navegador
   - Baixe e instale o certificado para Windows

4. **Capturar tráfego do Discord Web:**
```bash
# Iniciar com filtro para discord.com
mitmweb --listen-port 8080 -f "~d discord.com"
```

### Decodificar tráfego WebSocket

```bash
# Script Python para interceptar e logar frames WS
# salvar como: discord_capture.py

from mitmproxy import websocket

def websocket_message(flow: websocket.WebSocketFlow):
    msg = flow.messages[-1]
    if "discord" in flow.request.host:
        direction = "CLIENT → SERVER" if msg.from_client else "SERVER → CLIENT"
        print(f"\n{direction}: {msg.content[:500]}")
```

Executar:
```bash
mitmdump -s discord_capture.py --listen-port 8080
```

---

## Ferramenta 3 — Wireshark (Análise de Baixo Nível)

> Para analisar tráfego UDP/SRTP de voz

### Instalação
```
https://www.wireshark.org/download.html
```

### Capturar Tráfego de Voz

1. Inicie uma chamada de voz no Discord
2. No Wireshark, filtre por: `udp && !dns`
3. Observe pacotes UDP para endereços IP do Discord (ex: `162.159.x.x` — Cloudflare)

### Decodificar DTLS/SRTP
```wireshark
# Filtro para DTLS (handshake de voz)
dtls

# Filtro para RTP após descriptografar
rtp
```

> ⚠️ Os pacotes de voz são criptografados com SRTP. Você só consegue ver os pacotes UDP, não o conteúdo de áudio.

---

## Análise do Gateway WebSocket em Detalhe

### Sequência de Conexão Observada

```
1. TCP Handshake   → discord.gg:443
2. TLS Handshake   → TLS 1.3, ALPN=http/1.1
3. HTTP Upgrade    → GET /?v=10&encoding=json HTTP/1.1
                     Upgrade: websocket
                     Connection: Upgrade
                     Sec-WebSocket-Key: <random>
4. 101 Switching Protocols
5. WS Frame: OP 10 HELLO          ← servidor envia heartbeat interval
6. WS Frame: OP 2  IDENTIFY       ← cliente envia token + capabilities
7. WS Frame: OP 0  READY          ← servidor confirma sessão
8. WS Frame: OP 0  GUILD_CREATE   ← servidor envia dados de cada servidor
9. Loop: OP 1 HEARTBEAT a cada ~41s
```

### Headers HTTP Importantes
```
Authorization: TOKEN_AQUI
X-Discord-Locale: pt-BR
X-Discord-Timezone: America/Sao_Paulo
X-Super-Properties: BASE64_ENCODED_CLIENT_INFO
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
```

O header `X-Super-Properties` é um objeto JSON em base64 com info do cliente:
```json
{
  "os": "Windows",
  "browser": "Chrome",
  "device": "",
  "system_locale": "pt-BR",
  "browser_user_agent": "Mozilla/5.0 ...",
  "browser_version": "120.0.0.0",
  "os_version": "10",
  "referrer": "",
  "referring_domain": "",
  "referrer_current": "",
  "referring_domain_current": "",
  "release_channel": "stable",
  "client_build_number": 999999,
  "client_event_source": null
}
```

---

## Endpoints REST Capturados

### Autenticação
```
POST /api/v10/auth/login
POST /api/v10/auth/logout
POST /api/v10/auth/mfa/totp
```

### Usuário
```
GET  /api/v10/users/@me
PATCH /api/v10/users/@me
GET  /api/v10/users/@me/guilds
GET  /api/v10/users/@me/channels   ← DMs
GET  /api/v10/users/@me/connections
```

### Servidores (Guilds)
```
GET  /api/v10/guilds/{id}
POST /api/v10/guilds
PATCH /api/v10/guilds/{id}
DELETE /api/v10/guilds/{id}
GET  /api/v10/guilds/{id}/channels
GET  /api/v10/guilds/{id}/members?limit=100&after=0
GET  /api/v10/guilds/{id}/roles
GET  /api/v10/guilds/{id}/invites
POST /api/v10/guilds/{id}/invites
```

### Canais & Mensagens
```
GET  /api/v10/channels/{id}
PATCH /api/v10/channels/{id}
GET  /api/v10/channels/{id}/messages?limit=50&before={id}
POST /api/v10/channels/{id}/messages
PATCH /api/v10/channels/{id}/messages/{id}
DELETE /api/v10/channels/{id}/messages/{id}
POST /api/v10/channels/{id}/messages/{id}/reactions/{emoji}/@me
DELETE /api/v10/channels/{id}/messages/{id}/reactions/{emoji}/@me
POST /api/v10/channels/{id}/typing
```

---

## Rate Limits Observados

| Endpoint | Limite | Janela |
|----------|--------|--------|
| POST /messages | 5 req | 5 seg |
| POST /messages (global) | 50 req | 10 seg |
| PUT/DELETE reactions | 1 req | 0.25 seg |
| GET /messages | 5 req | 5 seg |
| POST typing | 1 req | 5 seg |

Headers de rate limit retornados:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1699999999.999
X-RateLimit-Reset-After: 5.000
X-RateLimit-Bucket: abc123
X-RateLimit-Global: false
```

---

## Próximos Passos

Com essas informações capturadas, você pode:
1. Replicar o protocolo Gateway no NestJS WebSocket Gateway
2. Implementar os mesmos rate limits na API NestJS
3. Modelar os DTOs de acordo com os formatos observados
4. Implementar o cabeçalho `X-Super-Properties` equivalente no cliente

Veja [docs/03-websocket-gateway.md](../docs/03-websocket-gateway.md) para a implementação do Gateway.
