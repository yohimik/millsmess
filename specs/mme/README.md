# Mills Mess Engine specification

This package contains the Mills Mess Engine specification under GPL-3.0-or-later. [SPEC.md](./SPEC.md) defines the architecture of a clustered, session-based multiplayer game engine: its entities, services, protocols, failure behavior, budgets and conformance obligations.

The specification is general purpose. It names no programming language and no library; interfaces are abstract operations, and infrastructure products appear only as reference adapters behind abstract roles. The catalog in `eventcatalog/` is a draft that will be rewritten to match this specification once it is approved.

## What it specifies

- Three mandatory services, Socket, Inspector and Engine, and five optional services, Profiles, Statistics, Payment, Inventory and Recording. The Minimal profile runs guest-only games with audio, video, teams, observers, restart survival and horizontal scaling, and writes nothing to disk.
- One Profile entity for users and rooms, roles from guest to admin, a permission matrix and configurable quotas.
- Sessions with players, spectators, observers, dynamic groups and a server-enforced mute matrix.
- A RAM-authoritative Engine at up to 60 ticks per second with offload to the coordination store, planned restart with connection preservation per transport, and crash re-adoption.
- Transport adapters for WebSocket, TCP, secure UDP, WebRTC data channels and WebRTC media, an embedded optional TURN relay, and a compact binary codec for the simulation plane.
- A portable session object that runs as the server runner, as the client-side predicted session or as custom client code, with client prediction and state synchronization protocols.
- A traceless mode with a formal definition and conformance tests, an integration bus for optional services, repository contracts for persistence, clustering and deployment runbooks, logging levels, performance budgets, a testing strategy and acceptance gates.

## Status and versioning

The document is a draft for review. `VERSION` holds the unreleased baseline `0.0.0`; the first release will be `1.0.0`. The handshake protocol integer is `1` and the catalog label is `1.0.0`, independent of the document version. Nothing is released and the repository is private, so the specification replaces the draft catalog in place with no compatibility obligation.

## Distribution and verification

The package keeps its own tag format, `specs/mme/v{version}`, in [dispat.yaml](./dispat.yaml). Native auto-versioning rewrites `VERSION` and the two version declarations in `SPEC.md` and nothing else.

```sh
sh verify.sh
sh test.sh
```

The verifier checks the version declarations, the license material, every relative link and every table-of-contents entry, and refuses symlinked inputs. During a build it also checks `DISPAT_NEW_VERSION`. The test suite runs the verifier against the committed folder and against disposable fixtures that must pass or fail.
