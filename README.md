<img src="eventcatalog/public/logo.svg" alt="Mills Mess" width="96" align="right" />

# Mills Mess architecture catalog

The new catalog for an open, session-based multiplayer backend. This repository currently contains **EventCatalog and its contract tooling only**. It does not implement or deploy the three backend services.

- Core, Socket and Media Engine retain the old project's service boundaries.
- Regional clusters, horizontal session placement, durable authority and fencing.
- Audio, video and game channels over WSS, WebRTC and secure native UDP; HTTP/2/3 reserved for later.
- Planned engine maintenance waits for current sessions to finish; crash recovery is explicitly game-policy dependent.
- Matchmaking presets: FIFO, skill, latency, party-balanced and weighted.
- Mandatory timestamped event recordings for every session, with optional attached audio/video and scoped playback.
- Live statistics, seasonal leaderboards and rewards: PostgreSQL authority, optional Redis live projections, ClickHouse analytics.
- JSON Schema contracts with examples, Go structs, JavaScript validators/TypeScript declarations, Dispat checks and CI.

## Run

Use Node 24 (see `.nvmrc`), pnpm 11.15.0 and Go 1.24+ for binding tests. Dispat 1.8.2 is used for library orchestration.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by EventCatalog. The full architecture is under **Mills Mess Engine**; **Media Engine** details restart/transport behavior, **MatchPolicy** describes strategies, and **LeaderboardDefinition** explains statistics/storage.

```sh
pnpm generate                 # materialize authored contracts and prose
pnpm check                    # schemas, references, examples and generation drift
pnpm test                     # JS wire validation and negative contracts
pnpm --dir eventcatalog test:types
pnpm test:go                  # compile and wire-test generated Go
pnpm build                    # verified static catalog in eventcatalog/dist
pnpm preview

dispat compute --check
dispat run tests --since all  # needs at least one commit in the repository
```

`GO=/absolute/path/to/go pnpm test:go` supports Go installations outside PATH. `pnpm --dir eventcatalog test:dispat` checks the Dispat graph/suite in a disposable Git fixture, including before the first repository commit.

See [catalog contributor guide](eventcatalog/README.md), [architecture](eventcatalog/domains/MME/index.mdx), [matchmaking](eventcatalog/entities/MatchPolicy/index.mdx), and [leaderboards](eventcatalog/entities/LeaderboardDefinition/index.mdx).

EventCatalog is pinned to **4.10.12**, the latest npm release verified on 2026-09-08. All direct dependencies and the pnpm lockfile are pinned. pnpm uses a hoisted layout because EventCatalog links its embedded Astro application into a build directory; isolated executable shims break through that link. No npm/yarn lockfile is used.

“Production” here describes the implementation contracts and operational acceptance gates. Runtime restart, scale and latency guarantees require the documented deployment fault/load tests. CI verifies this catalog and generated bindings; it does not claim those runtime guarantees or publish anything. A software distribution license and registry release policy have not been selected in this catalog-only change.
