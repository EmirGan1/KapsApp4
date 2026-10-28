import React from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import DungeonGame from "../src/components/games/dungeon/DungeonGame";
import "../src/index.css";
const id = Number(new URLSearchParams(location.search).get("user") || 1);
const socket = io({ auth: { id }, transports: ["websocket"] });
(window as any).dungeonSocket = socket;
createRoot(document.getElementById("root")!).render(
  <DungeonGame socket={socket} currentUserId={id} onBack={() => {}} />,
);
