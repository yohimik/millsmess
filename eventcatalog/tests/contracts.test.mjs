import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { schema, messages, readJSON } from '../scripts/model.mjs';
import { validateMessage, parseMessage, routes } from '../generated/js/index.js';
const sample = id => readJSON('contracts/examples/'+id+'.json');
const ajv = new Ajv({strict:true}); addFormats(ajv); ajv.addSchema(schema);
const validate = name => ajv.compile({$ref:schema.$id+'#/$defs/'+name});
test('every wire example round trips through the generated JavaScript package',async()=>{
  for (const m of messages) {
    const value=await sample(m.id);
    assert.deepEqual(parseMessage(JSON.stringify(value)),value,m.id);
  }
});
test('wire rejects missing identity, unknown type/version and extra properties',async()=>{
  const original=await sample('JoinSession');
  for(const key of ['tenantId','regionId','clusterId','messageId','data']) {
    const v=structuredClone(original); delete v[key]; assert.equal(validateMessage(v),false,key);
  }
  for(const [key,value] of [['version','2.0.0'],['type','Unknown'],['unrecognized',true]]) assert.equal(validateMessage({...original,[key]:value}),false);
  assert.equal(validateMessage({...original,data:{...original.data,role:'admin'}}),false);
});
test('epochs and counters preserve values above JS safe integer range',async()=>{
  const value=await sample('GameInput');value.data.ownerEpoch='9007199254740993';
  assert.equal(parseMessage(JSON.stringify(value)).data.ownerEpoch,'9007199254740993');
  for(const invalid of [9007199254740992,'01','-1','1e9','9'.repeat(20)]) {
    value.data.ownerEpoch=invalid;assert.equal(validateMessage(value),false);
  }
});
test('drain certificate cannot report active work',async()=>{
  const v=await sample('EngineDrained');
  for(const key of ['activeSessions','reservedSessions','pendingDurableWrites']) assert.equal(validateMessage({...v,data:{...v.data,[key]:1}}),false);
});
test('transport capabilities forbid invented reliability and future adapters',()=>{
  const validator=validate('ChannelSpec');
  const channel={channelId:'game',kind:'game',transport:'websocket',reliability:'reliable-ordered',codec:'game-json-v1',maxPayloadBytes:1024,maxRateHz:30};
  assert(validator(channel));
  assert.equal(validator({...channel,reliability:'unreliable-sequenced'}),false);
  assert.equal(validator({...channel,transport:'udp'}),false);
  assert(validator({...channel,transport:'udp',reliability:'unreliable-sequenced'}));
  assert.equal(validator({...channel,transport:'webrtc-rtp',reliability:'unreliable-sequenced'}),false);
  assert(validator({...channel,kind:'audio',transport:'webrtc-rtp',reliability:'unreliable-sequenced'}));
  for(const transport of ['http2','http3']) assert.equal(validator({...channel,transport}),false);
});
test('malformed credentials, binary payload and oversized envelopes reject',async()=>{
  const v=await sample('GameInput');v.data.payload='not base64!';assert.equal(validateMessage(v),false);
  const connect=await sample('Connect');connect.data.accessToken='';assert.equal(validateMessage(connect),false);
  assert.throws(()=>parseMessage('['));
  assert.throws(()=>parseMessage(' '.repeat(262145)),/budget/);
  assert.throws(()=>parseMessage('null'));
});
test('leaderboard pagination modes are exclusive and signed precision is retained',async()=>{
  const v=await sample('GetLeaderboard');v.data.cursor='cursor';v.data.aroundPlayerId='player';assert.equal(validateMessage(v),false);
  delete v.data.cursor;assert(validateMessage(v));
  v.data.limit=101;assert.equal(validateMessage(v),false);
  const value=await sample('LeaderboardReturned');value.data.entries=[{playerId:'player',score:'-9007199254740993',rank:'1',revision:'7'}];
  assert.equal(parseMessage(JSON.stringify(value)).data.entries[0].score,'-9007199254740993');
});
test('rejected results require a machine-readable error',async()=>{
  const v=await sample('CommandResult');v.data.result.status='rejected';assert.equal(validateMessage(v),false);
  v.data.result.code='conflict';assert(validateMessage(v));
});
test('route dispatch is unique by type and version, never version alone',()=>{
  assert.equal(new Set(routes.map(r=>r.id+'@'+r.version)).size,messages.length);
  assert.equal(routes.find(r=>r.id==='AllocateSession').channel,'EngineCommands');
  assert.equal(routes.find(r=>r.id==='GameInput').delivery,'realtime');
  assert.equal(routes.find(r=>r.id==='SessionResultSettled').producers[0],'Core');
});

test('every session requires event recording even when audio/video are disabled',async()=>{
  const policy=validate('RecordingPolicy');
  const value={eventsRequired:true,audioEnabled:false,videoEnabled:false,eventRetentionDays:30,mediaRetentionDays:7,segmentDurationMs:2000,mediaFailureMode:'continue-with-gap',policyRevision:'1'};
  assert(policy(value));
  assert.equal(policy({...value,eventsRequired:false}),false);
  assert.equal(policy({...value,eventRetentionDays:0}),false);
  const profile=(await sample('AllocateSession')).data.session.game;
  assert(validate('GameProfile')(profile));
  delete profile.recording;
  assert.equal(validate('GameProfile')(profile),false);
});
test('media recording selects at least one kind and finalization is terminal',async()=>{
  const request=await sample('StartMediaRecording');
  request.data.audio=false;request.data.video=false;assert.equal(validateMessage(request),false);
  request.data.video=true;assert(validateMessage(request));
  request.data.video=false;request.data.audio=true;assert(validateMessage(request));
  const final=await sample('MediaRecordingFinalized');assert(validateMessage(final));
  final.data.recording.state='recording';assert.equal(validateMessage(final),false);
  final.data.recording.state='partial';assert(validateMessage(final));
  delete final.data.recording.manifestDigest;assert.equal(validateMessage(final),false);
});
test('event recording requires timestamps, session attachment and precise sequence',async()=>{
  const message=await sample('SessionEventRecorded');
  message.data.record.sourceSequence='9007199254740993';assert(validateMessage(message));
  for(const field of ['sessionId','occurredAt','recordedAt','elapsedMicros','payloadDigest']) {
    const invalid=structuredClone(message);delete invalid.data.record[field];assert.equal(validateMessage(invalid),false,field);
  }
  message.data.record.occurredAt='yesterday';assert.equal(validateMessage(message),false);
});
test('engine cannot drain with pending recording work or open recorders',async()=>{
  const certificate=await sample('EngineDrained');
  for(const field of ['pendingEventRecords','pendingRecordingSegments','openRecordings']) {
    assert.equal(validateMessage({...certificate,data:{...certificate.data,[field]:1}}),false,field);
    const missing=structuredClone(certificate);delete missing.data[field];assert.equal(validateMessage(missing),false,field);
  }
});
