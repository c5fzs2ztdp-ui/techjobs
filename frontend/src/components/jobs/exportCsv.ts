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
  const v = value ?? "";
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
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
        job.region,
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

/** Triggers a browser download of the given jobs as a dated CSV file. */
export function downloadJobsCsv(jobs: Job[], date: Date = new Date()): void {
  const stamp = date.toISOString().slice(0, 10);
  const blob = new Blob([jobsToCsv(jobs)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `techjobs-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
