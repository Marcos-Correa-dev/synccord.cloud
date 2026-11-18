# 02 — Discord REST API Endpoints Reference

> **Source**: This document is based on Discord's official public API documentation at https://discord.com/developers/docs/reference

---

## Base URL & Versioning

```
https://discord.com/api/v10
```

Discord currently uses **API version 10** (as of 2024). Always specify the version:

```
https://discord.com/api/v10/<endpoint>
```

| Version | Status |
|---------|--------|
| v10 | Current (recommended) |
| v9 | Deprecated |
| v8 | Deprecated |
| v6 | Deprecated |

---

## Authentication

All API requests require authentication via the `Authorization` header:

```http
# Bot token (for bots)
Authorization: Bot YOUR_BOT_TOKEN

# Bearer token (for OAuth2 user flows)
Authorization: Bearer USER_ACCESS_TOKEN

# User token (self-bots — AGAINST ToS, educational reference only)
Authorization: USER_TOKEN
```

### Example authenticated request

```typescript
const response = await fetch('https://discord.com/api/v10/users/@me', {
  headers: {
    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (https://my-clone.example.com, 1.0.0)',
  }
});
```

---

## Rate Limiting

Discord uses **per-route rate limiting** with a global limit on top.

### Rate Limit Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Requests allowed in this window |
| `X-RateLimit-Remaining` | Requests remaining in this window |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets |
| `X-RateLimit-Reset-After` | Seconds until reset |
| `X-RateLimit-Bucket` | Unique bucket identifier for this route |
| `X-RateLimit-Global` | Present if global rate limit was hit |
| `X-RateLimit-Scope` | `user`, `global`, or `shared` |

### Rate Limit Response (HTTP 429)

```json
{
  "message": "You are being rate limited.",
  "retry_after": 1.337,
  "global": false
}
```

### TypeScript Rate Limit Handler

```typescript
class RateLimitManager {
  private buckets = new Map<string, { remaining: number; resetAt: number }>();

  async request(url: string, options: RequestInit): Promise<Response> {
    const bucket = this.getBucket(url);
    
    if (bucket && bucket.remaining === 0) {
      const delay = bucket.resetAt - Date.now();
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const response = await fetch(url, options);

    // Update bucket from response headers
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '1');
    const resetAfter = parseFloat(response.headers.get('X-RateLimit-Reset-After') || '0');
    const bucketId = response.headers.get('X-RateLimit-Bucket');

    if (bucketId) {
      this.buckets.set(bucketId, {
        remaining,
        resetAt: Date.now() + resetAfter * 1000,
      });
    }

    if (response.status === 429) {
      const body = await response.json();
      await new Promise(resolve => setTimeout(resolve, body.retry_after * 1000));
      return this.request(url, options); // Retry
    }

    return response;
  }
  
  private getBucket(url: string) {
    // Simplified; real implementation maps routes to buckets
    return this.buckets.get(url);
  }
}
```

---

## 🔐 Authentication Endpoints

### Get Current User
```http
GET /users/@me
Authorization: Bearer {token}
```

### Get OAuth2 Token
```http
POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
&grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=https://your-app.com/callback
```

**Response:**
```json
{
  "access_token": "6qrZcUqja7812RVdnEKjpzOL4CvHBFG",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "D43f5y0ahjqew82jZ4NViEr2YafMKhue",
  "scope": "identify guilds"
}
```

### Refresh OAuth2 Token
```http
POST /oauth2/token
Content-Type: application/x-www-form-urlencoded

client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
&grant_type=refresh_token
&refresh_token=D43f5y0ahjqew82jZ4NViEr2YafMKhue
```

---

## 👤 User Endpoints

### Get Current User
```http
GET /users/@me
```
**Response:** User object

### Get User by ID
```http
GET /users/{user.id}
```

### Modify Current User
```http
PATCH /users/@me
Content-Type: application/json

{
  "username": "NewUsername",
  "avatar": "data:image/png;base64,BASE64_ENCODED_IMAGE"
}
```

### Get Current User Guilds
```http
GET /users/@me/guilds
```

**Query params:**
- `before` — Get guilds before this ID
- `after` — Get guilds after this ID
- `limit` — Max results (1-200, default 200)
- `with_counts` — Include `approximate_member_count` and `approximate_presence_count`

