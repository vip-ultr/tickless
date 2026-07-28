"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/config";

/** Fire-and-forget visit beacon, once per browser session. */
export function VisitBeacon() {
  useEffect(() => {
    if (sessionStorage.getItem("tickless_visit_sent")) return;
    sessionStorage.setItem("tickless_visit_sent", "1");
    fetch(`${API_URL}/api/visit`, {
      method: "POST",
      headers: {
        ...(process.env.NEXT_PUBLIC_API_KEY
          ? { "X-Tickless-Key": process.env.NEXT_PUBLIC_API_KEY }
          : {}),
      },
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
