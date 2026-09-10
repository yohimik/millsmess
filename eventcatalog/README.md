<img src="public/logo.svg" alt="Mills Mess" width="80" align="right" />

# EventCatalog contributor guide

Run workspace commands from the repository root with pnpm. See the root README for prerequisites and local preview.

## Authoring layout

| Source | Purpose |
| --- | --- |
| `contracts/schema.json` | Canonical Draft 7 named definitions and complete message envelopes |
| `contracts/messages.json` | Message type/version, producers, consumers, channel, semantics and reply |
| `contracts/channels.json` | Transport and broker delivery contracts |
| `contracts/stores.json` | PostgreSQL, Redis, checkpoint/journal and ClickHouse responsibilities |
| `contracts/flows.json` | Linked EventCatalog workflow steps |
| `contracts/matchmaking-presets.json` | Five validated built-in strategy presets |
| `contracts/recording-presets.json` | Mandatory events, audio-only and audio/video policies |
| `content/*.md` | Domain, service and entity narrative; source for generated MDX |
| `scripts/generate.mjs` | Deterministic catalog/schema/Go/JS/route materialization |
| `scripts/validate.mjs` | Contract and relationship gates |
| `generated/files.json` | Inventory of generated artifacts |

EventCatalog v4 channel relationships live on service sends/receives pointers; deprecated per-message channels frontmatter is not emitted, so the upstream migration cannot rewrite authored output. Teams use the current teams/<id>.mdx layout.

Generated folders are `domains`, `services`, `channels`, `commands`, `events`, `queries`, `flows`, `entities`, `containers`, `teams`, `contracts/examples` and generated binding **source files**. Edit their authored sources, then run `pnpm generate`. Package manifests, Go binding tests and tooling are hand-maintained, not overwritten by generation.

The generator writes only inside this catalog. It never writes to `../libs`, copies backend implementations, contacts a broker or publishes a package. Generation adapts the old schema-to-Go writer and pub/sub routing metadata concept, using ESM, strict local references, optional fields, named enums, explicit message identity and a standalone route manifest. The old source only had Go generators; JavaScript/TypeScript generation and runtime structural validation are added here.

## Go and JavaScript consumers

`generated/go` is a compilable Go module containing structs, scalar/enum definitions and message constants. `generated/js` is a private workspace package, `@millsmess/contracts`, exporting `parseMessage`, `validateMessage`, `routes`, `messageTypes` and declarations. Both derive from the same source schema. Decimal string epochs/counters preserve values beyond JS's safe integer range. Optional Go fields use pointers so absence and zero remain distinct.

JavaScript example:

```js
import { parseMessage } from '@millsmess/contracts';
const message = parseMessage(receivedText);
if (message.type === 'GameInput') {
  // Authenticate transport identity, tenant, epoch, channel and role before dispatch.
  const exactEpoch = BigInt(message.data.ownerEpoch);
}
```

The JS entry is ESM targeting Node 24 or a browser bundler supporting JSON import attributes. Structural validation uses Ajv; it does not validate authorization, signatures, semantic tick windows or transport framing. `parseMessage` has a 256 KiB hard parser cap; transport ingress must impose smaller negotiated limits before buffering. Go consumers validate schema/constraints at trust boundaries separately. Go JSON unmarshalling alone neither enforces enums nor rejects missing required fields.

Current generation supports local named refs, closed objects, arrays, strings, exact bounded integers, booleans, enums and validation-only conditional constraints. Unsupported structural types/references fail the generator; don't silently replace a new union/map with `any`. Version 1.0.0 is intentionally the only generation target. Adding another version requires extending the generator and compatibility suite while retaining old versioned schemas/packages.

## Change workflow

1. Update schemas, message relationships/semantics and prose together. Closed wire objects mean adding a field still needs a newly negotiated version after release.
2. Run `pnpm generate`, `pnpm check`, `pnpm test`, `pnpm --dir eventcatalog test:types`, `pnpm test:go` and `pnpm build` from root.
3. Review generated diffs, inspect linked pages/flows, and update negative/conformance fixtures for new invariants. Never equate compile-time types with authority validation.
4. Run `dispat compute --check` and `dispat run tests --since all` to exercise all library packages in dependency order. A fresh repository without HEAD can use the disposable fixture check instead.

Dispat config in the repository root defines catalog → Go bindings and catalog → JS bindings as explicit generation dependencies (`keep: true`). The manifest names and initial baselines are declared, with Go-compatible future tag paths. Checks can run now; release execution is deliberately blocked because registry destinations, license, credentials and release policy are outside this catalog-only task. A future publication workflow must build/check the exact versioned artifacts and publish through CI, not an ad-hoc local release.

## Upgrade EventCatalog

Verify the current npm registry version, update the exact dependency with pnpm, review the lockfile, then run the full catalog build and inspect the rendered domain/services/flows. Keep `nodeLinker: hoisted`: EventCatalog's embedded Astro app is linked through `.eventcatalog-core`. The upstream CLI may internally invoke `npx astro`; workspace dependency installation, scripts and lockfile remain pnpm-managed.

Some upstream optional authentication/markdown dependencies currently have peer-version warnings. This static catalog does not enable authentication or enterprise custom pages. Do not add peer overrides without testing the resulting EventCatalog build. The lockfile includes explicit fresh-release exceptions for the latest EventCatalog core and its linter.

## Branding

The source mark is `public/logo.svg`: three juggling balls enclosed within one larger ball, using Dispat's #171717 and #0D0D0D shades with #242424 and white keylines. `pnpm --dir eventcatalog brand` regenerates the PNG fallback, SVG/ICO/PNG favicons, Apple/Android touch icons and Open Graph social image. The catalog and both READMEs use this same mark.
