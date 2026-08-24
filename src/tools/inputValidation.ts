export type ToolInputIssueCode = "required" | "type" | "enum" | "item_type";

export interface ToolInputValidationIssue {
  field: string;
  code: ToolInputIssueCode;
}

export interface ToolInputValidationResult {
  valid: boolean;
  issues: ToolInputValidationIssue[];
}

interface SimpleSchema {
  type?: unknown;
  required?: unknown;
  properties?: unknown;
  enum?: unknown;
  items?: unknown;
}

function matchesType(value: unknown, type: unknown): boolean {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array": return Array.isArray(value);
    default: return true;
  }
}

export function validateToolInput(
  schema: unknown,
  input: Record<string, unknown>,
): ToolInputValidationResult {
  const candidate = (schema ?? {}) as SimpleSchema;
  const issues: ToolInputValidationIssue[] = [];
  const required = Array.isArray(candidate.required)
    ? candidate.required.filter((field): field is string => typeof field === "string")
    : [];
  const properties = candidate.properties && typeof candidate.properties === "object"
    ? candidate.properties as Record<string, SimpleSchema>
    : {};

  for (const field of required) {
    if (!Object.prototype.hasOwnProperty.call(input, field) || input[field] === undefined) {
      issues.push({ field, code: "required" });
    }
  }

  for (const [field, propertySchema] of Object.entries(properties)) {
    const value = input[field];
    if (value === undefined) continue;
    if (!matchesType(value, propertySchema.type)) {
      issues.push({ field, code: "type" });
      continue;
    }
    if (Array.isArray(propertySchema.enum) && !propertySchema.enum.some((item) => Object.is(item, value))) {
      issues.push({ field, code: "enum" });
    }
    if (Array.isArray(value)) {
      const itemSchema = propertySchema.items as SimpleSchema | undefined;
      if (itemSchema?.type !== undefined && value.some((item) => !matchesType(item, itemSchema.type))) {
        issues.push({ field, code: "item_type" });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function formatToolInputValidationError(result: ToolInputValidationResult): string {
  const details = result.issues.map((issue) => `${issue.field}:${issue.code}`).join(", ");
  return `Invalid tool input${details ? ` (${details})` : ""}.`;
}
