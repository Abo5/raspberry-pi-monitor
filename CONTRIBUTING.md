# Contributing

This repository currently contains **specifications only** — no implementation. That is deliberate: the design is settled here first, then built.

## Working rules

1. **Specs are the contract.** If the implementation needs to diverge from a spec, change the spec in the same pull request. A spec that lies is worse than no spec.
2. **Every requirement is numbered and testable.** New behaviour enters through `docs/02-SRS.md` with a fresh `FR-`/`NFR-`/`SEC-` id, and leaves through a `TC-` case in `docs/09-TEST-PLAN.md`.
3. **Irreversible technical choices become ADRs.** Anything expensive to undo — a transport, a crypto construction, a storage engine, a dependency the whole app leans on — gets a file in `docs/adr/` before the code lands.
4. **Security changes require a threat-model diff.** Any change touching keys, pairing, transport, or storage must state which entry in `docs/04-SECURITY-E2EE.md` it affects and whether the residual-risk list changed.
5. **No secrets, ever.** No device identifiers, key material, tokens, provisioning profiles, or personal network details in this repo. See `.gitignore`.

## Document conventions

| Rule | Detail |
|---|---|
| Language | English. |
| Format | GitHub-flavored Markdown. Tables over prose wherever the content is structured. |
| Diagrams | Mermaid, inline. No binary image files unless unavoidable. |
| Requirement keywords | RFC 2119 — MUST, MUST NOT, SHOULD, MAY. |
| Vocabulary | Exactly as defined in `docs/00-GLOSSARY.md`. Do not invent synonyms for `Agent`, `Client`, `Tunnel`, `Channel`. |
| Numbers | Concrete. "Under 150 ms", never "fast". |
| File naming | `NN-TITLE.md` for top-level docs, `ADR-000N-slug.md` for decision records. |

## Branching and commits

- Branch from `main`, one topic per branch: `docs/<area>` or `feat/<area>`.
- Conventional Commits: `docs:`, `feat:`, `fix:`, `chore:`, `refactor:`, `test:`.
- Pull requests state what changed, which requirement ids are affected, and whether the traceability matrix in `docs/02-SRS.md` needs updating.

## When implementation begins

Planned layout once code lands:

| Path | Contents |
|---|---|
| `ios/` | Xcode project — app, widget extension, shared framework. |
| `agent/` | Rust workspace for the Raspberry Pi daemon. |
| `rendezvous/` | Stateless signaling service. |
| `docs/` | These specifications, kept current. |

Implementation happens on macOS with Xcode for the Client; the Agent cross-compiles to `aarch64-unknown-linux-gnu`.
