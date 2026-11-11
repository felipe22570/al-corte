"use client";

import { useEffect, useState } from "react";

export function SaveNotice() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <div role="status" className="fixed top-4 right-4 left-4 z-30 rounded-md border border-border bg-card p-4 text-body text-foreground md:left-auto">Movimiento guardado</div> : null;
}
