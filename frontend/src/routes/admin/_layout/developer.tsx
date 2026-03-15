import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import {
  getTableConfigs,
  generateExpectedParams,
  type TableConfig,
} from "@/shared/utils/system/drizzle-introspection";
import { debugLog } from "@/shared/utils/debug";
import { IS_DEVELOPMENT as _IS_DEVELOPMENT } from "@/shared/utils/config/envUtil";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Database,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";

export const Route = createFileRoute("/admin/_layout/developer")({
  component: DeveloperPage,
});

function DeveloperPage() {
  const { t } = useTranslation();
  const { authenticatedFetch } = useAuthenticatedFetch();
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableConfig | null>(null);
  const [jsonInput, setJsonInput] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Array<
    Record<string, unknown>
  > | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expectedParamsMap, setExpectedParamsMap] = useState<
    Record<string, object>
  >({});
  const [schemaLoading, setSchemaLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(50);
  const [includeDeleted, setIncludeDeleted] = useState<boolean>(true);

  useEffect(() => {
    async function loadSchema() {
      try {
        setSchemaLoading(true);
        const tableConfigs = await getTableConfigs();
        setTables(tableConfigs);

        const paramEntries = tableConfigs.map(
          (table) => [table.name, generateExpectedParams(table)] as const
        );
        setExpectedParamsMap(Object.fromEntries(paramEntries));
      } catch (err) {
        debugLog.error(`Failed to load schema: ${err}`);
        setError(t("admin_developer_error_load_schema"));
      } finally {
        setSchemaLoading(false);
      }
    }

    loadSchema();
  }, [t]);

  const fetchTableData = useCallback(
    async (page: number = 1) => {
      if (!selectedTable) {
        setTableData(null);
        return;
      }
      setLoading(true);
      setError(null);

      let fetchUrl = selectedTable.apiEndpoint;

      if (
        selectedTable.apiEndpoint.includes("/api/users") ||
        selectedTable.apiEndpoint.includes("/api/admin/") ||
        selectedTable.apiEndpoint.includes("/api/customer/") ||
        selectedTable.apiEndpoint.includes("/api/public/") ||
        selectedTable.apiEndpoint.includes("/api/shared/")
      ) {
        const separator = selectedTable.apiEndpoint.includes("?") ? "&" : "?";
        fetchUrl = `${selectedTable.apiEndpoint}${separator}page=${page}&limit=${pageSize}`;

        if (includeDeleted) {
          fetchUrl += "&includeDeleted=true";
        }
      }

      try {
        const res = await authenticatedFetch(fetchUrl);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || res.statusText);
        }
        const data = await res.json();

        if (data.pagination) {
          setCurrentPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.total);
          const arr = Object.values(data).find((val) => Array.isArray(val));
          setTableData(Array.isArray(arr) ? arr : []);
        } else {
          const arr = Array.isArray(data)
            ? data
            : Object.values(data).find(Array.isArray);
          setTableData(Array.isArray(arr) ? arr : []);
          setCurrentPage(1);
          setTotalPages(1);
          setTotalCount(Array.isArray(arr) ? arr.length : 0);
        }
      } catch (err: unknown) {
        let msg = t("admin_developer_error_unknown");
        if (err && typeof err === "object" && "message" in err) {
          msg = (err as Error).message;
        }
        debugLog.error(
          t("admin_developer_error_fetch_table"),
          {
            service: "admin-developer",
            operation: "fetchTableData",
            table: selectedTable.name,
          },
          err
        );
        setError(`${t("admin_developer_error_fetch_table")}: ${msg}`);
        setTableData([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedTable, pageSize, includeDeleted, authenticatedFetch, t]
  );

  useEffect(() => {
    if (selectedTable) {
      setCurrentPage(1);
      fetchTableData(1);
    } else {
      setTableData(null);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalCount(0);
    }
  }, [selectedTable, includeDeleted, fetchTableData]);

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchTableData(newPage);
    }
  }, [currentPage, fetchTableData]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchTableData(newPage);
    }
  }, [currentPage, totalPages, fetchTableData]);

  const handlePageJump = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        fetchTableData(page);
      }
    },
    [totalPages, fetchTableData]
  );

  const handleTableChange = useCallback(
    (value: string) => {
      const table = tables.find((tbl) => tbl.name === value) || null;
      setSelectedTable(table);
      setMessage(null);
      setError(null);
      setJsonInput("");
    },
    [tables]
  );

  const handleSubmit = useCallback(async () => {
    setMessage(null);
    setError(null);
    if (!selectedTable) {
      setError(t("admin_please_select_a_table"));
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (parseError) {
      debugLog.error(
        t("admin_developer_error_invalid_json"),
        {
          service: "admin-developer",
          operation: "handleSubmit",
          input: jsonInput,
        },
        parseError
      );
      setError(t("admin_developer_error_invalid_json"));
      return;
    }
    try {
      const response = await authenticatedFetch(selectedTable.apiEndpoint, {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(
          t("admin_api_error") + (errorData.message || response.statusText)
        );
      } else {
        setMessage(
          t("admin_developer_success_added", { tableName: selectedTable.name })
        );
        setJsonInput("");
        fetchTableData(currentPage);
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(t("admin_network_error") + e.message);
      } else {
        setError(t("admin_network_error_unknown_error"));
      }
    }
  }, [
    selectedTable,
    jsonInput,
    authenticatedFetch,
    fetchTableData,
    currentPage,
    t,
  ]);

  const expectedParams = useMemo(() => {
    if (!selectedTable) return null;
    return expectedParamsMap[selectedTable.name];
  }, [selectedTable, expectedParamsMap]);

  const paginationButtons = useMemo(() => {
    if (totalPages <= 1) return null;

    const buttons: React.ReactNode[] = [];
    const maxButtons = Math.min(5, totalPages);

    for (let i = 0; i < maxButtons; i++) {
      let pageNum;
      if (totalPages <= 5) {
        pageNum = i + 1;
      } else if (currentPage <= 3) {
        pageNum = i + 1;
      } else if (currentPage >= totalPages - 2) {
        pageNum = totalPages - 4 + i;
      } else {
        pageNum = currentPage - 2 + i;
      }

      buttons.push(
        <Button
          key={pageNum}
          variant={currentPage === pageNum ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageJump(pageNum)}
          className="w-10"
        >
          {pageNum}
        </Button>
      );
    }

    return buttons;
  }, [totalPages, currentPage, handlePageJump]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developer</h1>
        <p className="text-muted-foreground">
          Database tools and schema browser
        </p>
      </div>

      {/* Table Selection */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Select Table</CardTitle>
          <CardDescription>
            Choose a database table to view and manage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schemaLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading database schema...
            </div>
          ) : (
            <Select
              value={selectedTable?.name || ""}
              onValueChange={handleTableChange}
            >
              <SelectTrigger className="w-full max-w-md">
                <SelectValue
                  placeholder={t("admin_developer_select_table_placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      {table.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedTable && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                id="includeDeleted"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="rounded"
              />
              <Label
                htmlFor="includeDeleted"
                className="text-sm font-medium cursor-pointer"
              >
                {t("admin_developer_include_deleted_label")}
              </Label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Info & Add Form */}
      {selectedTable && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                {t("admin_developer_table_name", {
                  tableName: selectedTable.name,
                })}
              </CardTitle>
              <CardDescription>
                {t("admin_developer_table_key_fields", {
                  fields: selectedTable.keyFields.join(", "),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  {t("admin_developer_expected_post_parameters")}
                </Label>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono border">
                  {JSON.stringify(expectedParams, null, 2)}
                </pre>
              </div>
              <div>
                <Label
                  htmlFor="json-input"
                  className="text-sm font-semibold mb-2 block"
                >
                  JSON Input:
                </Label>
                <Textarea
                  id="json-input"
                  className="font-mono text-sm min-h-[200px]"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={t("admin_developer_json_input_placeholder", {
                    tableName: selectedTable.name,
                  })}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Add Element
              </Button>
            </CardContent>
          </Card>

          {/* Table Data */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Current {selectedTable.name} Elements</CardTitle>
              <CardDescription>
                {totalCount > 0 &&
                  `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} entries`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : tableData && tableData.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {selectedTable.keyFields.length > 0
                            ? selectedTable.keyFields.map((field) => (
                                <th
                                  key={field}
                                  className="px-3 py-2 text-left font-semibold text-xs"
                                >
                                  {field}
                                </th>
                              ))
                            : // Fallback: use all keys from first row
                              tableData[0] &&
                              Object.keys(tableData[0]).map((field) => (
                                <th
                                  key={field}
                                  className="px-3 py-2 text-left font-semibold text-xs"
                                >
                                  {field}
                                </th>
                              ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, idx) => (
                          <tr
                            key={
                              typeof row.id === "string" ||
                              typeof row.id === "number"
                                ? row.id
                                : idx
                            }
                            className="border-t hover:bg-muted/50"
                          >
                            {(selectedTable.keyFields.length > 0
                              ? selectedTable.keyFields
                              : Object.keys(row)
                            ).map((field) => (
                              <td key={field} className="px-3 py-2 text-xs">
                                {typeof row[field] === "object" &&
                                row[field] !== null
                                  ? JSON.stringify(row[field])
                                  : String(row[field] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t pt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviousPage}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <div className="flex gap-1">{paginationButtons}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextPage}
                          disabled={currentPage >= totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No data found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages */}
      {message && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 font-medium">
            {message}
          </AlertDescription>
        </Alert>
      )}
      {error && !selectedTable && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
