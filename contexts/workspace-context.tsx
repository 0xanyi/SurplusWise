"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { setStoredWorkspaceCurrency } from "@/lib/currency";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  type: "personal" | "business";
  currency: string;
  envelope_budgeting_enabled: boolean;
  role: "owner" | "editor" | "viewer";
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (id: string) => void;
  loading: boolean;
  refreshWorkspaces: () => void;
  createWorkspace: (name: string, type: "personal" | "business", currency?: string) => Promise<void>;
  updateWorkspace: (
    id: string,
    input: Partial<
      Pick<Workspace, "name" | "type" | "currency" | "envelope_budgeting_enabled">
    >,
  ) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = "activeWorkspaceId";

function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function setStoredWorkspaceId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (!res.ok) return;
      const data = await res.json();
      const ws: Workspace[] = data.workspaces ?? [];
      setWorkspaces(ws);

      // Resolve active workspace
      const storedId = getStoredWorkspaceId();
      const stored = ws.find((w) => w.id === storedId);

      if (stored) {
        setStoredWorkspaceCurrency(stored.currency);
        setActiveWorkspaceState(stored);
      } else {
        // Default to first workspace (the default one)
        const defaultWs = ws.find((w) => w.is_default) ?? ws[0];
        if (defaultWs) {
          setStoredWorkspaceId(defaultWs.id);
          setStoredWorkspaceCurrency(defaultWs.currency);
          setActiveWorkspaceState(defaultWs);
        }
      }
    } catch {
      // Silently fail on first load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      const ws = workspaces.find((w) => w.id === id);
      if (!ws) return;
      setStoredWorkspaceId(id);
      setStoredWorkspaceCurrency(ws.currency);
      setActiveWorkspaceState(ws);
      // Dispatch a custom event so components can re-fetch data
      window.dispatchEvent(new CustomEvent("workspace-changed", { detail: { id } }));
    },
    [workspaces],
  );

  const createWorkspace = useCallback(
    async (name: string, type: "personal" | "business", currency = "GBP") => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, currency }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create workspace");
      }
      await fetchWorkspaces();
    },
    [fetchWorkspaces],
  );

  const updateWorkspace = useCallback(
    async (
      id: string,
      input: Partial<
        Pick<Workspace, "name" | "type" | "currency" | "envelope_budgeting_enabled">
      >,
    ) => {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update workspace");
      }
      await fetchWorkspaces();
    },
    [fetchWorkspaces],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        loading,
        refreshWorkspaces: fetchWorkspaces,
        createWorkspace,
        updateWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
