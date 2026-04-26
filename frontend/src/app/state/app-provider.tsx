import { ReactNode } from "react";
import { AppBootstrap } from "@/app/store/app-bootstrap";

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <AppBootstrap />
      {children}
    </>
  );
}
