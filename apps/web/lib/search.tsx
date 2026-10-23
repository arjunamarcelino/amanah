"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Shared search state for the donor app. The SiteHeader (in the (main) layout) owns the
// input; the Discover page reads `query` to filter the campaign grid. Kept in a context —
// not the URL — so typing filters live without a navigation per keystroke, and the state is
// naturally scoped to the (main) group (the console never mounts this provider).
type SearchContextValue = {
  query: string;
  setQuery: (q: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within a SearchProvider");
  return ctx;
}