### Get User DM Channels
```http
GET /users/@me/channels
```

### Create DM
```http
POST /users/@me/channels
Content-Type: application/json

{
  "recipient_id": "USER_ID"
}
```

---

## 🏰 Guild (Server) Endpoints

### Create Guild
```http
POST /guilds
Content-Type: application/json

{
  "name": "My Cool Server",
  "icon": "data:image/png;base64,...",
  "region": "us-east",  // deprecated
  "verification_level": 0,
  "default_message_notifications": 0,
  "explicit_content_filter": 0,
  "roles": [],
  "channels": []
}
```

### Get Guild
```http
GET /guilds/{guild.id}?with_counts=true
```

### Modify Guild
```http
PATCH /guilds/{guild.id}
Content-Type: application/json

{
  "name": "New Server Name",
  "description": "Updated description",
  "icon": "data:image/png;base64,...",
  "banner": "data:image/png;base64,...",
  "afk_channel_id": "CHANNEL_ID",
  "afk_timeout": 300,
  "system_channel_id": "CHANNEL_ID"
}
```

### Delete Guild
```http
DELETE /guilds/{guild.id}
```

### Get Guild Channels
```http
GET /guilds/{guild.id}/channels
```

### Create Guild Channel
```http
POST /guilds/{guild.id}/channels
Content-Type: application/json

{
  "name": "general",
  "type": 0,
  "topic": "General discussion",
  "position": 0,
  "parent_id": "CATEGORY_ID",
  "permission_overwrites": [],
  "nsfw": false,
  "rate_limit_per_user": 0
}
```

### Get Guild Members
```http
GET /guilds/{guild.id}/members?limit=1000&after=0
```

### Get Guild Member
```http
GET /guilds/{guild.id}/members/{user.id}
```

### Add Guild Member Role
```http
PUT /guilds/{guild.id}/members/{user.id}/roles/{role.id}
```

### Remove Guild Member
```http
DELETE /guilds/{guild.id}/members/{user.id}
```

### Get Guild Roles
```http
GET /guilds/{guild.id}/roles
```

### Create Guild Role
```http
POST /guilds/{guild.id}/roles
Content-Type: application/json

{
  "name": "Moderator",
  "permissions": "8",
  "color": 3447003,
  "hoist": true,
  "mentionable": true
}
```

### Modify Guild Role Positions
```http
PATCH /guilds/{guild.id}/roles
Content-Type: application/json

[
  { "id": "ROLE_ID_1", "position": 1 },
  { "id": "ROLE_ID_2", "position": 2 }
]
```

### Get Guild Bans
```http
GET /guilds/{guild.id}/bans
```

### Ban Guild Member
```http
PUT /guilds/{guild.id}/bans/{user.id}
Content-Type: application/json

{
  "delete_message_days": 7
}
```

### Get Guild Invites
```http
GET /guilds/{guild.id}/invites
```

### Get Guild Audit Log
```http
GET /guilds/{guild.id}/audit-logs?limit=50
```

---

## 📺 Channel Endpoints

### Get Channel
```http
GET /channels/{channel.id}
```

### Modify Channel
```http
PATCH /channels/{channel.id}
Content-Type: application/json

{
  "name": "new-name",
  "topic": "New topic",
  "position": 1,
  "nsfw": false,
  "rate_limit_per_user": 5,
  "bitrate": 64000,
  "user_limit": 0
}
```

### Delete Channel
```http
DELETE /channels/{channel.id}
```

### Get Channel Messages
```http
GET /channels/{channel.id}/messages?limit=50&before=MESSAGE_ID
```

**Query params:**
- `around` — Get messages around this ID
- `before` — Get messages before this ID
- `after` — Get messages after this ID
- `limit` — 1-100, default 50

### Get Channel Message
```http
GET /channels/{channel.id}/messages/{message.id}
```

---

## 💬 Message Endpoints

### Create Message
```http
POST /channels/{channel.id}/messages
Content-Type: application/json

{
  "content": "Hello, world!",
  "tts": false,
  "embeds": [],
  "components": [],
  "message_reference": {
    "message_id": "REPLY_TO_MESSAGE_ID"
  },
  "allowed_mentions": {
    "parse": ["users", "roles"],
    "replied_user": true
  }
}
```

