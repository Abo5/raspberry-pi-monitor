# ADR-0007 — Serialization format for the message envelope

## Status

Accepted, 2026-07-24. Binding on [../05-PROTOCOL.md](../05-PROTOCOL.md) (message catalogue), [../06-DATA-MODEL.md](../06-DATA-MODEL.md) (export formats), and the Client/Agent codec layers.

## Context

Every structured message inside the Noise tunnel needs an encoding. The mux layer (CANON §3, specified in [../05-PROTOCOL.md](../05-PROTOCOL.md)) already gives us channel id, frame type, flags, fragmentation, and length; serialization only has to encode the *payload* of a frame.

The traffic is not homogeneous. It splits into two populations with opposite requirements:

| Population | Examples | Rate | Shape | What matters |
|---|---|---|---|---|
| **Control plane** | session open, capability negotiation, action invoke/result, alert delivery, subscribe requests, errors, screen codec negotiation | 0.01–10 msg/s | Heterogeneous, evolving, nested, many optional fields | Schema evolution, debuggability, self-description |
| **Data plane** | screen NAL units, PTY byte runs, file chunks, bulk telemetry sample batches | 20–2000 msg/s, up to ~3 Mbps | Homogeneous, fixed shape, mostly opaque bytes or packed numerics | Bytes on the wire, zero-copy, CPU per message |

A single format optimised for both is a compromise that serves neither. The Pi 5 has no hardware H.264 encoder (CANON §6), so the software encoder is already consuming 1.2–1.8 cores at the default profile — CPU spent re-encoding a video frame into a generic serialization format is CPU stolen from x264.

Constraints from elsewhere:

- **Two toolchains.** Rust on the Agent, Swift 6 on the Client, built in Xcode. Anything requiring a codegen step must work in both, including in an Xcode build phase.
- **The Notification Service Extension is memory-constrained** (~24 MB, see [ADR-0009](ADR-0009-widget-data-path.md)). The snapshot decode path must be small.
- **Possible future need for signed objects.** Device revocation records and backup blobs ([../04-SECURITY-E2EE.md](../04-SECURITY-E2EE.md)) may need to be signed and verified by a party other than the one that produced them. Signing requires a *deterministic* encoding.

## Decision

**Two encodings, chosen per population:**

1. **CBOR (RFC 8949), deterministically encoded, with small unsigned-integer map keys**, for all structured control-plane payloads.
2. **Fixed-layout big-endian binary headers with opaque or packed bodies**, for high-rate data-plane payloads: screen NAL units, PTY byte runs, file chunks, and bulk telemetry sample batches. These are **not** CBOR-wrapped.

The frame's `frame_type` byte in the mux header tells the receiver which of the two applies; there is never ambiguity and never a format sniff.

### Deterministic encoding rules

We adopt a subset stricter than RFC 8949 §4.2.1, so that any given message has exactly one valid byte encoding:

| Rule | Requirement |
|---|---|
| Lengths | Definite-length only. Indefinite-length arrays, maps, strings, and byte strings MUST be rejected on decode. |
| Integers | Shortest-form encoding only. A value expressible in one byte MUST NOT be encoded in two. |
| Map keys | Unsigned integers only in wire messages. Sorted ascending by numeric value. |
| Duplicate keys | MUST be rejected, not last-wins. |
| Floats | Only where a value is genuinely non-integral. Where a metric is integral (counters, byte counts, uptime seconds), the integer type MUST be used. `f32` preferred over `f64` unless precision demands otherwise. |
| NaN/Inf | MUST NOT be encoded. A missing or invalid sample is an absent key, not a NaN. |
| Tags | No CBOR semantic tags in v1 except where [../05-PROTOCOL.md](../05-PROTOCOL.md) explicitly names one. Unknown tags MUST be rejected. |
| Unknown keys | Non-critical unknown keys MUST be ignored (forward compatibility); keys in the critical range MUST cause the message to be rejected. The critical/non-critical split is defined in [../05-PROTOCOL.md](../05-PROTOCOL.md) §compatibility. |
| Canonical form | The deterministic encoding is what gets signed, when signing applies. Re-encoding a decoded message MUST reproduce identical bytes. |

