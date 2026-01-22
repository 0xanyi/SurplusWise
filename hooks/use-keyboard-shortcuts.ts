"use client";

import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
}

// Global keyboard shortcuts helper
export const KEYBOARD_SHORTCUTS = {
  NEW_TRANSACTION: { key: "n", ctrl: true, description: "New transaction" },
  SEARCH: { key: "k", ctrl: true, description: "Search transactions" },
  DASHBOARD: { key: "d", ctrl: true, description: "Go to dashboard" },
  TRANSACTIONS: { key: "t", ctrl: true, description: "Go to transactions" },
  REPORTS: { key: "r", ctrl: true, description: "Go to reports" },
  SETTINGS: { key: ",", ctrl: true, description: "Go to settings" },
  HELP: { key: "?", shift: true, description: "Show keyboard shortcuts" },
} as const;
