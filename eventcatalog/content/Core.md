Core owns durable identity, rooms, regional session admission, allocation and canonical lifecycle. It is horizontally replicated; PostgreSQL-style transactions and compare-and-set, rather than an individual process, serialize authority. No runtime implementation is included in this catalog.

## Persistence and transaction boundaries

A single authority shard contains room, room membership, active session uniqueness, session membership, allocation reservation, owner lease, terminal result, idempotency, inbox and outbox records needed for that room/session. Identity home records may live separately; a trusted regional authorization projection supplies current claims. A region must never depend on another region's room database for normal admission.

Use unique keys for tenant/room/nonterminal-session, tenant/session/player membership, tenant/caller/type/idempotencyKey and tenant/session/final-settlement. Compare expectedRevision for room/profile writes. Revision mismatch returns stale-revision with the current revision. Retry same idempotency key after an ambiguous timeout rather than starting a second operation.

Core replicas share an allocator. Reserve a compatible READY engine incarnation, capacity units, allocationId and new ownerEpoch in one database transaction; write AllocateSession to outbox. The engine checks the grant again before launch. During a drain, pending reservations either become tracked active sessions before the admission barrier or reject; the reconciler must never lose them. No placement is inferred from a broker's arbitrary consumer assignment.

## Admission, membership and lifecycle

JoinSession is valid only for an ACTIVE session, under game join policy and capacity. Membership reservation and ticket issuance are coordinated through a durable request record; signing may occur after commit, and a retry signs the same stored grant only while valid. Tickets expire within 60 seconds and bind tenant, player, role, region, cluster, session, epoch, allowed transports and nonce. A removed member cannot gain access using an older membershipRevision.

SessionMembershipChanged is a current membership snapshot, scoped to the current epoch. The engine must check Core during ticket consumption and at least every 60 seconds while connected. A lost revoke event therefore cannot authorize a player indefinitely. Service-to-service authoritative membership reads may extend GetSession through a separately versioned internal response; v1 membership reconciliation reads the shared regional authority adapter directly under a read-only role, not a new public API.

Canonical session transitions are accepted only from the current engine incarnation/epoch/allocation. In a single transaction, update lifecycle and release terminal room lock/capacity exactly once. SessionStarted is only a fact from the runtime; clients see ACTIVE after Core accepts it. Read-repair and reconciliation recover lost notifications.

## Restart and dependency failure

Core can restart while sessions run because leases, drain intents, outbox and operation results are outside its process. Other replicas renew leases; a full Core outage exceeding the lease window causes Media Engines to self-fence. Restart safety does not mean continued simulation without an authority store.

When the database is unavailable, fail new allocation/membership mutations closed. When the broker is unavailable, committed outbox work is retried; do not claim a session is active until the engine confirms it. Stop new admissions if oldest outbox age exceeds 60 seconds or durable backlog quota is reached; budget and alert thresholds are configurable and load-tested.

Every 5 seconds, overlapping-safe reconcilers inspect allocation deadlines, expired leases, recovery attempts, uncommitted final outcomes, leaked capacity reservations and drain progress. Reconcile with CAS and fencing tokens. Allocation gets 30 seconds and at most three fenced attempts; recovery gets 60 seconds. Manual retry never resurrects a terminal session.

## Multi-region identity and disaster recovery

Core is one deployable service with region-local state and optional discovery/identity-home roles. Cached public keys permit target regions to authenticate valid scoped credentials without a home round-trip. Operators define maximum revocation staleness and data residency policy. Home unavailability affects fresh authentication and authorization freshness, not the location of an already-running session.

The default region disaster policy is to fail affected sessions and start new IDs in a healthy region. Do not promote an asynchronous database replica as a second writer while the source may still own leases. Recovery of the same session IDs needs source fencing, verified durability/log continuity, new authority epoch namespace and an explicit audited DR procedure; it is outside automatic v1 failover.

Back up the authority store continuously with tested point-in-time recovery and object-store retention. Operator-declared RPO/RTO must come from restore drills. Do not acknowledge terminal rewards before durable settlement. Deduplicate identity deletion and result-side effects across replays.

## Matchmaking, statistics and leaderboard modules

Core also owns the durable matchmaking queue, proposal acceptance and team/seat reservation. Built-in FIFO, skill, latency, party-balanced and weighted policies share an atomic claim pipeline. Read the MatchPolicy entity for algorithms, fairness, relaxation, cancellation races and presets.

Core settles trusted SessionResult records in PostgreSQL, updates authoritative player totals and leaderboard entries, and emits revisioned updates. Independent Core worker pools project Redis live rankings and ClickHouse historical analytics. Read LeaderboardDefinition for live freshness, season handling, corrections, federation and duplicate-safe materialization. These are modules of Core, preserving three deployable services. They must not share unbounded queues/connection pools with lease renewal.


## Session recording authority

Create mandatory SessionRecordingIndex and snapshot RecordingPolicy in the session-creation transaction before allocation. Core owns recording permissions, event-index watermarks, linked media manifests, playback grants and retention. Its own lifecycle/membership/result events enter the transactional outbox with timestamps. Workers index already-durable events and project ClickHouse asynchronously; ClickHouse is never the sole archive. Sealing requires terminal source watermarks and final recording metadata. Authorize optional media controls and timeline/playback access independently from live membership.
