"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "@/lib/types";

export function usePortSocket() {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
      path: "/socket.io/",
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 4000,
      autoConnect: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected to port tracker stream:", socket.id);
      setIsConnected(true);
      socket.emit("subscribe:fleet");
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Disconnected from stream");
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
}

