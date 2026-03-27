"use client";

import { useEffect, useState } from "react";
import {
  NORMALIZATION_INSIGHTS_STORAGE_KEY,
  NormalizationBatchResultItem,
  NormalizationBlockersPanel,
} from "./NormalizationBlockersPanel";

export function NormalizationBlockersClient() {
  const [items, setItems] = useState<NormalizationBatchResultItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const load = () => {
      try {
        const raw = window.sessionStorage.getItem(NORMALIZATION_INSIGHTS_STORAGE_KEY);
        if (!raw) {
          setItems([]);
          return;
        }

        const parsed = JSON.parse(raw);
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setItems([]);
      }
    };

    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const clearItems = () => {
    setItems([]);
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(NORMALIZATION_INSIGHTS_STORAGE_KEY);
    } catch {
      // no-op
    }
  };

  return <NormalizationBlockersPanel items={items} onClear={clearItems} />;
}
