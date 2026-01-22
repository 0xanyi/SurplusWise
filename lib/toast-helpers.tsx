import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface UndoToastOptions {
  message: string;
  onUndo: () => void;
  undoText?: string;
  duration?: number;
}

/**
 * Show a toast with an undo action
 * Useful for deletions and other reversible actions
 */
export function showUndoToast({
  message,
  onUndo,
  undoText = "Undo",
  duration = 5000,
}: UndoToastOptions) {
  const toastId = toast({
    title: message,
    action: (
      <ToastAction
        altText={undoText}
        onClick={() => {
          onUndo();
        }}
      >
        {undoText}
      </ToastAction>
    ),
  });

  // Auto-dismiss after duration
  setTimeout(() => {
    if (toastId) {
      toastId.dismiss();
    }
  }, duration);

  return toastId;
}

/**
 * Show a success toast with optional action
 */
export function showSuccessToast(message: string, description?: string) {
  return toast({
    title: message,
    description,
    variant: "default",
  });
}

/**
 * Show an error toast
 */
export function showErrorToast(message: string, description?: string) {
  return toast({
    title: message,
    description,
    variant: "destructive",
  });
}
