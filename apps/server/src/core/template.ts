export type TemplateContext = Record<string, string | number | boolean | undefined | null>;

export function renderTemplate(input: string, ctx: TemplateContext): string {
  return input.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = ctx[key];
    return value == null ? "" : String(value);
  });
}

export function renderObjectTemplates<T>(value: T, ctx: TemplateContext): T {
  if (typeof value === "string") return renderTemplate(value, ctx) as T;
  if (Array.isArray(value)) return value.map((item) => renderObjectTemplates(item, ctx)) as T;
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) next[key] = renderObjectTemplates(nested, ctx);
    return next as T;
  }
  return value;
}