Integer map keys, not strings, are the single largest size win and they also decouple the wire from field naming. The mapping from integer key to field name lives in [../05-PROTOCOL.md](../05-PROTOCOL.md) and is the normative source; a debug build MAY carry the name table to render human-readable dumps.

### Packed binary payloads

| Payload | Layout summary | Why not CBOR |
|---|---|---|
| Screen frame | Small fixed header (frame sequence, presentation timestamp, keyframe flag, damage-rect count and rects, codec id) followed by the raw Annex-B or length-prefixed NAL bytes | A CBOR byte-string wrapper around a 40 KiB NAL adds no value and forces a copy. Zero-copy from the encoder's output buffer straight into the frame is worth more than uniformity. |
| PTY bytes | Header (sequence) + raw bytes | Same; a terminal byte run is already the most compact possible representation. |
| File chunk | Header (transfer id, offset) + raw bytes | Same. |
| Telemetry sample batch | Header (base timestamp, series count) + per-series run of (series id `u16`, delta-encoded timestamp, value) | This is where the real win is — see the size table below. A CBOR array of maps costs roughly 5× the packed form for identical information. |

## Consequences

### Positive

- **Size.** Roughly 2.6× smaller than JSON on a realistic telemetry snapshot, and the packed batch format is ~5× smaller again than a CBOR encoding of the same samples. On a TURN-relayed session where every byte is paid for twice (see [ADR-0008](ADR-0008-rendezvous-hosting.md)), this matters.
- **Self-describing.** A CBOR payload can be dumped and understood without a schema file. During protocol bring-up and field debugging, this is worth a great deal, and it is the specific thing Protobuf takes away.
- **Standardised.** CBOR is IETF **STD 94** (RFC 8949). MessagePack is a de-facto community spec with no standards-body process, no formal deterministic-encoding profile, and a history of ambiguity around string-vs-binary types. For a security product that may face review, citing an IETF standard is materially easier than citing a GitHub README. This is the actual tie-breaker between two formats that are otherwise within ~3% of each other on size.
- **A path to signed objects.** COSE (RFC 9052) and CWT (RFC 8392) are built on CBOR. If revocation records or backup manifests need signing later, we sign CBOR with an existing standard rather than inventing a canonicalisation.
- **No codegen.** No build-time step in either toolchain, no `protoc` in an Xcode build phase, no generated sources in the repository.
- **CPU stays off the hot path.** The data plane never touches a generic serializer, so the encoder's output goes to the wire with one header prepended.

### Negative

- **No first-party CBOR on Apple platforms.** This is the honest cost of not choosing JSON. `Codable` + `JSONEncoder`/`JSONDecoder` is built into Foundation, documented, debugged, and free. CBOR on Swift means `SwiftCBOR` (a small community package) or a hand-written encoder. Either way we own a security-relevant parser on the Client. Mitigation: the Client-side decoder MUST be fuzzed against malformed and hostile CBOR as part of the release checklist in [../04-SECURITY-E2EE.md](../04-SECURITY-E2EE.md), and the strict subset above deliberately shrinks the parser's attack surface (no indefinite lengths, no tags, no string keys, no big-num types).
- **Rust ecosystem needs care.** `serde_cbor` is **unmaintained** and MUST NOT be used. `ciborium` (serde-integrated) or `minicbor` (no-serde, `no_std`-friendly, smaller) are the viable choices; `minicbor` is the better fit if binary size and dependency count matter, `ciborium` if `serde` derive ergonomics matter more. Neither enforces our determinism subset by default — we MUST implement the strict-decode checks ourselves.
- **Weaker schema evolution than Protobuf.** Protobuf's field numbering, `reserved` declarations, and generated accessors make evolution nearly mechanical. With CBOR we get the same *capability* (integer keys are field numbers by another name) but none of the tooling enforcement — nothing stops a developer reusing a retired key number. Mitigation: [../05-PROTOCOL.md](../05-PROTOCOL.md) maintains an explicit retired-key-number registry, and reuse is a review-blocking error.
- **Two encodings to reason about.** Every message type must state which population it belongs to. This is a small, permanent tax on protocol documentation.
- **Hand-written packed parsers.** The data-plane headers are parsed by hand on both sides. Length and bounds checking must be explicit and correct; a mistake here is directly reachable by a peer. Mitigation: fuzz targets for each packed header type; strict maximum-length checks derived from the mux's 65505 B frame payload ceiling.

