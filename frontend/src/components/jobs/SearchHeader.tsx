import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Bookmark, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

interface SearchHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onFilterClick: () => void;
  totalJobs: number;
  activeFiltersCount: number;
  isLoading?: boolean;
  /** When provided, an Export CSV button is shown (exports the filtered list). */
  onExportCsv?: () => void;
  exportCount?: number;
}

export default function SearchHeader({ 
  searchQuery, 
  setSearchQuery, 
  onFilterClick, 
  totalJobs,
  activeFiltersCount,
  isLoading = false,
  onExportCsv,
  exportCount = 0
}: SearchHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-warm-200" role="search">
      <div className="px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search jobs, companies, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-warm-50 border-warm-200 focus:bg-white transition-colors"
              aria-label="Search jobs, companies, or keywords"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-2">
            {onExportCsv && (
              <Button
                variant="outline"
                onClick={onExportCsv}
                disabled={exportCount === 0}
                className="h-11 gap-2"
                aria-label={`Export ${exportCount} filtered jobs to CSV`}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onFilterClick}
              className="lg:hidden h-11 gap-2"
              aria-label={`Open filters${activeFiltersCount > 0 ? ` (${activeFiltersCount} active)` : ''}`}
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="bg-iris-600 text-white text-xs px-1.5 py-0.5 rounded-full" aria-hidden="true">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <Button asChild variant="outline" className="h-11 gap-2">
              <Link to={createPageUrl("SavedJobs")} aria-label="View saved jobs">
                <Bookmark className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Saved</span>
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-3 text-sm text-warm-500" role="status" aria-live="polite" aria-atomic="true">
          {isLoading ? 'Loading jobs...' : `${totalJobs.toLocaleString()} jobs found`}
        </div>
      </div>
    </div>
  );
}
