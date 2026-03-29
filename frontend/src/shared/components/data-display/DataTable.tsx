import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ErrorAlert } from "@/shared/components/feedback/error-alert";
import { EmptyState } from "@/shared/components/data-display/empty-state";
import { LucideIcon } from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Applied to both <th> and <td> */
  className?: string;
}

export interface PaginationState {
  page: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
}

interface DataTableProps<T> {
  title?: string;
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  error?: string | null;
  pagination?: PaginationState;
  onPageChange?: (page: number) => void;
  /** Slot for filter controls rendered above the table */
  filters?: ReactNode;
  emptyIcon?: LucideIcon;
  emptyMessage?: string;
  emptyDescription?: string;
  /** i18n helper for pagination labels */
  paginationLabels?: {
    showing?: string;
    previous?: string;
    next?: string;
  };
}

const PAGE_WINDOW = 5;

function PaginationControls({
  pagination,
  onPageChange,
  labels,
}: {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  labels?: DataTableProps<unknown>["paginationLabels"];
}) {
  const { page, totalPages, total, hasMore } = pagination;
  const startPage = Math.max(1, page - Math.floor(PAGE_WINDOW / 2));
  const visiblePages = Array.from(
    { length: Math.min(PAGE_WINDOW, totalPages - startPage + 1) },
    (_, i) => startPage + i
  ).filter((p) => p <= totalPages);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t">
      <div className="text-sm text-muted-foreground">
        {labels?.showing ??
          `Page ${page} of ${totalPages} (${total} total)`}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          {labels?.previous ?? "Previous"}
        </Button>
        <div className="flex items-center gap-1">
          {visiblePages.map((p) => (
            <Button
              key={p}
              variant={page === p ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(p)}
              className="w-8 h-8 p-0"
            >
              {p}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore && page >= totalPages}
        >
          {labels?.next ?? "Next"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function DataTable<T extends { id?: string | number }>({
  title,
  columns,
  data,
  isLoading,
  error,
  pagination,
  onPageChange,
  filters,
  emptyIcon,
  emptyMessage = "No data found",
  emptyDescription,
  paginationLabels,
}: DataTableProps<T>) {
  const colSpan = columns.length;

  const renderBody = () => {
    if (isLoading && data.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
            Loading…
          </TableCell>
        </TableRow>
      );
    }

    if (error) {
      return (
        <TableRow>
          <TableCell colSpan={colSpan} className="h-24 text-center">
            <ErrorAlert error={error} />
          </TableCell>
        </TableRow>
      );
    }

    if (data.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={colSpan} className="h-24 text-center">
            {emptyIcon ? (
              <EmptyState
                icon={emptyIcon}
                title={emptyMessage}
                description={emptyDescription}
                variant="minimal"
              />
            ) : (
              <span className="text-muted-foreground">{emptyMessage}</span>
            )}
          </TableCell>
        </TableRow>
      );
    }

    return data.map((row, idx) => (
      <TableRow key={row.id ?? idx}>
        {columns.map((col) => (
          <TableCell key={col.key} className={col.className}>
            {col.cell(row)}
          </TableCell>
        ))}
      </TableRow>
    ));
  };

  return (
    <Card>
      {(title || filters) && (
        <CardHeader className="px-6">
          {title && <CardTitle>{title}</CardTitle>}
          {filters && <div className="mt-2">{filters}</div>}
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{renderBody()}</TableBody>
        </Table>
      </CardContent>
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <PaginationControls
          pagination={pagination}
          onPageChange={onPageChange}
          labels={paginationLabels}
        />
      )}
    </Card>
  );
}
