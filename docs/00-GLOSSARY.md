# 00 — Glossary

Every other document in this repository uses these terms with exactly these meanings.

## System actors

| Term | Definition |
|---|---|
| **Agent** | The daemon running on the Raspberry Pi. Owns all local capabilities (screen, input, PTY, metrics) and the Pi-side half of every cryptographic session. Runs as a systemd service. |
| **Client** | The iOS application. Initiates all sessions. Holds the user-side half of every cryptographic session. |
| **Rendezvous** | A minimal, stateless internet-facing service whose only jobs are (a) letting a Client discover how to reach an Agent, (b) exchanging opaque connection-setup blobs, and (c) triggering content-free push notifications. It is **untrusted by design**. |
| **TURN server** | A standard RFC 8656 relay used only when direct peer-to-peer connectivity fails. Relays already-encrypted bytes. Untrusted. |
| **Owner** | The single human who paired the Client with the Agent. This product assumes one owner; multi-user is explicitly out of scope for v1. |

## Cryptographic terms

| Term | Definition |
|---|---|
| **E2EE** | End-to-end encryption. Plaintext exists only inside the Agent process and inside the Client process. No intermediary — including Rendezvous, TURN, APNs, and any network operator — can read or undetectably modify it. |
| **Noise Protocol Framework** | The framework used to build the handshake and transport encryption. See [noiseprotocol.org](https://noiseprotocol.org/). |
| **Noise_IK** | The specific Noise handshake pattern used for session establishment: the initiator (Client) already **K**nows the responder's static key; the initiator transmits its own static key **I**mmediately. Chosen because the Client always learns the Agent key at pairing time. |
| **Static key** | A long-lived X25519 key pair identifying an endpoint. One per Agent, one per Client device. |
| **Ephemeral key** | A single-session X25519 key pair, discarded after the handshake. Provides forward secrecy. |
| **Identity fingerprint** | A human-verifiable short encoding of a static public key, rendered as both a hex string and an emoji/word sequence for out-of-band comparison. |
| **Forward secrecy** | The property that compromising a static key today does not decrypt sessions recorded yesterday. |
| **Post-compromise security** | The property that after an attacker loses access, subsequent sessions become secure again. Achieved here by periodic rekeying. |
| **TOFU** | Trust On First Use. Explicitly **rejected** by this design in favour of verified pairing — see [04-SECURITY-E2EE](04-SECURITY-E2EE.md). |

## Transport terms

| Term | Definition |
|---|---|
| **Tunnel** | The logical encrypted connection between one Client and one Agent. Survives underlying transport changes (Wi-Fi → cellular). |
| **Transport** | The concrete byte pipe underneath a Tunnel: a WebRTC DataChannel, or a WebSocket to Rendezvous as fallback. |
| **Channel** | A multiplexed logical stream inside a Tunnel: `control`, `telemetry`, `shell`, `screen`, `input`, `files`. |
| **Session** | One authenticated Tunnel lifetime, from handshake completion to teardown. |
| **Direct path** | A Tunnel whose transport reaches the peer without a relay (host, server-reflexive, or LAN candidate). |
| **Relayed path** | A Tunnel whose transport passes through TURN or Rendezvous. Slower, still fully E2EE. |

## Product terms

| Term | Definition |
|---|---|
| **Pairing** | The one-time out-of-band ceremony that establishes mutual trust between a Client device and an Agent. |
| **Snapshot** | The most recent complete set of telemetry values. What widgets render. |
| **Series** | A named time-ordered sequence of numeric samples (e.g. `cpu.temp_c`). |
| **Rollup** | A downsampled Series at a coarser interval, produced to bound storage growth. |
| **Alert Rule** | A user-defined predicate over a Series that, when satisfied for a dwell time, raises an Alert. |
| **Alert** | An instance of a fired Alert Rule, delivered via push and shown in-app. |
| **Action** | A named, allow-listed operation the Agent will perform on request (e.g. `reboot`, `service.restart`). Arbitrary command execution is *only* available through the `shell` channel, never through Actions. |
| **Remote Desktop** | Live streamed video of the Pi's graphical session, plus keyboard/pointer injection. |
| **Remote Shell** | An interactive PTY on the Pi, rendered by a terminal emulator in the Client. Note: this is *not* SSH-over-the-wire; see [ADR-0006](adr/ADR-0006-shell-transport.md). |

## Requirement identifier conventions

| Prefix | Meaning | Example |
|---|---|---|
| `BR-` | Business requirement (BRD) | BR-04 |
| `FR-` | Functional requirement (SRS) | FR-210 |
| `NFR-` | Non-functional requirement (SRS) | NFR-030 |
| `SEC-` | Security requirement (SRS + Security doc) | SEC-012 |
| `UC-` | Use case | UC-03 |
| `RSK-` | Risk register entry | RSK-07 |
| `ADR-` | Architecture decision record | ADR-0002 |

Requirement keywords **MUST**, **MUST NOT**, **SHOULD**, **MAY** are used per RFC 2119.
