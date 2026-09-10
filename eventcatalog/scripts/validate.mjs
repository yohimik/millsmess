import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import matter from 'gray-matter';
import { schema, messages, services, actors, producers, root, standalone, readJSON } from './model.mjs';
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema(schema);
const names = new Set();
const channels = await readJSON('contracts/channels.json');
const channelIDs = new Set(channels.map(c => c.id));
assert.equal(channelIDs.size, channels.length, 'Duplicate channel ID');
assert.equal(services.length, 3);
for (const message of messages) {
  assert(!names.has(message.id), `Duplicate message ${message.id}`); names.add(message.id);
  assert.equal(message.version, '1.0.0', 'Multi-version generation requires an explicit migration');
  assert(['commands','events','queries'].includes(message.kind));
  assert(['durable','realtime','ephemeral','request-response'].includes(message.delivery));
  assert(channelIDs.has(message.channel), `Unknown channel ${message.channel}`);
  for (const actor of [...producers(message), ...message.consumers]) assert([...services,...actors].includes(actor), `Unknown participant ${actor}`);
  assert(message.summary.length > 15 && message.semantics.length > 20, `Underspecified contract ${message.id}`);
  assert(schema.$defs[message.id] && schema.$defs[message.id+'Data']);
  const envelope = schema.$defs[message.id];
  assert.equal(envelope.properties.type.const, message.id);
  assert.equal(envelope.properties.version.const, message.version);
  if (message.delivery === 'durable') for (const name of ['aggregateId','aggregateRevision','causationId']) assert(envelope.required.includes(name));
  const validator = ajv.compile({ $ref: schema.$id + '#/$defs/' + message.id });
  const sample = await readJSON('contracts/examples/' + message.id + '.json');
  assert(validator(sample), `${message.id}: ${ajv.errorsText(validator.errors)}`);
  const download = ajv.compile(standalone(message.id));
  assert(download(sample), `Standalone download invalid: ${message.id}`);
  const page = matter(await readFile(join(root,message.kind,message.id,'index.mdx'),'utf8'));
  assert.equal(page.data.id,message.id);
  assert.equal(page.data.version,message.version);
  assert.equal(page.data.schemaPath,'schema.json');
}
for (const m of messages) if (m.result) assert(names.has(m.result), `Missing reply ${m.result}`);
for (const name of Object.keys(schema.$defs)) ajv.compile({$ref:schema.$id+'#/$defs/'+name});
const presets = await readJSON('contracts/matchmaking-presets.json');
const validatePolicy = ajv.compile({$ref:schema.$id+'#/$defs/MatchPolicy'});
assert.deepEqual(presets.map(p=>p.strategy).sort(),schema.$defs.MatchStrategy.enum.toSorted());
for (const policy of presets) {
  assert(validatePolicy(policy),ajv.errorsText(validatePolicy.errors));
  assert(policy.maxPartySize<=policy.playersPerTeam);
  assert(policy.initialSkillDelta<=policy.maxSkillDelta);
  if (policy.strategy==='weighted') assert(policy.skillWeight+policy.latencyWeight+policy.waitWeight>0);
}
const recordingPolicy = ajv.compile({$ref:schema.$id+'#/$defs/RecordingPolicy'});
for (const preset of await readJSON('contracts/recording-presets.json')) {
  assert(recordingPolicy(preset),ajv.errorsText(recordingPolicy.errors));
  assert.equal(preset.eventsRequired,true);
}
assert(schema.$defs.GameProfile.required.includes('recording'), 'Every game/session must declare mandatory recording');
const storeIDs = new Set((await readJSON('contracts/stores.json')).map(s=>s.id));
const flowIDs = new Set((await readJSON('contracts/flows.json')).map(s=>s.id));
for (const flow of await readJSON('contracts/flows.json')) {
  const steps = new Set(flow.steps.map(s=>s.id));
  assert.equal(steps.size,flow.steps.length);
  for (const step of flow.steps) {
    if (step.message) assert(names.has(step.message.id),`Missing flow message ${step.message.id}`);
    if (step.service) assert(services.includes(step.service.id));
    if (step.container) assert(storeIDs.has(step.container.id));
    for (const next of [step.next_step,...step.next_steps??[]].filter(Boolean)) assert(steps.has(next.id));
  }
}
for (const id of services) {
  const page = matter(await readFile(join(root,'services',id,'index.mdx'),'utf8'));
  assert.equal(page.data.id,id);
  for (const [field,predicate] of [['sends',m=>producers(m).includes(id)],['receives',m=>m.consumers.includes(id)]]) {
    assert.deepEqual(page.data[field].map(p=>p.id).sort(),messages.filter(predicate).map(m=>m.id).sort(),`${id} ${field} drift`);
    for (const p of page.data[field]) {
      assert.equal(p.version,'1.0.0');
      for (const ch of [...p.to??[],...p.from??[]]) assert(channelIDs.has(ch.id));
    }
  }
  for (const p of [...page.data.readsFrom??[],...page.data.writesTo??[]]) assert(storeIDs.has(p.id));
}
const actualServices = (await readdir(join(root,'services'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
assert.deepEqual(actualServices,services.toSorted(),'Must contain exactly the three requested application services');
// Check generated inventory, including removed messages left on disk.
const inventory = new Set(await readJSON('generated/files.json'));
for (const base of ['commands','events','queries','services','channels','domains','flows','entities','containers','teams','contracts/examples']) {
  async function walk(dir) {
    for (const entry of await readdir(join(root,dir),{withFileTypes:true})) {
      const path=dir+'/'+entry.name;
      if(entry.isDirectory()) await walk(path);
      else assert(inventory.has(path),`Stale or untracked generated resource ${path}`);
    }
  }
  await walk(base);
}
console.log(`Validated ${messages.length} message schemas/examples, ${services.length} services, ${channels.length} channels, ${flowIDs.size} flows and ${presets.length} matchmaking presets`);
