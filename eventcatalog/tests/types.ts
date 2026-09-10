import { parseMessage, type ChannelSpec, type Message } from '../generated/js/index.js';
const message: Message = parseMessage('{}');
if (message.type === 'GameInput') {
  const exactEpoch: string = message.data.ownerEpoch;
  // @ts-expect-error Counter is deliberately not a JS number.
  const unsafeEpoch: number = message.data.ownerEpoch;
  void exactEpoch; void unsafeEpoch;
}
const channel: ChannelSpec = { channelId:'game', kind:'game', transport:'udp', reliability:'unreliable-sequenced', codec:'v1', maxPayloadBytes:1000, maxRateHz:30 };
// @ts-expect-error Planned transports are not supported capabilities.
channel.transport = 'http3';
