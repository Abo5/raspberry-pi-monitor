# 06 — Rendezvous Specification (Track B relay/signalling)

The Rendezvous lets the phone reach the Pi from any network **without any inbound
port on the Pi and without ever reading the payload**. It is deliberately dumb.
Not needed for the LAN MVP (Track A).

**Language:** Go or Rust. **Hosting:** any small VPS/edge. **State:** near-zero
(one small durable table). **Trust:** zero-knowledge — it brokers and relays
opaque bytes only.

---

## 1. Responsibilities

| # | Responsibility | Notes |
|---|---|---|
| RDV-1 | **Signalling** — match a client and an Agent by an opaque `rendezvous_id`; exchange ICE candidates so they can attempt a direct P2P path. | JSON over WebSocket. Never inspects the E2EE payload. |
| RDV-2 | **Relay** — when a direct path is impossible (symmetric NAT etc.), forward opaque encrypted frames between the two (TURN-like). | Bytes are already E2EE; the relay can't decrypt. |
| RDV-3 | **Push wake** — let an Agent trigger an **empty** APNs push so the client wakes to fetch an alert. | Payload carries no content (P1). |

## 2. What it must NOT do

- Never terminate or inspect the Noise/E2EE session.
- Never store telemetry, shell bytes, keys, fingerprints, or alert content.
- Never log payloads or correlatable metadata beyond what RDV-4 permits.

## 3. Permitted durable state (the ONLY table)

| Field | Purpose | Retention |
|---|---|---|
| `rendezvous_id` (opaque) | Route a wake/push to the right Agent↔client pair. | While paired. |
| `apns_token` | Deliver the empty wake push. | While the device is registered; refreshed by the client. |
| `last_seen_at` | Housekeeping / stale cleanup. | Rolling. |

**RDV-4 (test-enforced):** a full dump of the store contains **no** readable
telemetry, keys, fingerprints, hostnames, or push content. A CI test dumps the
store and asserts on its contents. What an operator who reads the whole database
learns is written down here and nowhere else.

## 4. APIs

### 4.1 Signalling (WebSocket, JSON)
```
→ register      { role: "agent"|"client", rendezvous_id }
← registered    { ok: true }
→ offer         { rendezvous_id, sdp }        # relayed to the peer verbatim
← offer         { sdp }
→ answer        { rendezvous_id, sdp }
← answer        { sdp }
→ ice           { rendezvous_id, candidate }
← ice           { candidate }
```
The service only routes these between the two ends of a `rendezvous_id`; it does
not parse SDP semantics beyond routing.

### 4.2 Relay (fallback)
An allocated relay channel forwards opaque length-prefixed frames both ways.
Rate-limited; bandwidth-capped per pair; no persistence.

### 4.3 Push registration
```
POST /register-push   { rendezvous_id, apns_token }   → 204
POST /wake            { rendezvous_id }                → 204   # sends empty APNs push
```
`/wake` is authenticated so only the paired Agent can wake its client (e.g. a
per-pair secret established at pairing, never the E2EE keys).

## 5. Scaling & ops

- Stateless request handling; the tiny push table in a small KV/SQL store.
- Horizontally scalable behind a load balancer; sticky routing per
  `rendezvous_id` for an active relay session.
- TLS everywhere; standard rate limiting and abuse controls.
- Metrics: connection counts, relay bytes, push sends — **never** payload content.

## 6. Cost & footprint

A single small VPS handles many pairs (signalling is cheap; relay only for the
minority of connections that can't go direct). Designed to run for pennies and to
be self-hostable by the owner if they prefer not to trust a shared instance.
