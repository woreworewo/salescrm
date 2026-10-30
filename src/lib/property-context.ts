import type { PropertyOption } from "./models";

export const PROPERTY_COOKIE = "crm-property";

export function selectProperty(options: PropertyOption[], requested?: string) {
  if (requested)
    return options.find((property) => property.id === requested) ?? null;
  return options[0] ?? null;
}

export function matchesProperty(activeId: string, submittedId: unknown) {
  return typeof submittedId === "string" && submittedId === activeId;
}