### Neutral

- Compression is orthogonal and handled by the mux `COMPRESSED` flag (0x08), not by the serializer. Compressing already-compressed video or an already-packed sample batch is pointless and MUST NOT be attempted; compression is only useful on large CBOR control payloads and on PTY output, where a screenful of text can compress 3–5×.
- CBOR's indefinite-length streaming support is a real feature we are choosing not to use. Our mux already provides fragmentation via the `MORE` flag, so a second streaming mechanism would be redundant and would break determinism.

## Format comparison

Size estimates below are **engineering estimates — validate with a benchmark** against real messages once the message catalogue in [../05-PROTOCOL.md](../05-PROTOCOL.md) is stable.

### Encoded size

| Message | JSON | MessagePack | CBOR (int keys) | Protobuf | Packed binary |
|---|---|---|---|---|---|
| Telemetry snapshot, ~40 numeric fields | ~1100 B | ~410 B | ~420 B | ~260 B | ~215 B |
| Control message, ~8 fields incl. two strings | ~180 B | ~105 B | ~110 B | ~85 B | n/a |
| 600 samples (40 series × 15 points) | ~19 KB | ~7.2 KB | ~7.4 KB | ~5.4 KB | **~1.5 KB** |
| 40 KiB screen NAL | ~55 KB (base64) | ~40 KB + 5 B | ~40 KB + 5 B | ~40 KB + 6 B | **40 KB + 16 B header** |

The snapshot row is the one usually quoted, but the **third row is the decision-relevant one**. Bulk telemetry backfill after an outage (principle P5 — the Agent keeps recording and backfills on reconnect) is the largest structured transfer the product performs. The packed batch format beats *every* generic serializer by 3.5–12×, which is why the two-population split earns its complexity and why the CBOR-vs-MessagePack size argument is nearly irrelevant.

### Qualitative comparison

| Criterion | JSON | MessagePack | **CBOR** | Protobuf | FlatBuffers |
|---|---|---|---|---|---|
| Standards status | IETF STD 90 | de-facto only | **IETF STD 94** | Google spec | Google spec |
| Self-describing | Yes | Yes | **Yes** | No | No |
| Deterministic encoding profile | RFC 8785 (JCS), awkward | none normative | **RFC 8949 §4.2, plus our subset** | not canonical by design | no |
| Binary payload support | base64 only (+33%) | native | **native** | native | native |
| Schema evolution | ad hoc | ad hoc | int keys + retired registry | **best in class** | good |
| Codegen required | no | no | **no** | yes, both toolchains | yes |
| Rust maturity | excellent | good (`rmp-serde`) | **good (`ciborium`, `minicbor`)** | good (`prost`) | fair |
| Swift maturity | **first-party (`Codable`)** | community | community (`SwiftCBOR`) | community + `protoc` | community |
| Decode CPU, relative | 3–5× | 1.0× | **1.0–1.2×** | 0.7× | ~0 (zero-copy) |
| Signed-object ecosystem | JOSE/JWT | none | **COSE/CWT** | none standard | none |
| Debuggability without schema | **excellent** | good | **good** | poor | poor |

### Why not Protobuf, specifically

Protobuf is the strongest rejected candidate and its advantages are real: the smallest generic wire size in the table, genuinely excellent schema evolution with enforced field-number retirement, and mature codegen. It was rejected because:

