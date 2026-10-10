import { Server, Socket } from "socket.io";

/**
 * Socket.IO Genel Sohbet ve Oda Senkronizasyon Yardımcısı
 */
export function setupChatSocketHandlers(io: Server, socket: Socket, user: any, client: any, messageRamCache: any, getUser: any) {
  // 1. Oda abonelikleri (general, global)
  socket.on("join_room", (room: string) => {
    if (room && typeof room === "string") {
      socket.join(room);
    }
  });

  socket.on("leave_room", (room: string) => {
    if (room && typeof room === "string") {
      socket.leave(room);
    }
  });

  // 2. Mesaj Gönderim Mantığı (Ortak Handler)
  const handleSendMessage = async (data: any, callback?: any) => {
    try {
      let { type = "text", content, reply_to, file_name, file_size } = data || {};
      if (!type) type = "text";

      if (type === "text") {
        if (!content || typeof content !== "string" || !content.trim()) {
          if (typeof callback === "function") callback({ error: "Mesaj içeriği boş olamaz" });
          return;
        }
        content = content.trim();
        if (content.length > 1000) {
          content = content.slice(0, 1000);
        }
      }

      const sUser = await getUser(user.id);
      const nowIso = new Date().toISOString();
      const tempId = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      let replyMsg = null;
      if (reply_to) {
        const cachedGlobal = messageRamCache.get("global");
        const refCached = cachedGlobal?.find((m: any) => String(m.id) === String(reply_to));
        if (refCached) {
          replyMsg = { id: refCached.id, sender: refCached.sender, type: refCached.type, content: refCached.content, sender_name: refCached.sender_name };
        } else {
          try {
            const refMsgRes = await client.execute({ sql: `SELECT id, sender, type, content, file_name, file_size FROM global_messages WHERE id = ?`, args: [reply_to] });
            if (refMsgRes.rows.length > 0) {
              const rUser = await getUser(refMsgRes.rows[0].sender as number);
              replyMsg = { ...refMsgRes.rows[0], sender_name: rUser?.username };
            }
          } catch(e) {}
        }
      }

      const popMsg: any = {
        id: tempId,
        sender: user.id,
        type,
        content,
        reply_to: reply_to || null,
        reactions: [],
        sender_name: sUser?.username,
        sender_avatar: sUser?.avatar,
        sender_color: sUser?.color,
        reply_message: replyMsg,
        file_name: file_name || null,
        file_size: file_size || null,
        created_at: nowIso
      };

      // 1. RAM Cache write
      messageRamCache.push("global", popMsg);

      // 2. Tüm istemcilere ve odalara eşzamanlı anlık yayın (Full Broadcast)
      io.emit("new_global_message", popMsg);
      io.emit("chat:message", popMsg);
      io.emit("global_message", popMsg);

      io.to("general").emit("new_global_message", popMsg);
      io.to("global").emit("new_global_message", popMsg);

      if (typeof callback === "function") {
        callback({ success: true, message: popMsg });
      }

      // 3. Asenkron veritabanı kaydı
      client.execute({
        sql: "INSERT INTO global_messages (sender, type, content, reply_to, reactions, file_name, file_size, created_at) VALUES (?, ?, ?, ?, '[]', ?, ?, ?)",
        args: [user.id, type, content, reply_to || null, file_name || null, file_size || null, nowIso]
      }).then((res: any) => {
        popMsg.id = Number(res.lastInsertRowid);
      }).catch((err: any) => {
        console.error("Async global msg error:", err);
      });
    } catch (err) {
      console.error("handleSendMessage error:", err);
      if (typeof callback === "function") callback({ error: "Sunucu hatası" });
    }
  };

  socket.on("send_global_message", handleSendMessage);
  socket.on("chat:message", handleSendMessage);
}
