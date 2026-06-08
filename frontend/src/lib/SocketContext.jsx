import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { tokenStore, wsUrl } from "./api";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    const token = tokenStore.get();
    if (!token) return;
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    try {
      const ws = new WebSocket(wsUrl(token));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          setLastMessage(msg);
          listenersRef.current.forEach((cb) => {
            try { cb(msg); } catch (_) {}
          });
        } catch (_) {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (tokenStore.get()) {
          reconnectRef.current = setTimeout(connect, 2500);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch (_) {}
      };
    } catch (_) {
      reconnectRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    if (user) connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [user, connect]);

  const subscribe = useCallback((cb) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  return (
    <SocketContext.Provider value={{ connected, lastMessage, subscribe }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