1. **Codegen in two toolchains.** `protoc` must run in the Rust build (fine) and in the Xcode build (friction: a build phase, a checked-in binary or a Homebrew dependency, and a generated-sources story that fights source control and reproducible builds).
2. **A second source of truth.** The `.proto` files would become normative, competing with [../05-PROTOCOL.md](../05-PROTOCOL.md). Either the document is generated from the schema or it drifts. For a specification-first repository, that inverts the intended relationship.
3. **Loss of self-description.** Debugging a wire capture without the schema becomes impossible. For a P2P product where failures happen on users' networks with no packet access, self-describing payloads are disproportionately valuable.
4. **No canonical encoding.** Protobuf explicitly does not guarantee byte-identical re-serialization, which forecloses the COSE-style signing path.
5. **The size advantage is ~35% on control messages that are 1% of traffic**, and zero on the data plane where we use packed binary anyway. It buys almost nothing where bytes actually matter.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **JSON everywhere** | 2.6× larger, base64 penalty on all binary (a 40 KiB NAL becomes 55 KiB — unacceptable on a 1.5 Mbps screen budget), 3–5× decode CPU, and float round-tripping is lossy across implementations. Its one decisive advantage — first-party `Codable` support on Apple platforms — is real and is the reason this option is listed rather than dismissed. Retained as the **export** format in [../06-DATA-MODEL.md](../06-DATA-MODEL.md), where human readability wins and volume is irrelevant. |
| **MessagePack** | Within ~3% of CBOR on size and CPU; a genuine coin-flip on technical merit. Rejected on governance: no standards-body process, no normative deterministic profile, historical str/bin type ambiguity, and no COSE-equivalent signing ecosystem. If CBOR tooling on Swift proves worse than expected, this is the fallback. |
| **Protobuf** | See above. Best schema evolution and smallest generic encoding, defeated by two-toolchain codegen friction, loss of self-description, dual sources of truth, and no canonical form. |
| **FlatBuffers / Cap'n Proto** | Zero-copy access is genuinely attractive for the data plane. Rejected because our data plane is already zero-copy via packed headers, so the benefit applies only to the control plane where message rates are ≤ 10/s and decode cost is irrelevant. Pays full codegen and tooling cost for no benefit. |
| **Bespoke binary for everything** | Smallest and fastest, and we already do this for the data plane. Rejected for the control plane: hand-written parsers for ~60 heterogeneous evolving message types is a large, permanent, security-critical maintenance burden and the exact place where forward compatibility bugs breed. Reserve hand-rolled parsing for the handful of fixed-shape, high-rate messages where it pays. |
| **CBOR with string keys** | Simpler to read on the wire and no key registry needed. Rejected: ~2× the snapshot size for cosmetic benefit, and the name table in [../05-PROTOCOL.md](../05-PROTOCOL.md) plus a debug-build dumper recovers the readability at zero wire cost. |

## Revisit if

- **`SwiftCBOR` proves unmaintained or unsound.** If the Swift CBOR situation deteriorates, MessagePack (`MessagePacker`) or a minimal in-house encoder for our strict subset becomes the better option. Our subset is small enough that a hand-written encoder/decoder is a realistic few-hundred-line component — and arguably safer than a general-purpose one.
- **Signed objects become a core requirement.** If revocation propagation or backup manifests need third-party verification, formalise on COSE rather than inventing a signing envelope. CBOR was chosen partly to keep this door open; walk through it rather than around it.
- **Control-plane message rate rises by 100×.** If a future feature makes control messages a bandwidth or CPU concern, revisit Protobuf or move the offending message type into the packed-binary population.
- **The message catalogue exceeds ~150 types.** At that scale the lack of enforced schema tooling starts to cost more than the codegen friction it avoids.
- **A third client platform appears** (Android, web). Web in particular makes JSON's first-party status relevant again, and would justify re-examining whether the control plane should be format-negotiable.
