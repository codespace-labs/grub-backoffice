"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

type ModalType = "danger" | "warning" | "info";

type ConfirmOptions = {
  title: string;
  message: string;
  type?: ModalType;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmModalContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmModalContext = createContext<ConfirmModalContextValue | null>(null);

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "", message: "", type: "danger" });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirm() {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }

  const confirmVariant = options.type === "danger" ? "destructive" : "default";

  return (
    <ConfirmModalContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            <DialogDescription>{options.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {options.cancelLabel ?? "Cancelar"}
            </Button>
            <Button variant={confirmVariant} onClick={handleConfirm}>
              {options.confirmLabel ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmModalContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmModalContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmModalProvider");
  return ctx.confirm;
}
