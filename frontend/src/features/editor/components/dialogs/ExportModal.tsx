import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";

interface ExportModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ExportModal({ open = false, onOpenChange }: ExportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-dim-3">Export settings preview</div>
      </DialogContent>
    </Dialog>
  );
}
