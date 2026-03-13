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

// Extract field information from fetched schema
async function getDrizzleFieldInfo(
  tableName: string
): Promise<{ fields: string[]; fieldsInfo: Record<string, FieldInfo> }> {
  try {
    const schema = await fetchSchema();

    if (!schema || !schema.tables) {
      debugLog.warn(
        `Schema not available for table ${tableName}`,
        { service: "drizzle-introspection", operation: "getDrizzleFieldInfo" },
        { tableName }
      );
      return { fields: [], fieldsInfo: {} };
    }

    const table = schema.tables.find(
      (t: any) => t.name === tableName || t.tableName === tableName
    );

    if (!table) {
      debugLog.warn(
        `Table ${tableName} not found in schema`,
        { service: "drizzle-introspection", operation: "getDrizzleFieldInfo" },
        { tableName }
      );
      return { fields: [], fieldsInfo: {} };
    }

    const fields: string[] = [];
    const fieldsInfo: Record<string, FieldInfo> = {};

    table.columns.forEach((column: any) => {
      // Skip null/undefined columns and columns without required properties
      if (
        !column ||
        typeof column.name !== "string" ||
        typeof column.dataType !== "string"
      ) {
        return;
      }

      fields.push(column.name);
      fieldsInfo[column.name] = {
        type: column.dataType,
        nullable: Boolean(column.nullable),
        hasDefaultValue: Boolean(column.hasDefault),
        primaryKey: Boolean(column.primaryKey),
        unique: Boolean(column.unique),
      };
    });

    return { fields, fieldsInfo };
  } catch (error) {
    debugLog.error(
      `Error extracting fields for ${tableName}`,
      { service: "drizzle-introspection", operation: "getDrizzleFieldInfo" },
      error
    );
    return { fields: [], fieldsInfo: {} };
  }
}

export async function getTableConfigs(): Promise<TableConfig[]> {
  const modelConfigs = [
    { name: "User", tableName: "user", apiEndpoint: "/api/users" },
    { name: "Order", tableName: "order", apiEndpoint: "/api/admin/orders" },
    {
      name: "ContactMessage",
      tableName: "contact_message",
      apiEndpoint: "/api/shared/contact-messages",
    },
    {
      name: "FeatureUsage",
      tableName: "feature_usage",
      apiEndpoint: "/api/admin/feature-usages",
    },
  ];

  const configs = await Promise.all(
    modelConfigs.map(async (config) => {
      const { fields, fieldsInfo } = await getDrizzleFieldInfo(config.name);
      return {
        name: config.name,
        tableName: config.tableName,
        keyFields: fields,
        apiEndpoint: config.apiEndpoint,
        fieldsInfo,
      };
    })
  );

  return configs;
}

export async function generateExpectedParams(
  tableName: string
): Promise<Record<string, string>> {
  const { fieldsInfo } = await getDrizzleFieldInfo(tableName);
  const params: Record<string, string> = {};

  Object.entries(fieldsInfo).forEach(([fieldName, info]) => {
    // Skip auto-generated fields
    if (
      fieldName === "id" ||
      fieldName === "createdAt" ||
      fieldName === "updatedAt"
    ) {
      return;
    }

    let typeStr = info.type.toLowerCase();

    // Map Drizzle types to more readable formats
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
        // Handle arrays and other types
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
