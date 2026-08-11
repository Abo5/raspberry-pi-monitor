# 09 — Security Design

Threat model, key hierarchy, pairing, transport crypto, and Pi hardening. Deep
rationale (Noise construction, nonce handling) is in
[`../docs/04-SECURITY-E2EE.md`](../docs/04-SECURITY-E2EE.md); this is the
implementation-facing summary + the Track-A vs Track-B posture.

---

## 1. Threat model

**Assets:** the Pi (root via shell), telemetry/history, identity keys, the
owner's data.
**Adversaries & what we defend against:**

| Adversary | Defence |
|---|---|
| Passive network eavesdropper | Track A: TLS 1.3. Track B: E2EE Noise session — even the relay sees only ciphertext. |
| Active MITM at pairing | Out-of-band fingerprint verification (hex + words) the user confirms; mismatch aborts. |
| Malicious/curious relay operator (Track B) | Zero-knowledge relay; permitted-state table only; test-enforced no-plaintext (RDV-4). |
| Stolen phone | Biometric/passcode gates; key material in the Keychain; revoke device from another paired device. |
| Compromised client trying un-paired access | Agent rejects any key not in its trusted-device set. |
| Replay after a power cut (no RTC) | Persisted monotonic watermark + refuse pairing until NTP-synced (TC-1). |
| Privilege escalation via the Agent | Agent runs unprivileged; a minimal root helper executes only allow-listed Action ids, never raw commands. |

**Explicitly accepted (documented):** Track A's LAN MVP opens an inbound TLS port
on the Pi on the local network only — the one deliberate exception to P2, removed
in Track B.

## 2. Key hierarchy

| Key | Held by | Purpose |
|---|---|---|
| **Agent static keypair** | Pi | Identity; the thing the fingerprint is derived from; the client trusts its public half at pairing. |
| **Client static keypair** | Phone (Keychain) | Device identity; added to the Agent's trusted set at pairing. |
| **Ephemeral session keys** | Both, per connection | Forward secrecy (Noise IK, Track B). |
| **Per-pair wake secret** | Phone + Rendezvous | Authenticates `/wake` so only the paired Agent can push-wake its client. Never the E2EE keys. |
| **Pairing token / bearer (Track A)** | Phone + Agent | Authorises the local HTTP/WS API. |

Private keys never leave their device. On iOS, keys live in the Keychain
(Secure Enclave-backed where possible); the app refuses to store keys without a
device passcode.

## 3. Pairing ceremony (the one place a wrong tap has permanent consequences)

1. Agent shows a QR: `{ agent_static_pubkey, connection_hint, pairing_nonce,
   expires_at }`.
2. Client scans → performs the handshake → both derive the **same fingerprint**
   from the Agent static key.
3. Client shows fingerprint as **hex + 6 words**; Agent shows the same; user
   confirms match.
4. **Biometric** → only then is the trust record written on the phone and the
   client key added to the Agent's trusted set.
5. Mismatch → abort, write nothing, log a security event.
6. Codes expire (10 min); pairing refused until the Pi is NTP-synced.

## 4. Transport crypto

- **Track A (LAN):** TLS 1.3 (rustls). The client pins the Agent's identity via
  the pairing token + the Agent's static key (not a public CA). Good enough for a
  trusted home LAN; not for the open internet.
- **Track B (anywhere):** **Noise IK** over the (possibly relayed) DataChannel —
  the client already knows the Agent's static key from pairing, which IK is built
  for. Forward secrecy via ephemeral keys. A single reliable-ordered channel with
  an adaptive record cap (unordered delivery would break the counter nonce, TC-6).
- Rekeying on a schedule; rekeys observable in Diagnostics.

## 5. Authorisation model

| Operation | Gate |
|---|---|
| Read telemetry | Authenticated + verified session. |
| Open shell / desktop | + biometric re-auth (always). |
| Run non-destructive Action | Allow-list membership (the control). |
| Run destructive Action | + 4-gate confirmation (styling → consequence → gesture → biometric). |
| Write trust (pair/re-verify) / revoke / rotate | + biometric; a live verified session. |
| Widget/notification interaction | Brings the app to the foreground; no destructive path completes in the background. |

## 6. Audit & non-repudiation

- Every shell session and every Action is logged on the Pi (open/close, device,
  result). The audit log is not optional (the shell is remote root).
- Security events (mismatch, revoke, rotate, failed handshake) are recorded and
  surfaced in the client's Security Log.

## 7. Pi hardening (Agent deployment)

- Agent runs as a user service; root helper has a minimal, typed surface.
- systemd sandboxing on the Agent (`NoNewPrivileges`, `ProtectSystem`,
  `PrivateTmp`, restricted syscalls) — **except** the transient shell unit, which
  must run outside the sandbox to be a usable root shell (TC-3).
- No inbound port in Track B; Track A's port is LAN-bound and documented.
- Signed auto-updates (later); restrictive file perms on keys and config.

## 8. Open decision (licence, affects the Agent binary)

Remote Desktop needs H.264. Pi 5 has no HW encoder → software encode. **x264 is
GPL-2.0**, which conflicts with MIT + App Store distribution of a bundled binary.
Options: OpenH264 (BSD, lower quality/bitrate — recommended for v1), relicense the
Agent GPL, or HW-encode-only (Pi 4 only). Decide before the Remote Desktop phase;
it does not affect telemetry/shell. (See [`../docs/14-OPEN-DECISIONS.md`](../docs/14-OPEN-DECISIONS.md) OD-01.)

## 9. Verification (must be tested, not aspired)

- RDV-4: dump the Rendezvous store → assert no plaintext telemetry/keys/content.
- Pairing mismatch → assert no trust record written, security event logged.
- Un-trusted key → assert Agent rejects.
- Push payload → assert empty (no content leaves the Pi via APNs).
