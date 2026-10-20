import type { Job } from "./jobsData";
import { CATEGORY_LABELS } from "./jobsData";

const HEADERS = [
  "Title",
  "Company",
  "City",
  "Region",
  "Category",
  "Work Model",
  "Employment Type",
  "Seniority",
  "Posted",
  "Updated",
  "URL",
];

function csvCell(value: string | null | undefined): string {
  let v = value ?? "";
  // Formula-injection guard: spreadsheet apps execute a cell whose first
  // non-whitespace character is = + - or @ (including after tabs/CRs) as a
  // formula. Job fields are feed-controlled, so neutralize them with a
  // leading single quote before RFC 4180 quoting.
  if (/^[\t\r\n ]*[=+\-@]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Region cell: all derived regions (what the region filter matches on),
 *  joined with "; ". Falls back to the optional upstream scalar `region`. */
function regionCell(job: Job): string | null {
  const derived = Array.isArray(job.regions) ? job.regions.filter(Boolean) : [];
  return derived.length > 0 ? derived.join("; ") : job.region;
}

function categoryLabel(slug: string): string {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, slug)
    ? CATEGORY_LABELS[slug]
    : slug;
}

/** Serializes jobs to CSV: header row, RFC 4180 CRLF, UTF-8 BOM so Excel
 *  renders Hebrew cells correctly. */
export function jobsToCsv(jobs: Job[]): string {
  const lines = [HEADERS.map(csvCell).join(",")];
  for (const job of jobs) {
    lines.push(
      [
        job.title,
        job.company,
        job.cityHe ?? job.city,
        regionCell(job),
        categoryLabel(job.job_category),
        job.workModel,
        job.employmentType,
        job.seniority,
        job.postedAt,
        job.updated,
        job.url,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** Download filename for the export: dated by the Israel calendar day
 *  (Asia/Jerusalem, same as isNewToday), not UTC. */
export function csvFileName(date: Date = new Date()): string {
  const stamp = date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return `techjobs-${stamp}.csv`;
}

/** Triggers a browser download of the given jobs as a dated CSV file. */
export function downloadJobsCsv(jobs: Job[], date: Date = new Date()): void {
  const blob = new Blob([jobsToCsv(jobs)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFileName(date);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next task: revoking synchronously right after click() can
  // cancel the download in Firefox and iOS Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
