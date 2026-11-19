import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { useState } from "react";
import TravelPlanner from "../src/components/travel/TravelPlanner";
import Chats from "../src/components/Chats";
import { CallProvider } from "../src/context/CallContext";
import "../src/index.css";

const query = new URLSearchParams(location.search);
const userId = Number(localStorage.getItem("test_travel_user") || 1);
const peer = Number(query.get("peer") || 2);
const fakeSocket = {
  connected: true,
  on() {},
  off() {},
  emit(event: string, ...args: any[]) {
    const cb = args.find((a) => typeof a === "function");
    if (event === "get_friends")
      cb?.([
        {
          id: peer,
          username:
            peer === 1 ? "Dido" : peer === 2 ? "Emirgan" : "Başka Kullanıcı",
          status: 1,
          avatar: null,
        },
      ]);
    else if (event === "get_groups")
      cb?.([{ id: 10, name: "Gezi Grubu", members: [1, 2], creator: 1 }]);
    else if (event === "get_user_profile")
      cb?.({ id: peer, username: peer === 1 ? "Dido" : "Emirgan" });
    else if (event === "get_messages" || event === "get_group_messages")
      cb?.([]);
    else cb?.([]);
  },
} as any;
function Fixture() {
  const [target, setTarget] = useState<number | null>(peer);
  return (
    <BrowserRouter>
      {query.get("fixture") === "dm" ? (
        <CallProvider socket={null} currentUserId={userId}>
          <Chats
            socket={fakeSocket}
            currentUserId={userId}
            onlineUsers={[]}
            targetUserId={target}
            onTargetUserHandled={() => setTarget(null)}
          />
        </CallProvider>
      ) : (
        <TravelPlanner />
      )}
    </BrowserRouter>
  );
}
document.body.style.margin = "0";
document.getElementById("root")!.style.height = "100dvh";
document.getElementById("root")!.style.display = "flex";
createRoot(document.getElementById("root")!).render(<Fixture />);
