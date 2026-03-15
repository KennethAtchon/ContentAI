import debugLog from "@/shared/utils/debug/debug";
import { authenticatedFetch } from "@/shared/services/api/authenticated-fetch";

export interface TableConfig {
  name: string;
  tableName: string;
  keyFields: string[];
  apiEndpoint: string;
  fieldsInfo: Record<string, FieldInfo>;
}

export interface FieldInfo {
  type: string;
  nullable: boolean;
  hasDefaultValue: boolean;
  primaryKey: boolean;
  unique: boolean;
}

// Cache for schema data
let schemaCache: { tables: any[] } | null = null;
let schemaPromise: Promise<{ tables: any[] } | null> | null = null;

// Export a function to clear cache for testing
export function __clearCache() {
  schemaCache = null;
  schemaPromise = null;
}

// Fetch schema from API endpoint
async function fetchSchema(): Promise<{ tables: any[] } | null> {
  if (schemaCache) {
    return schemaCache;
  }

  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise = (async () => {
    try {
      const response = await authenticatedFetch("/api/admin/schema");
      if (!response.ok) {
        throw new Error("Failed to fetch schema");
      }
      const data = await response.json();
      schemaCache = data;
      return data;
    } catch (error) {
      debugLog.error(
        "Error fetching schema",
        { service: "drizzle-introspection", operation: "fetchSchema" },
        error
      );
      return null;
    } finally {
      schemaPromise = null;
    }
  })();

  return schemaPromise;
}

export async function getTableConfigs(): Promise<TableConfig[]> {
  const schema = await fetchSchema();
  if (!schema?.tables) return [];

  return schema.tables.map((table: any) => ({
    name: table.name,
    tableName: table.tableName,
    keyFields: (table.columns ?? []).map((c: any) => c.name),
    apiEndpoint: `/api/admin/tables/${table.name}`,
    fieldsInfo: Object.fromEntries(
      (table.columns ?? []).map((col: any) => [
        col.name,
        {
          type: col.dataType,
          nullable: col.nullable,
          hasDefaultValue: col.hasDefault,
          primaryKey: col.primaryKey,
          unique: col.unique,
        } satisfies FieldInfo,
      ])
    ),
  }));
}

export function generateExpectedParams(
  config: TableConfig
): Record<string, string> {
  const params: Record<string, string> = {};

  Object.entries(config.fieldsInfo).forEach(([fieldName, info]) => {
    // Skip auto-generated fields
    if (
      fieldName === "id" ||
      fieldName === "createdAt" ||
      fieldName === "updatedAt"
    ) {
      return;
    }

    let typeStr = (info.type ?? "unknown").toLowerCase();

    switch (info.type) {
      case "string":
        typeStr = "string";
        break;
      case "number":
      case "decimal":
        typeStr = "number";
        break;
      case "boolean":
        typeStr = "boolean";
        break;
      case "timestamp":
        typeStr = "string (ISO date)";
        break;
      case "json":
        typeStr = "object/array (JSON)";
        break;
      default:
        if (info.type.includes("[]")) {
          typeStr = "array";
        } else {
          typeStr = info.type;
        }
    }

    const required =
      !info.nullable && !info.hasDefaultValue ? "required" : "optional";
    params[fieldName] = `${typeStr} (${required})`;
  });

  return params;
}
