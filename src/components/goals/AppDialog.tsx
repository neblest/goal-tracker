import React, { useCallback } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  variant?: "default" | "fullscreen";
  contentClassName?: string;
}

export function AppDialog({ open, onClose, children, variant = "default", contentClassName }: AppDialogProps) {
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose]
  );

  const variantClassName = variant === "fullscreen" ? "h-screen w-full overflow-hidden" : "w-full max-w-2xl";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideCloseButton className={cn("p-0", variantClassName, contentClassName)}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export default AppDialog;
