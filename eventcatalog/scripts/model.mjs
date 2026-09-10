import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const readJSON = async path => JSON.parse(await readFile(new URL(path, new URL('../', import.meta.url)), 'utf8'));
export const schema = await readJSON('contracts/schema.json');
export const messages = await readJSON('contracts/messages.json');
export const services = ['Core', 'Socket', 'MediaEngine'];
export const actors = ['client', 'operator'];
export const producers = message => message.producer.split(',');
export const pointer = id => ({ id, version: '1.0.0' });
export const json = value => JSON.stringify(value, null, 2) + '\n';
export const goName = name => name.replace(/(^|[-_:.])([a-z])/g, (_, sep, c) => c.toUpperCase()).replace(/Id(?=[A-Z]|$)/g, 'ID').replace(/Url(?=[A-Z]|$)/g, 'URL');
export function standalone(name) {
  const found = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) {
      const key = node.$ref.replace('#/$defs/', '');
      if (!schema.$defs[key]) throw new Error(`Missing definition ${key}`);
      if (!found.has(key)) { found.add(key); visit(schema.$defs[key]); }
    }
    for (const value of Object.values(node)) if (typeof value === 'object') visit(value);
  }
  visit(schema.$defs[name]);
  return { $schema: schema.$schema, title: name, ...schema.$defs[name], $defs: Object.fromEntries([...found].sort().map(n => [n, schema.$defs[n]])) };
}
// Deterministic, deliberately synthetic public fixtures; no credentials or user data.
export function example(node, key = '') {
  if (node.$ref) {
    const name = node.$ref.split('/').at(-1);
    if (['StartMediaRecordingData','StartSessionMediaCaptureData'].includes(name)) {
      const value = example(schema.$defs[name], key); value.audio = true; return value;
    }
    if (name === 'MediaRecordingFinalizedData') {
      const value = example(schema.$defs[name], key);
      Object.assign(value.recording, { state: 'completed', endedAt: '2026-09-08T12:05:00Z', manifestDigest: 'a'.repeat(64) }); return value;
    }
    if (name === 'SessionRecordingSealedData') {
      const value = example(schema.$defs[name], key);
      Object.assign(value.recording, { state: 'sealed', endedAt: '2026-09-08T12:05:00Z', timelineDigest: 'a'.repeat(64) }); return value;
    }

    if (name === 'ID') return (key || 'example').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-example';
    if (name === 'Counter') return '1';
    if (name === 'Digest') return 'a'.repeat(64);
    if (name === 'Bytes') return 'AQID';
    return example(schema.$defs[name], key);
  }
  if (node.const !== undefined) return node.const;
  if (node.enum) return node.enum[0];
  if (node.type === 'object') return Object.fromEntries((node.required ?? []).map(k => [k, example(node.properties[k], k)]));
  if (node.type === 'array') return [];
  if (node.type === 'integer') return node.minimum ?? 0;
  if (node.type === 'boolean') return false;
  if (node.format === 'date-time') return '2026-09-08T12:00:00Z';
  if (node.format === 'uri') return 'https://example.invalid';
  return key === 'codec' ? 'game-json-v1' : 'example';
}
