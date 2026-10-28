"use client";

import { SessionProvider } from "next-auth/react";
import { ServiceWorkerRegistrar } from "./ServiceWorker";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegistrar />
      {children}
    </SessionProvider>
  );
}
