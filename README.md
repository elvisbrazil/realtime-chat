# realtime-chat

A chat backend built on Fastify and WebSockets. Users get a token for a username, create rooms over REST and talk over a single WebSocket connection. Messages are stored in PostgreSQL, and room events go through Redis pub/sub so you can run more than one instance behind a load balancer.

Auth is deliberately minimal: `POST /auth/token` signs a JWT for whatever username you send. There are no passwords or accounts. It exists so the WebSocket layer has a real identity to work with, not as a login system.

## Stack

Node 22, TypeScript, Fastify 5, `@fastify/websocket`, `@fastify/jwt`, zod (via `fastify-type-provider-zod`), Drizzle ORM on PostgreSQL, ioredis. Tests use Vitest with PGlite, so they run without Docker.

## Running it

```sh
docker compose up -d
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

API docs are served at http://localhost:3000/docs.

```sh
pnpm test
```

## Two instances

Start a second process on another port, pointing at the same Postgres and Redis:

```sh
pnpm dev             # :3000
PORT=3001 pnpm dev   # :3001, in another terminal
```

Connect one client to each port, join the same room, and messages sent on `:3000` show up on `:3001`. Presence lists both users as well. If `REDIS_URL` is unset the app falls back to an in-memory broker, which only works for a single instance.

## REST

```sh
TOKEN=$(curl -s localhost:3000/auth/token -H 'content-type: application/json' \
  -d '{"username":"ana"}' | jq -r .token)

curl -s localhost:3000/rooms -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"name":"general"}'

curl -s localhost:3000/rooms -H "authorization: Bearer $TOKEN"

curl -s "localhost:3000/rooms/$ROOM_ID/messages?limit=20" -H "authorization: Bearer $TOKEN"
# pass the returned nextCursor as ?cursor=... to load older messages
```

## WebSocket protocol

Connect to `/ws?token=<jwt>`. Browsers can also send the token as a subprotocol: `new WebSocket(url, ["chat", token])`; the server answers with `chat`.

```sh
npx wscat -c "ws://localhost:3000/ws?token=$TOKEN"
> {"type":"join","room":"<room id>"}
< {"type":"presence","room":"<room id>","users":["ana"]}
> {"type":"message","room":"<room id>","text":"hi","clientMsgId":"c1"}
< {"type":"ack","clientMsgId":"c1","id":"0198...","createdAt":"2026-08-29T19:02:11.412Z"}
```

Client to server:

| type      | fields                        |
| --------- | ----------------------------- |
| `join`    | `room`                        |
| `leave`   | `room`                        |
| `message` | `room`, `text`, `clientMsgId` |
| `typing`  | `room`, `isTyping`            |

Server to client:

| type       | fields                                                     |
| ---------- | ---------------------------------------------------------- |
| `ack`      | `clientMsgId`, `id`, `createdAt`                           |
| `message`  | `message: { id, room, author, text, createdAt }`           |
| `presence` | `room`, `users` (full list after every change)             |
| `typing`   | `room`, `user`, `isTyping`                                 |
| `error`    | `code`, `message`, `clientMsgId` when it relates to a send |

Error codes: `bad_request`, `unknown_room`, `not_joined`, `rate_limited`, `too_large`, `internal`.

## Design notes

- The broker is the only port with two adapters (Redis and in-memory). Everything else talks to Postgres directly through small repositories.
- The sender gets an `ack` with its `clientMsgId` instead of its own message back. Clients can use it to replace the optimistic copy and to drop duplicates after a retry.
- Message ids are UUIDv7 generated on the server, so ids sort by time. History uses keyset pagination on `(created_at, id)`, which stays stable while new messages arrive.
- Presence is eventually consistent. Each instance re-announces its local users on every heartbeat and forgets remote users it has not heard about for three heartbeats, so a crashed instance's users disappear on their own.
- The same heartbeat pings every socket; a socket that missed the previous pong is terminated and its rooms are cleaned up.
- Rate limiting is a token bucket per connection, not per user. Opening more sockets gets you more budget, which is fine for this scope but would need a shared counter in Redis for anything public.
- Frames over `MAX_MESSAGE_BYTES` get a `too_large` error and the socket stays open; the WebSocket server also has a hard `maxPayload` for anything far bigger.
- Messages from one connection are handled in order, one at a time, so a `join` followed right away by a `message` never races.
