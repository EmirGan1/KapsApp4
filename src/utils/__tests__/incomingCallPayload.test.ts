import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIncomingCallUrl,
  parseIncomingCallFromSearch,
  parseIncomingCallFromPushAlert,
} from '../incomingCallPayload.ts';

describe('incomingCallPayload utility', () => {
  it('builds and parses a direct incoming call URL for background launch', () => {
    const url = buildIncomingCallUrl({
      callType: 'direct',
      callId: 'call_170000_abc',
      callerId: 42,
      callerUsername: 'Emirgan',
      callerColor: '#10b981',
      action: 'open',
    });

    assert.ok(url.startsWith('/?'));
    const parsed = parseIncomingCallFromSearch(url.slice(1));
    assert.ok(parsed);
    assert.equal(parsed.callType, 'direct');
    assert.equal(parsed.callId, 'call_170000_abc');
    assert.equal(parsed.callerId, 42);
    assert.equal(parsed.callerUsername, 'Emirgan');
    assert.equal(parsed.callerColor, '#10b981');
    assert.equal(parsed.autoAction, 'open');
  });

  it('builds and parses a voice room invite ("Çaldır") call URL with accept action', () => {
    const url = buildIncomingCallUrl({
      callType: 'voice_room',
      callId: 'call_voice_room_99',
      callerId: 7,
      callerUsername: 'Zeynep',
      roomId: 'room_99',
      roomName: 'IB Fizik Çalışma Odası',
      action: 'accept',
    });

    const parsed = parseIncomingCallFromSearch(url.slice(1));
    assert.ok(parsed);
    assert.equal(parsed.callType, 'voice_room');
    assert.equal(parsed.roomId, 'room_99');
    assert.equal(parsed.roomName, 'IB Fizik Çalışma Odası');
    assert.equal(parsed.callerId, 7);
    assert.equal(parsed.callerUsername, 'Zeynep');
    assert.equal(parsed.autoAction, 'accept');
  });

  it('parses push alert payloads for both direct calls and voice room invites', () => {
    const directAlert = {
      title: 'Gelen sesli arama',
      body: 'Emirgan arıyor',
      tag: 'call_12345',
      callType: 'direct',
      callId: 'call_12345',
      callerId: 1,
      callerUsername: 'Emirgan',
      callerColor: '#f59e0b',
      url: '/?incomingCall=direct&callId=call_12345&callerId=1&callerUsername=Emirgan',
    };

    const parsedDirect = parseIncomingCallFromPushAlert(directAlert, 'open');
    assert.ok(parsedDirect);
    assert.equal(parsedDirect.callType, 'direct');
    assert.equal(parsedDirect.callId, 'call_12345');
    assert.equal(parsedDirect.callerUsername, 'Emirgan');

    const voiceAlert = {
      title: 'Gelen Sesli Oda Araması',
      body: 'Ahmet sizi odaya çağırıyor',
      tag: 'call_voice_r1',
      callType: 'voice_room',
      roomId: 'r1',
      roomName: 'Matematik HL',
      callerId: 12,
      callerUsername: 'Ahmet',
      url: '/?incomingCall=voice_room&roomId=r1&roomName=Matematik+HL&callerId=12&callerUsername=Ahmet',
    };

    const parsedVoice = parseIncomingCallFromPushAlert(voiceAlert, 'accept');
    assert.ok(parsedVoice);
    assert.equal(parsedVoice.callType, 'voice_room');
    assert.equal(parsedVoice.roomId, 'r1');
    assert.equal(parsedVoice.roomName, 'Matematik HL');
    assert.equal(parsedVoice.callerUsername, 'Ahmet');
    assert.equal(parsedVoice.autoAction, 'accept');
  });
});
