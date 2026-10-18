import type { Filters } from "./filters";
import { CATEGORY_LABELS, REGION_LABELS } from "./jobsData";

// URL <-> filter-state sync. The URL is the shareable, refresh-safe source
// of truth for the jobs board. Param names keep the existing public contract
// (search, category, city) and extend it with the remaining filter fields;
// list values are comma-separated.

const WORK_MODELS = new Set(["remote", "hybrid", "on-site"]);
const EMPLOYMENT_TYPES = new Set(["full-time", "part-time", "student", "intern", "temp", "contract"]);
const SENIORITIES = new Set(["intern", "junior", "senior", "staff", "principal", "lead", "manager"]);

function listParam(params: URLSearchParams, key: string, allow?: Set<string> | Record<string, string>): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => {
      if (!v) return false;
      if (!allow) return true;
      // Own-property check for plain-object allowlists: inherited keys like
      // 'toString' or '__proto__' are not valid values.
      return allow instanceof Set ? allow.has(v) : Object.prototype.hasOwnProperty.call(allow, v);
    });
}

/** Parses URL search params into filter state. Unknown values are dropped so
 *  a bogus link never silently filters the board to zero jobs. */
export function filtersFromParams(params: URLSearchParams): { filters: Filters; searchQuery: string } {
  return {
    filters: {
      search: "",
      jobCategories: listParam(params, "category", CATEGORY_LABELS),
      workModels: listParam(params, "workModel", WORK_MODELS),
      employmentTypes: listParam(params, "employmentType", EMPLOYMENT_TYPES),
      seniorities: listParam(params, "seniority", SENIORITIES),
      cities: listParam(params, "city"),
      regions: listParam(params, "region", REGION_LABELS),
      showClosed: params.get("showClosed") === "1",
    },
    searchQuery: params.get("search") || "",
  };
}

function setList(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length > 0) params.set(key, values.join(","));
}

/** Serializes filter state into search params (empty state = no params). */
export function filtersToParams(filters: Filters, searchQuery: string): URLSearchParams {
  const params = new URLSearchParams();
  const q = searchQuery.trim();
  if (q) params.set("search", q);
  setList(params, "category", filters.jobCategories);
  setList(params, "workModel", filters.workModels);
  setList(params, "employmentType", filters.employmentTypes);
  setList(params, "seniority", filters.seniorities);
  setList(params, "city", filters.cities);
  setList(params, "region", filters.regions);
  if (filters.showClosed) params.set("showClosed", "1");
  return params;
}
