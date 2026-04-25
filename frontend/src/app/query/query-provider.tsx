import React from "react";

interface QueryProviderProps {
  children: React.ReactNode;
}

function QueryProvider({ children }: QueryProviderProps) {
  return <>{children}</>;
}

export default QueryProvider;
