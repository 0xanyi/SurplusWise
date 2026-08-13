"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/hooks/use-api";
import type { ApiNotification } from "@/types";

export interface NotificationsResponse {
  notifications: ApiNotification[];
  unread: number;
}

interface NotificationsContextValue {
  data: NotificationsResponse | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Shared so desktop and mobile chrome do not duplicate the calendar query. */
const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<NotificationsResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const load = useCallback(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    apiFetch<NotificationsResponse>("/api/notifications", { method: "POST" })
      .then((result) => version === requestVersion.current && setData(result))
      .catch((value: unknown) => {
        if (version === requestVersion.current) {
          setError(value instanceof Error ? value.message : "Failed to load");
        }
      })
      .finally(() => version === requestVersion.current && setLoading(false));
  }, []);
  useEffect(() => {
    load();
    window.addEventListener("workspace-changed", load);
    return () => window.removeEventListener("workspace-changed", load);
  }, [load]);
  return (
    <NotificationsContext.Provider value={{ data, loading, error, refresh: load }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used within NotificationsProvider");
  return value;
}
