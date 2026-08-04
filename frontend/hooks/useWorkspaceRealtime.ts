"use client";

import { getAccessToken, getRealtimeUrl } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

export type WorkspaceRealtimeEvent = {
  id?: string;
  type: string;
  business_id?: string;
  occurred_at?: string;
  payload: Record<string, unknown>;
};

export type RealtimeStatus = "connecting" | "live" | "reconnecting" | "offline";

const EVENT_NAME = "vireqo:workspace-event";

export function useWorkspaceRealtime(
  onEvent?: (event: WorkspaceRealtimeEvent) => void,
): RealtimeStatus {
  const callbackRef = useRef(onEvent);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let stopped = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      const token = getAccessToken();
      if (!token || stopped) {
        setStatus("offline");
        return;
      }

      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      socket = new WebSocket(getRealtimeUrl());

      socket.addEventListener("open", () => {
        socket?.send(JSON.stringify({ type: "authenticate", token }));
      });

      socket.addEventListener("message", (message) => {
        try {
          const event = JSON.parse(message.data) as WorkspaceRealtimeEvent;
          if (event.type === "realtime.connected") {
            attempt = 0;
            setStatus("live");
            return;
          }
          if (event.type === "realtime.ping") return;

          callbackRef.current?.(event);
          window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }));
        } catch {
          // Ignore malformed events and keep the live connection active.
        }
      });

      socket.addEventListener("close", () => {
        if (stopped) return;
        attempt += 1;
        setStatus("reconnecting");
        const delay = Math.min(12_000, 1_000 * 2 ** Math.min(attempt, 4));
        reconnectTimer = window.setTimeout(connect, delay);
      });

      socket.addEventListener("error", () => socket?.close());
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return status;
}

export function useWorkspaceEvent(
  handler: (event: WorkspaceRealtimeEvent) => void,
  prefixes: string[] = [],
): void {
  const handlerRef = useRef(handler);
  const prefixesRef = useRef(prefixes);

  useEffect(() => {
    handlerRef.current = handler;
    prefixesRef.current = prefixes;
  }, [handler, prefixes]);

  useEffect(() => {
    const listener = (raw: Event) => {
      const event = (raw as CustomEvent<WorkspaceRealtimeEvent>).detail;
      if (
        prefixesRef.current.length > 0 &&
        !prefixesRef.current.some((prefix) => event.type.startsWith(prefix))
      ) {
        return;
      }
      handlerRef.current(event);
    };

    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  }, []);
}
