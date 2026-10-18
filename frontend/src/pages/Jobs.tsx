import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePostHog } from 'posthog-js/react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Briefcase, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

import FilterSidebar from "@/components/jobs/FilterSidebar";
import { EMPTY_FILTERS, type Filters } from "@/components/jobs/filters";
import SearchHeader from "@/components/jobs/SearchHeader";
import JobCard from "@/components/jobs/JobCard";
import { downloadJobsCsv } from "@/components/jobs/exportCsv";
import JobsLoader from "@/components/jobs/JobsLoader";
import { CATEGORY_LABELS, displayCity, fetchJobsPayload, isClosed, JOBS_PAYLOAD_QUERY_KEY, selectCityLabels, selectSortedJobs, type Job } from "@/components/jobs/jobsData";
import { savedJobsApi } from "@/api/storage";

// Types for mutation results
type SaveMutationResult = { action: 'saved' | 'removed'; job: Job };
type ApplyMutationResult = { action: 'applied' | 'unapplied'; job: Job };

const JOBS_PER_PAGE = 20;

export default function Jobs() {
  const posthog = usePostHog();
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialSearch = searchParams.get('search') || '';
  const initialCategoryParam = searchParams.get('category') || '';
  const initialCity = searchParams.get('city') || '';

  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Apply category/city from URL on mount. Categories are role-category
  // slugs from the jobs taxonomy (see CATEGORY_LABELS in jobsData).
  useEffect(() => {
    // Ignore a param that is not a real taxonomy slug or canonical city: an
    // unknown value would silently filter the board to zero jobs with no
    // visible filter chip explaining why.
    // Own-property check: CATEGORY_LABELS is a plain object, so inherited
    // keys like 'toString' or '__proto__' must not be accepted as slugs.
    if (initialCategoryParam && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, initialCategoryParam)) {
      setFilters(prev => ({ ...prev, jobCategories: [initialCategoryParam] }));
    } else {
      // Like the city param: navigating from /jobs?category=qa to plain
      // /jobs must drop the filter, or the list stays filtered with no URL
      // state explaining why.
      setFilters(prev => (prev.jobCategories.length > 0 ? { ...prev, jobCategories: [] } : prev));
    }
    if (initialCity) {
      setFilters(prev => ({ ...prev, cities: [initialCity] }));
    } else {
      // The city filter follows the URL: navigating from /jobs?city=X back
      // to plain /jobs must drop it, or the list stays filtered with no URL
      // state explaining why.
      setFilters(prev => (prev.cities.length > 0 ? { ...prev, cities: [] } : prev));
    }
  }, [initialCategoryParam, initialCity]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Update local state when URL param changes
  useEffect(() => {
    const query = new URLSearchParams(location.search).get('search');
    if (query !== null) {
      setSearchQuery(query);
    }
  }, [location.search]);

  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, isError, refetch } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    select: selectSortedJobs,
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ['savedJobs'],
    queryFn: () => savedJobsApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (job: Job): Promise<SaveMutationResult> => {
      const existing = savedJobs.find(s => s.url === job.url);
      if (existing) {
        await savedJobsApi.delete(existing.id, existing.url);
        return { action: 'removed', job };
      } else {
        await savedJobsApi.create({
          job_title: job.title,
          company: job.company,
          category: job.department || undefined,
          city: displayCity(job),
          url: job.url,
          level: job.seniority || undefined,
          job_category: job.job_category
        });
        return { action: 'saved', job };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['savedJobs'] });
      toast.success(result.action === 'saved' ? 'Job saved!' : 'Job removed from saved');
      // Track in PostHog
      posthog.capture(result.action === 'saved' ? 'job_saved' : 'job_unsaved', {
        job_title: result.job.title,
        company: result.job.company,
        job_category: result.job.job_category,
        city: result.job.city,
        seniority: result.job.seniority,
      });
    },
    onError: () => {
      toast.error('Could not update saved jobs. Please try again.');
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (job: Job): Promise<ApplyMutationResult> => {
      const existing = savedJobs.find(s => s.url === job.url);
      if (existing) {
        await savedJobsApi.update(existing.id, {
          applied: !existing.applied,
          applied_date: !existing.applied ? new Date().toISOString().split('T')[0] : undefined
        }, existing.url);
        return { action: existing.applied ? 'unapplied' : 'applied', job };
      } else {
        await savedJobsApi.create({
          job_title: job.title,
          company: job.company,
          category: job.department || undefined,
          city: displayCity(job),
          url: job.url,
          level: job.seniority || undefined,
          job_category: job.job_category,
          applied: true,
          applied_date: new Date().toISOString().split('T')[0]
        });
        return { action: 'applied', job };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['savedJobs'] });
      toast.success(result.action === 'applied' ? 'Marked as applied!' : 'Unmarked as applied');
      // Track in PostHog
      posthog.capture(result.action === 'applied' ? 'job_applied' : 'job_unapplied', {
        job_title: result.job.title,
        company: result.job.company,
        job_category: result.job.job_category,
        city: result.job.city,
        seniority: result.job.seniority,
      });
    },
    onError: () => {
      toast.error('Could not update the application status. Please try again.');
    },
  });

  // Extract unique cities from jobs
  const { data: cityLabels = {} } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5,
    select: selectCityLabels,
  });

  // City facet: canonical cities only (never raw location strings like
  // "2 Locations"), labeled in Hebrew when known.
  const cities = useMemo(() => {
    const citySet = new Set(jobs.flatMap(job => job.cities));
    return Array.from(citySet).sort((a, b) => (cityLabels[a] || a).localeCompare(cityLabels[b] || b));
  }, [jobs, cityLabels]);

  // City params validate against the canonical cities actually present in
  // the payload - not cityLabels, which is an optional translation table
  // that can lag new cities and would silently drop a valid filter.
  const validCities = useMemo(() => new Set(jobs.flatMap(job => job.cities)), [jobs]);
  useEffect(() => {
    if (!initialCity || validCities.size === 0) return;
    if (!validCities.has(initialCity)) {
      setFilters(prev => ({ ...prev, cities: prev.cities.filter(c => c !== initialCity) }));
    }
  }, [initialCity, validCities]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Closed tombstones are hidden unless the user asks for them
      if (isClosed(job) && !filters.showClosed) return false;

      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const matchesSearch =
          job.title?.toLowerCase().includes(search) ||
          job.company?.toLowerCase().includes(search) ||
          job.department?.toLowerCase().includes(search) ||
          job.city?.toLowerCase().includes(search) ||
          job.cityHe?.includes(searchQuery) ||
          job.cities.some(city =>
            city.toLowerCase().includes(search) ||
            (cityLabels[city] || '').toLowerCase().includes(search)
          ) ||
          job.technologies.some(t => t.toLowerCase().includes(search));
        if (!matchesSearch) return false;
      }

      // Job category filter
      if (filters.jobCategories.length > 0 && !filters.jobCategories.includes(job.job_category)) {
        return false;
      }

      // Work model filter
      if (filters.workModels.length > 0 && (!job.workModel || !filters.workModels.includes(job.workModel))) {
        return false;
      }

      // Employment type filter
      if (filters.employmentTypes.length > 0 && (!job.employmentType || !filters.employmentTypes.includes(job.employmentType))) {
        return false;
      }

      // Seniority filter
      if (filters.seniorities.length > 0 && (!job.seniority || !filters.seniorities.includes(job.seniority))) {
        return false;
      }

      // Region filter (a job matches ANY of its regions)
      if (filters.regions.length > 0 &&
          !job.regions.some(r => filters.regions.includes(r))) {
        return false;
      }

      // City filter (a job matches ANY of its canonical cities)
      if (filters.cities.length > 0 &&
          !job.cities.some(c => filters.cities.includes(c))) {
        return false;
      }

      return true;
    });
  }, [jobs, filters, searchQuery, cityLabels]);

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  // A background refetch can shrink the result set while the user sits on a
  // page that no longer exists; clamp instead of rendering an empty list.
  const activePage = Math.min(currentPage, Math.max(totalPages, 1));
  const paginatedJobs = filteredJobs.slice(
    (activePage - 1) * JOBS_PER_PAGE,
    activePage * JOBS_PER_PAGE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery]);

  // Track search in PostHog (debounced, only on query change)
  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(() => {
        posthog.capture('job_search', {
          query: searchQuery,
          results_count: filteredJobs.length,
        });
      }, 1000); // Debounce 1 second
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]); // Only trigger on query change, not results count

  // Scroll to top when page changes
  useEffect(() => {
    document.querySelector('.flex-1.overflow-y-auto')?.scrollTo(0, 0);
  }, [currentPage]);

  const activeFiltersCount =
    filters.jobCategories.length +
    filters.workModels.length +
    filters.employmentTypes.length +
    filters.seniorities.length +
    filters.cities.length +
    filters.regions.length +
    (filters.showClosed ? 1 : 0);

  const isJobSaved = (job: Job) => savedJobs.some(s => s.url === job.url);
  const isJobApplied = (job: Job) => savedJobs.some(s => s.url === job.url && s.applied);

  // Calculate pagination page numbers based on screen size (fewer pages on mobile)
  const getVisiblePageNumbers = () => {
    const maxPages = typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 5;
    const pages: number[] = [];

    if (totalPages <= maxPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (activePage <= Math.floor(maxPages / 2) + 1) {
      for (let i = 1; i <= maxPages; i++) {
        pages.push(i);
      }
    } else if (activePage >= totalPages - Math.floor(maxPages / 2)) {
      for (let i = totalPages - maxPages + 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = activePage - Math.floor(maxPages / 2);
      for (let i = start; i < start + maxPages; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 to-iris-50/30">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-iris-700 via-iris-800 to-iris-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3 md:mb-4">
                <div className="p-2 md:p-3 bg-white/10 rounded-xl backdrop-blur">
                  <Briefcase className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <h1 className="text-2xl md:text-4xl font-bold">Israeli Tech Jobs</h1>
              </div>
              <p className="text-base md:text-lg text-iris-100 max-w-2xl">
                Discover opportunities at Israel's top tech companies.
                Updated daily from leading startups and enterprises.
              </p>
            </div>
            <Button asChild className="bg-copper-700 text-white hover:bg-copper-800 border-none shadow-lg w-full md:w-auto">
              <Link to={createPageUrl("Companies")}>
                <Building2 className="w-4 h-4 mr-2" />
                Browse Companies
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Responsive height */}
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-200px)] lg:h-[calc(100vh-200px)]">
        {/* Sidebar - Mobile overlay */}
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          cities={cities}
        cityLabels={cityLabels}
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          isMobile={true}
        />
        {/* Sidebar - Desktop */}
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          cities={cities}
        cityLabels={cityLabels}
          isOpen={true}
          onClose={() => {}}
          isMobile={false}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <SearchHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onFilterClick={() => setIsFilterOpen(true)}
            totalJobs={filteredJobs.length}
            activeFiltersCount={activeFiltersCount}
            isLoading={isLoading}
            onExportCsv={() => downloadJobsCsv(filteredJobs)}
            exportCount={filteredJobs.length}
          />

          <div className="flex-1 overflow-y-auto p-4">
            {/* A failed background refresh must not replace results that
                are already on screen from the cached payload. */}
            {isError && jobs.length > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800" role="status">
                <span>Could not refresh the feed - showing the last loaded data.</span>
                <button type="button" onClick={() => refetch()} className="underline hover:text-amber-900">Retry</button>
              </div>
            )}
            {isLoading ? (
              <JobsLoader />
            ) : isError && jobs.length === 0 ? (
              <div className="text-center py-16" role="alert">
                <Briefcase className="w-16 h-16 text-warm-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-warm-700 mb-2">Jobs could not be loaded</h3>
                <p className="text-warm-500 mb-4">The live feed did not respond. Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-4 py-2 rounded-lg bg-iris-600 text-white hover:bg-iris-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : paginatedJobs.length === 0 ? (
              <div className="text-center py-16">
                <Briefcase className="w-16 h-16 text-warm-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-warm-700 mb-2">No jobs found</h3>
                <p className="text-warm-500">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 max-w-4xl">
                  {paginatedJobs.map((job, index) => (
                    <JobCard
                      key={`${job.url}-${index}`}
                      job={job}
                      index={index}
                      onSave={(job) => saveMutation.mutate(job)}
                      isSaved={isJobSaved(job)}
                      onApply={(job) => applyMutation.mutate(job)}
                      isApplied={isJobApplied(job)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 sm:gap-2 mt-8 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                      disabled={activePage === 1}
                      aria-label="Previous page" 
                      className="px-2 sm:px-3"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {getVisiblePageNumbers().map(pageNum => (
                        <Button
                          key={pageNum}
                          variant={activePage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          aria-label={`Page ${pageNum}`}
                          aria-current={activePage === pageNum ? "page" : undefined}
                          className={`min-w-[36px] ${activePage === pageNum ? "bg-iris-600" : ""}`}
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                      disabled={activePage === totalPages}
                      aria-label="Next page" 
                      className="px-2 sm:px-3"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