**With file attachment (multipart):**
```http
POST /channels/{channel.id}/messages
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="payload_json"
Content-Type: application/json

{"content": "Here's a file!"}
--boundary
Content-Disposition: form-data; name="files[0]"; filename="image.png"
Content-Type: image/png

<binary data>
--boundary--
```

### Edit Message
```http
PATCH /channels/{channel.id}/messages/{message.id}
Content-Type: application/json

{
  "content": "Edited content",
  "embeds": []
}
```

### Delete Message
```http
DELETE /channels/{channel.id}/messages/{message.id}
```

### Bulk Delete Messages
```http
POST /channels/{channel.id}/messages/bulk-delete
Content-Type: application/json

{
  "messages": ["MESSAGE_ID_1", "MESSAGE_ID_2"]
}
```

> ⚠️ Messages must be < 14 days old for bulk delete.

### Create Reaction
```http
PUT /channels/{channel.id}/messages/{message.id}/reactions/{emoji}/@me
```

**Example:** `PUT /channels/123/messages/456/reactions/👍/@me`
Or with custom emoji: `PUT /channels/123/messages/456/reactions/name:emoji_id/@me`

### Delete Reaction
```http
DELETE /channels/{channel.id}/messages/{message.id}/reactions/{emoji}/{user.id}
```

### Pin Message
```http
PUT /channels/{channel.id}/pins/{message.id}
```

### Trigger Typing Indicator
```http
POST /channels/{channel.id}/typing
```
> No body required. Shows "User is typing..." for ~10 seconds.

---

## 👾 Invite Endpoints

### Get Invite
```http
GET /invites/{invite.code}?with_counts=true
```

### Create Channel Invite
```http
POST /channels/{channel.id}/invites
Content-Type: application/json

{
  "max_age": 86400,
  "max_uses": 10,
  "temporary": false,
  "unique": true
}
```

### Delete Invite
```http
DELETE /invites/{invite.code}
```

---

## 😀 Emoji Endpoints

### List Guild Emojis
```http
GET /guilds/{guild.id}/emojis
```

### Create Guild Emoji
```http
POST /guilds/{guild.id}/emojis
Content-Type: application/json

{
  "name": "blobdance",
  "image": "data:image/gif;base64,...",
  "roles": []
}
```

---

## 🔔 Webhook Endpoints

### Create Webhook
```http
POST /channels/{channel.id}/webhooks
Content-Type: application/json

{
  "name": "My Webhook",
  "avatar": "data:image/png;base64,..."
}
```

### Execute Webhook
```http
POST /webhooks/{webhook.id}/{webhook.token}
Content-Type: application/json

{
  "content": "Hello from webhook!",
  "username": "Custom Name",
  "avatar_url": "https://...",
  "embeds": []
}
```

---

## 📊 Embed Object Reference

```typescript
interface Embed {
  title?: string;              // Max 256 chars
  type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link';
  description?: string;        // Max 4096 chars
  url?: string;
  timestamp?: string;          // ISO8601
  color?: number;              // Decimal color value
  footer?: {
    text: string;              // Max 2048 chars
    icon_url?: string;
  };
  image?: { url: string };
  thumbnail?: { url: string };
  video?: { url: string };
  provider?: { name?: string; url?: string };
  author?: {
    name: string;              // Max 256 chars
    url?: string;
    icon_url?: string;
  };
  fields?: Array<{
    name: string;              // Max 256 chars
    value: string;             // Max 1024 chars
    inline?: boolean;
  }>;                          // Max 25 fields
}
```

---

## HTTP Status Codes Reference

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (DELETE success) |
| 304 | Not Modified (ETag match) |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (bad/missing token) |
| 403 | Forbidden (missing permissions) |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |
| 502 | Bad Gateway |
| 503 | Service Unavailable |

## Discord JSON Error Codes

| Code | Message |
|------|---------|
| 10001 | Unknown account |
| 10003 | Unknown channel |
| 10004 | Unknown guild |
| 10006 | Unknown invite |
| 10007 | Unknown member |
| 10008 | Unknown message |
| 10011 | Unknown role |
| 10013 | Unknown user |
| 10014 | Unknown emoji |
| 50001 | Missing access |
| 50006 | Cannot send empty message |
| 50013 | Missing permissions |
| 50035 | Invalid form body |
| 90001 | Reaction was already added |
