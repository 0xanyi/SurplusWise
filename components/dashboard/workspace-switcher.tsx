"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { Building2, ChevronsUpDown, Plus, User, Check } from "lucide-react";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { cn } from "@/lib/utils";

function WorkspaceIcon({ type }: { type: string }) {
  return type === "business" ? (
    <Building2 className="h-4 w-4" />
  ) : (
    <User className="h-4 w-4" />
  );
}

export function WorkspaceSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "compact";
}) {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    createWorkspace,
    updateWorkspace,
    loading,
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"personal" | "business">("business");
  const [newCurrency, setNewCurrency] = useState("GBP");
  const [creating, setCreating] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  if (loading || !activeWorkspace) return null;

  const handleSelect = (id: string) => {
    setActiveWorkspace(id);
    setIsOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(newName.trim(), newType, newCurrency);
      setNewName("");
      setNewCurrency("GBP");
      setShowCreate(false);
    } catch {
      // Error handling would go here
    } finally {
      setCreating(false);
    }
  };

  const handleCurrencyChange = async (currency: string) => {
    if (!activeWorkspace || currency === activeWorkspace.currency) return;
    setSavingCurrency(true);
    try {
      await updateWorkspace(activeWorkspace.id, { currency });
    } finally {
      setSavingCurrency(false);
    }
  };

  const compact = variant === "compact";

  return (
    <div className={cn("relative", compact && "min-w-0 flex-1")}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Switch workspace. Current workspace: ${activeWorkspace.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center text-left transition-colors",
          compact
            ? "h-[38px] w-full min-w-0 max-w-[108px] gap-1.5 rounded-[11px] border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            : "h-11 w-full gap-2.5 rounded-xl border border-border bg-card px-2.5 hover:border-foreground/20"
        )}
      >
        {!compact && (
          // Mint tint marks workspace identity, not an amount.
          <span className="flex size-[26px] flex-none items-center justify-center rounded-lg bg-brand/15 text-brand">
            <WorkspaceIcon type={activeWorkspace.type} />
          </span>
        )}
        <span className={cn("min-w-0", compact ? "truncate" : "flex-1")}>
          <span className={cn(!compact && "block truncate text-[13px] font-medium")}>
            {activeWorkspace.name}
          </span>
          {!compact && (
            <span className="block text-[11px] capitalize text-muted-foreground">
              {activeWorkspace.type}
            </span>
          )}
        </span>
        <ChevronsUpDown className="size-3.5 flex-none text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setShowCreate(false);
            }}
          />

          {/* Dropdown */}
          <div
            className={cn(
              "z-50 rounded-xl border border-border bg-popover shadow-lg",
              compact
                ? "fixed left-4 right-4 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto"
                : "absolute left-0 top-full mt-1.5 w-64"
            )}
          >
            <div className="p-1.5">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Workspaces
              </p>

              <div className="px-2 py-2">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Currency
                </label>
                <select
                  value={activeWorkspace.currency}
                  onChange={(e) => void handleCurrencyChange(e.target.value)}
                  disabled={savingCurrency}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} · {currency.label}
                    </option>
                  ))}
                </select>
              </div>

              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelect(ws.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <WorkspaceIcon type={ws.type} />
                  <span className="flex-1 text-left truncate">{ws.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {ws.type}
                  </span>
                  {ws.id === activeWorkspace.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-border p-1.5">
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New workspace</span>
                </button>
              ) : (
                <form onSubmit={handleCreate} className="space-y-2 p-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Workspace name"
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewType("personal")}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        newType === "personal"
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType("business")}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        newType === "business"
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} · {currency.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !newName.trim()}
                      className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {creating ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
