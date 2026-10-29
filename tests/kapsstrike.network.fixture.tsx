import { EngineStore } from "@babylonjs/core/Engines/engineStore";
import React from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import KapsStrikeGame from "../src/components/games/kapsstrike/KapsStrikeGame";
import { StrikeController } from "../src/games/kapsstrike/controller";
(window as any).engineStore = EngineStore;
(window as any).microphoneRequests=0;
if(navigator.mediaDevices) {const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(constraints)=>{(window as any).microphoneRequests++;return original(constraints);};}
const userId = Number(new URLSearchParams(location.search).get("user") || 1);
const socket = io({ auth: { testUser: userId }, transports: ["websocket"] });
(window as any).socket = socket;
const originalStart = StrikeController.prototype.start;
StrikeController.prototype.start = function (capture = true) {
  (window as any).strike = this;
  if (!(window as any).controllers?.includes(this)) {
    ((window as any).controllers ||= []).push(this);
  }
  return originalStart.call(this, capture);
};
socket.on("connect", () => {
  if ((window as any).mounted) return;
  (window as any).mounted = true;
  createRoot(document.getElementById("root")!).render(
    <KapsStrikeGame socket={socket} currentUserId={userId} username={`Tester ${userId}`} onBack={() => {}} />
  );
});
