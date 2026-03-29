/** Pure UI strings for chat layout (no React). */

export function getChatWorkspaceToggleClass(workspaceOpen: boolean): string {
  const base =
    "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm font-medium transition-all duration-150";
  if (workspaceOpen) {
    return `${base} border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] hover:border-primary/40`;
  }
  return `${base} border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border`;
}
