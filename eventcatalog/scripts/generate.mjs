import { format } from '@wasm-fmt/gofmt';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { root, schema, messages, services, producers, pointer, json, goName, standalone, example } from './model.mjs';
const outputs = new Map();
const add = (path, value) => outputs.set(path, value);
const mdx = (frontmatter, body) => `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n${body.trim()}\n`;
const source = name => readFile(join(root, 'content', name + '.md'), 'utf8');
const channels = JSON.parse(await readFile(join(root, 'contracts/channels.json'), 'utf8'));
for (const channel of channels) {
  const { description, ...metadata } = channel;
  add(`channels/${channel.id}/index.mdx`, mdx({ ...metadata, version: '1.0.0', owners: ['platform'] }, description + '\n\n<NodeGraph />'));
}
for (const message of messages) {
  const { id, kind, version, summary, channel, delivery, semantics, result } = message;
  const sample = example(schema.$defs[id]);
  const frontmatter = { id, name: id, version, summary, owners: ['platform'], schemaPath: 'schema.json' };
  const scope = delivery === 'durable' ? 'Tenant + region + cluster + aggregate ID. Broker partition order is scoped to one aggregate; aggregateRevision is assigned by that aggregate owner, never by the client.' : delivery === 'realtime' ? 'Session + owner epoch + player + connection generation + logical channel. Sequence numbers are local to this scope.' : 'Authenticated request or connection + message type + caller. The trusted receiver derives identity from credentials and rejects tenant/region/cluster mismatches.';
  const failure = delivery === 'durable' ? 'Retry transient failures with jitter. Commit inbox deduplication and state/outbox together before ACK. Quarantine invalid/unsupported messages in a bounded DLQ with reason and alert; retain original identity on replay. Stale ownership is rejected, not retried blindly.' : delivery === 'realtime' ? 'Drop expired, duplicate or unauthorized frames; rate-limit and disconnect abusive senders. Missing snapshots trigger resync, not unlimited retransmission. No durable delivery guarantee applies.' : 'Reject invalid, unauthorized, expired or unsupported requests with CommandResult. Use the same idempotency key after a lost response; transient retries use bounded exponential backoff and jitter. Credentials, SDP and tickets are never durable-broker messages.';
  add(`${kind}/${id}/index.mdx`, mdx(frontmatter, `<!-- Generated from contracts/messages.json; edit that source. -->\n\n${summary}\n\n## Responsibility\n\nProducer: **${producers(message).join(', ')}**. Consumer: **${message.consumers.join(', ')}**. Delivery: **${delivery}**. Channel: **${channel}**.\n\n## Preconditions and effects\n\n${semantics}\n\n## Ordering and idempotency\n\n${scope}\n\n${delivery === 'durable' ? 'Deduplicate by tenantId + producer authority + messageId; retain aggregate transitions and terminal settlement uniqueness beyond broker retention.' : 'See the domain delivery contract for replay windows, payload-hash conflicts and admission expiry.'}\n\n## Failure handling\n\n${failure}\n\n${result ? `Success/reply contract: **${result}**. A rejected request uses **CommandResult** with a stable error code.` : 'An event is a fact or scoped reply; its receipt does not bypass authorization or ownership validation.'}\n\n## Example\n\nSynthetic values only. JSON Schema validates structural constraints; cross-field invariants are described above.\n\n\`\`\`json\n${JSON.stringify(sample, null, 2)}\n\`\`\`\n\n<SchemaViewer />\n\n<NodeGraph />`));
  add(`${kind}/${id}/schema.json`, json(standalone(id)));
  add(`contracts/examples/${id}.json`, json(sample));
}
for (const id of services) {
  const matching = (predicate, direction) => messages.filter(predicate).map(m => ({ ...pointer(m.id), [direction]: [pointer(m.channel)] }));
  const metadata = {
    id, name: id === 'MediaEngine' ? 'Media Engine' : id, version: '1.0.0', owners: ['platform'],
    summary: { Core: 'Durable identity, rooms, admission, allocation and fenced regional session coordination.', Socket: 'Horizontally scalable control connections, reconnect, signaling relay and authorized fanout.', MediaEngine: 'Single-owner session runtimes, game modules, audio/video and transport adapters.' }[id],
    sends: matching(m => producers(m).includes(id), 'to'), receives: matching(m => m.consumers.includes(id), 'from'),
    readsFrom: (id === 'Core' ? ['RegionalState','LiveRankings','AnalyticsWarehouse','Checkpoints','SessionRecordings'] : id === 'Socket' ? ['ConnectionCache'] : ['Checkpoints','RegionalState','SessionRecordings']).map(pointer),
    writesTo: (id === 'Core' ? ['RegionalState','LiveRankings','AnalyticsWarehouse','SessionRecordings'] : id === 'Socket' ? ['ConnectionCache','SessionRecordings'] : ['Checkpoints','SessionRecordings']).map(pointer)
  };
  add(`services/${id}/index.mdx`, mdx(metadata, await source(id) + '\n\n<NodeGraph />'));
}
add('domains/MME/index.mdx', mdx({ id: 'MME', name: 'Mills Mess Engine', version: '1.0.0', owners: ['platform'], summary: 'Production implementation contract for an open, regional, session-based game backend.', services: services.map(pointer), entities: ['Session','Room','Participant','GameProfile','ChannelSpec','Checkpoint','Region','MatchPolicy','LeaderboardDefinition','SessionRecordingIndex','RecordingPolicy','MediaRecording'].map(pointer), flows: JSON.parse(await readFile(join(root, 'contracts/flows.json'), 'utf8')).map(f => pointer(f.id)) }, await source('Architecture') + '\n\n<NodeGraph />'));
add('teams/platform.mdx', mdx({ id: 'platform', name: 'Platform maintainers', summary: 'Ownership role filled by each installation; no invented contact details.' }, 'Maintainers approve contract evolution, game-module admission, operational budgets and recovery evidence. Each deployment must assign real on-call and security contacts.'));
const stores = JSON.parse(await readFile(join(root, 'contracts/stores.json'), 'utf8'));
for (const { description, ...store } of stores) add(`containers/${store.id}/index.mdx`, mdx({ ...store, version: '1.0.0', owners: ['platform'] }, description));
for (const name of ['Session','Room','Participant','GameProfile','ChannelSpec','Checkpoint','Region','MatchPolicy','LeaderboardDefinition','SessionRecordingIndex','RecordingPolicy','MediaRecording']) {
  add(`entities/${name}/index.mdx`, mdx({ id: name, name, version: '1.0.0', owners: ['platform'], summary: `Canonical ${name} contract.`, schemaPath: 'schema.json' }, await source(name) + '\n\n<SchemaViewer />'));
  add(`entities/${name}/schema.json`, json(standalone(name)));
}
const flows = JSON.parse(await readFile(join(root, 'contracts/flows.json'), 'utf8'));
for (const { description, ...flow } of flows) add(`flows/${flow.id}/index.mdx`, mdx({ ...flow, version: '1.0.0', owners: ['platform'] }, description + '\n\n<NodeGraph />'));
// Type generation intentionally supports a bounded schema vocabulary and fails closed.
const allowed = new Set(['$ref','type','properties','required','additionalProperties','items','enum','const','description','format','pattern','minLength','maxLength','minimum','maximum','minItems','maxItems','uniqueItems','allOf','if','then','not']);
function supported(node) {
  for (const key of Object.keys(node)) if (!allowed.has(key)) throw new Error(`Unsupported generator keyword: ${key}`);
  if (node.$ref && !/^#\/\$defs\/[A-Za-z][A-Za-z0-9]*$/.test(node.$ref)) throw new Error('Only local named references are supported');
  if (node.type === 'object') {
    if (node.additionalProperties !== false) throw new Error('Open objects require an explicit generator design');
    Object.values(node.properties ?? {}).forEach(supported);
  }
  if (node.items) supported(node.items);
  if (node.type && !['object','array','string','integer','boolean'].includes(node.type)) throw new Error(`Unsupported type ${node.type}`);
}
Object.values(schema.$defs).forEach(supported);
function goType(node) {
  if (node.$ref) return node.$ref.split('/').at(-1);
  if (node.type === 'array') return '[]' + goType(node.items);
  if (node.type === 'object') throw new Error('Use named definitions for nested objects');
  return { string: 'string', integer: 'int64', boolean: 'bool' }[node.type] ?? (() => { throw new Error('Unrepresentable schema'); })();
}
function tsType(node) {
  if (node.$ref) return node.$ref.split('/').at(-1);
  if (node.const !== undefined) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map(JSON.stringify).join(' | ');
  if (node.type === 'array') return `Array<${tsType(node.items)}>`;
  if (node.type === 'object') return `{ ${Object.entries(node.properties).map(([k,v]) => `${JSON.stringify(k)}${node.required.includes(k) ? '' : '?'}: ${tsType(v)}`).join('; ')} }`;
  return { string: 'string', integer: 'number', boolean: 'boolean' }[node.type];
}
let go = '// Code generated by Mills Mess EventCatalog; DO NOT EDIT.\n// Types preserve JSON representation; validate JSON Schema at trust boundaries.\npackage contracts\n\n';
let dts = '// Generated from the canonical JSON Schema; DO NOT EDIT.\n';
for (const [name, node] of Object.entries(schema.$defs).sort(([a],[b]) => a.localeCompare(b))) {
  if (node.type === 'object') {
    const fields = new Set();
    go += `type ${name} struct {\n`;
    for (const [key, value] of Object.entries(node.properties)) {
      const field = goName(key);
      if (fields.has(field)) throw new Error(`Go field collision ${name}.${field}`);
      fields.add(field);
      const optional = !node.required.includes(key);
      go += `\t${field} ${optional ? '*' : ''}${goType(value)} \`json:"${key}${optional ? ',omitempty' : ''}"\`\n`;
    }
    go += '}\n\n';
  } else {
    go += `type ${name} ${goType(node)}\n\n`;
    if (node.enum) {
      const names = node.enum.map(v => name + goName(v));
      if (new Set(names).size !== names.length) throw new Error(`Go enum collision: ${name}`);
      go += `const (\n${node.enum.map((v,i) => `\t${names[i]} ${name} = ${JSON.stringify(v)}`).join('\n')}\n)\n\n`;
    }
  }
  dts += `export type ${name} = ${tsType(node)};\n`;
}
go += `const ProtocolVersion = "1.0.0"\n\nconst (\n${messages.map(m=>`\tMessageType${m.id} = "${m.id}"`).join('\n')}\n)\n`;
add('generated/go/contracts.go', format(go));
const union = messages.map(m => m.id).join(' | ');
dts += `\nexport type Message = ${union};\nexport type MessageType = Message['type'];\nexport declare const protocolVersion: '1.0.0';\nexport declare const messageTypes: readonly MessageType[];\nexport declare function validateMessage(value: unknown): value is Message;\nexport declare function parseMessage(text: string): Message;\nexport declare const routes: ReadonlyArray<{ id: MessageType; version: string; kind: string; producers: string[]; consumers: string[]; channel: string; delivery: string }>;\n`;
add('generated/js/index.d.ts', dts);
add('generated/js/schema.json', json(schema));
const routes = messages.map(m => ({ id:m.id,version:m.version,kind:m.kind,producers:producers(m),consumers:m.consumers,channel:m.channel,delivery:m.delivery }));
add('generated/routes.json', json(routes));
add('generated/js/index.js', `// Generated by Mills Mess EventCatalog; DO NOT EDIT.\nimport Ajv from 'ajv';\nimport addFormats from 'ajv-formats';\nimport schema from './schema.json' with { type: 'json' };\nexport const protocolVersion = '1.0.0';\nexport const routes = Object.freeze(${JSON.stringify(routes,null,2)});\nexport const messageTypes = Object.freeze(routes.map(r => r.id));\nconst ajv = new Ajv({ strict: true, allErrors: false });\naddFormats(ajv);\najv.addSchema(schema);\nconst validators = new Map(messageTypes.map(type => [type, ajv.compile({ $ref: schema.$id + '#/$defs/' + type })]));\nexport function validateMessage(value) {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;\n  return validators.get(value.type)?.(value) === true;\n}\nexport function parseMessage(text) {\n  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 262144) throw new Error('Message exceeds 256 KiB control envelope budget');\n  const value = JSON.parse(text);\n  if (!validateMessage(value)) throw new Error('Invalid or unsupported Mills Mess message');\n  return value;\n}\n`);
// Check byte-for-byte without touching any generated file. The output inventory also detects stale files.
const manifestPath = 'generated/files.json';
add(manifestPath, json([...outputs.keys(), manifestPath].sort()));
const check = process.argv.includes('--check');
let changed = 0;
let previous = [];
try { previous = JSON.parse(await readFile(join(root, manifestPath), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const path of previous.filter(path => !outputs.has(path))) {
  if (!resolve(root, path).startsWith(resolve(root) + '/')) throw new Error('Unsafe artifact inventory path');
  if (check) { console.error(`Obsolete generated artifact: ${path}`); changed++; }
  else { try { await unlink(join(root,path)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}
for (const [path, content] of outputs) {
  let old;
  try { old = await readFile(join(root,path), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (old === content) continue;
  if (check) { console.error(`Generated artifact differs: ${path}`); changed++; }
  else { await mkdir(dirname(join(root,path)),{recursive:true}); await writeFile(join(root,path),content); }
}
if (changed) process.exitCode = 1;
else console.log(`${check ? 'Verified' : 'Generated'} ${outputs.size} catalog and binding artifacts`);
