import { randomInt, randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { isActivity, type ActivityInvite } from '../utils/activityInvites';

const words = [['Zeytin', 'Hasat'], ['Fener', 'Işık'], ['İskele', 'Deniz'], ['Rüzgâr', 'Hava'], ['Otobüs', 'Yolculuk'], ['Pusula', 'Yön'], ['Kamp ateşi', 'Sıcaklık']];
const dilemmas = [['Gün doğumu yürüyüşü', 'Gün batımı yürüyüşü'], ['Deniz kenarında piknik', 'Ormanda piknik'], ['Fotoğraf çekmek', 'Gezi günlüğü yazmak'], ['Yolda müzik', 'Yolda sohbet'], ['Sahil turu', 'Eski sokakları keşfetmek']];
type Member = { id: number; name: string };
type Round = { mode: 'mole' | 'dilemma'; index: number; mole?: number; votes: Map<number, number> };
type Room = { id: string; name: string; members: Member[]; round?: Round; touched: number };
type Reply = (result: { success: boolean; error?: string; room?: string }) => void;

export const activityUserRoom = (id: number) => `activity-user:${id}`;

export function registerActivityGames(io: Server) {
  const rooms = new Map<string, Room>();
  const memberships = new Map<number, string>();
  const lastInvite = new Map<number, number>();

  const publish = (room: Room) => {
    const round = room.round;
    const finished = !!round && round.votes.size === room.members.length;
    for (const member of room.members) {
      const content = !round ? null : round.mode === 'mole'
        ? { clue: round.mole === member.id ? words[round.index][1] : words[round.index][0], isMole: round.mole === member.id }
        : { options: dilemmas[round.index] };
      io.to(activityUserRoom(member.id)).emit('trip-game:state', {
        id: room.id, name: room.name, members: room.members,
        round: round && { mode: round.mode, ...content, voted: round.votes.has(member.id), voteCount: round.votes.size,
          result: finished ? { mole: round.mole, votes: Array.from(round.votes), word: round.mode === 'mole' ? words[round.index][0] : undefined } : undefined },
      });
    }
  };

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      if (now - room.touched < 60 * 60_000) continue;
      for (const member of room.members) {
        memberships.delete(member.id);
        io.to(activityUserRoom(member.id)).emit('trip-game:state', null);
      }
      rooms.delete(id);
    }
    for (const [id, time] of lastInvite) if (now - time > 60_000) lastInvite.delete(id);
  }, 60_000);
  cleanup.unref();

  return (socket: Socket, member: Member) => {
    const id = member.id;
    void socket.join(activityUserRoom(id));
    const mine = () => rooms.get(memberships.get(id) ?? '');
    const fail = (reply: Reply | undefined, error: string) => {
      if (typeof reply === 'function') reply({ success: false, error });
    };
    const success = (reply: Reply | undefined, room?: string) => {
      if (typeof reply === 'function') reply({ success: true, room });
    };

    socket.on('activity:invite', (data: { activity?: unknown; target?: unknown }, reply?: Reply) => {
      const activity = data?.activity;
      const target = Number(data?.target);
      if (!isActivity(activity) || activity === 'ayvalik-rooms' || !Number.isSafeInteger(target) || target <= 0 || target === id) return fail(reply, 'Geçerli bir oyuncu seç.');
      const room = activity === 'ayvalik-games' ? mine() : undefined;
      if (activity === 'ayvalik-games' && (!room || room.members.length >= 8 || room.round)) return fail(reply, 'Davet için boş yeri olan bir oyun lobisinde olmalısın.');
      if (Date.now() - (lastInvite.get(id) ?? 0) < 3000) return fail(reply, 'Yeni davet için birkaç saniye bekle.');
      const channel = activityUserRoom(target);
      if (!io.sockets.adapter.rooms.get(channel)?.size) return fail(reply, 'Bu kullanıcı şu anda çevrimdışı.');
      lastInvite.set(id, Date.now());
      const invite: ActivityInvite = { id: randomUUID(), activity, sender: member.name, room: room?.id };
      io.to(channel).emit('activity:invited', invite);
      success(reply);
    });

    socket.on('trip-game:state', () => {
      const room = mine();
      if (room) publish(room);
      else socket.emit('trip-game:state', null);
    });

    socket.on('trip-game:action', (data: { action?: string; value?: unknown }, reply?: Reply) => {
      const room = mine();
      if (data?.action === 'create' || data?.action === 'join') {
        if (room) {
          if (data.action === 'join' && data.value === room.id) { publish(room); return success(reply, room.id); }
          return fail(reply, 'Önce mevcut oyun odandan ayrıl.');
        }
        const next = data.action === 'create'
          ? { id: randomUUID(), name: typeof data.value === 'string' && data.value.trim() ? data.value.trim().slice(0, 48) : `${member.name} odası`, members: [], touched: Date.now() }
          : typeof data.value === 'string' ? rooms.get(data.value) : undefined;
        if (!next || next.round || next.members.length >= 8) return fail(reply, 'Oda dolu, oyun başladı veya oda artık mevcut değil.');
        next.members.push(member);
        next.touched = Date.now();
        rooms.set(next.id, next);
        memberships.set(id, next.id);
        publish(next);
        return success(reply, next.id);
      }

      if (!room) return fail(reply, 'Önce bir oyun odasına katıl.');
      room.touched = Date.now();
      const host = room.members[0].id === id;
      if (data?.action === 'leave') {
        room.members = room.members.filter(player => player.id !== id);
        memberships.delete(id);
        io.to(activityUserRoom(id)).emit('trip-game:state', null);
        delete room.round;
        if (!room.members.length) rooms.delete(room.id);
        else publish(room);
      } else if (data?.action === 'lobby' && host) {
        delete room.round;
        publish(room);
      } else if (data?.action === 'start' && host && (!room.round || room.round.votes.size === room.members.length)) {
        const mode = data.value;
        if (mode !== 'mole' && mode !== 'dilemma') return fail(reply, 'Geçerli bir oyun seç.');
        if (room.members.length < (mode === 'mole' ? 3 : 2)) return fail(reply, mode === 'mole' ? 'Köstebek için en az 3 oyuncu gerekir.' : 'İkilem için en az 2 oyuncu gerekir.');
        const count = mode === 'mole' ? words.length : dilemmas.length;
        const previous = room.round?.mode === mode ? room.round.index : undefined;
        const index = previous === undefined ? randomInt(count) : (previous + randomInt(1, count)) % count;
        room.round = { mode, index, mole: mode === 'mole' ? room.members[randomInt(room.members.length)].id : undefined, votes: new Map() };
        publish(room);
      } else if (data?.action === 'vote' && room.round && !room.round.votes.has(id)) {
        const vote = Number(data.value);
        const valid = room.round.mode === 'mole' ? vote !== id && room.members.some(player => player.id === vote) : vote === 0 || vote === 1;
        if (!valid) return fail(reply, 'Geçerli bir seçenek seç.');
        room.round.votes.set(id, vote);
        publish(room);
      } else return fail(reply, 'Bu işlem şu anda kullanılamıyor.');
      success(reply, room.id);
    });
  };
}
