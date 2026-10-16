import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePostHog } from 'posthog-js/react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Briefcase, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

import FilterSidebar, { EMPTY_FILTERS, type Filters } from "@/components/jobs/FilterSidebar";
import SearchHeader from "@/components/jobs/SearchHeader";
import JobCard from "@/components/jobs/JobCard";
import JobsLoader from "@/components/jobs/JobsLoader";
import { displayCity, fetchAllJobs, type Job } from "@/components/jobs/jobsData";
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
  const initialCategory = searchParams.get('category') || '';
  const initialCity = searchParams.get('city') || '';

  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Apply category/city from URL on mount
  useEffect(() => {
    if (initialCategory) {
      setFilters(prev => ({ ...prev, jobCategories: [initialCategory] }));
    }
    if (initialCity) {
      setFilters(prev => ({ ...prev, cities: [initialCity] }));
    }
  }, [initialCategory, initialCity]);
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

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchAllJobs,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ['savedJobs'],
    queryFn: () => savedJobsApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (job: Job): Promise<SaveMutationResult> => {
      const existing = savedJobs.find(s => s.url === job.url);
      if (existing) {
        await savedJobsApi.delete(existing.id);
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
  });

  const applyMutation = useMutation({
    mutationFn: async (job: Job): Promise<ApplyMutationResult> => {
      const existing = savedJobs.find(s => s.url === job.url);
      if (existing) {
        await savedJobsApi.update(existing.id, {
          applied: !existing.applied,
          applied_date: !existing.applied ? new Date().toISOString().split('T')[0] : undefined
        });
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
  });

  // Extract unique cities from jobs
  const cities = useMemo(() => {
    const citySet = new Set(jobs.map(job => displayCity(job)).filter(Boolean));
    return Array.from(citySet).sort();
  }, [jobs]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const matchesSearch =
          job.title?.toLowerCase().includes(search) ||
          job.company?.toLowerCase().includes(search) ||
          job.department?.toLowerCase().includes(search) ||
          job.city?.toLowerCase().includes(search) ||
          job.cityHe?.includes(searchQuery) ||
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

      // City filter (matches the displayed label or the canonical English city)
      if (filters.cities.length > 0 &&
          !filters.cities.includes(displayCity(job)) &&
          !filters.cities.includes(job.city || '')) {
        return false;
      }

      return true;
    });
  }, [jobs, filters, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE
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
    filters.cities.length;

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
    } else if (currentPage <= Math.floor(maxPages / 2) + 1) {
      for (let i = 1; i <= maxPages; i++) {
        pages.push(i);
      }
    } else if (currentPage >= totalPages - Math.floor(maxPages / 2)) {
      for (let i = totalPages - maxPages + 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = currentPage - Math.floor(maxPages / 2);
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
            <Button asChild className="bg-copper-500 text-white hover:bg-copper-600 border-none shadow-lg w-full md:w-auto">
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
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          isMobile={true}
        />
        {/* Sidebar - Desktop */}
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          cities={cities}
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
          />

          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <JobsLoader />
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
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 sm:px-3"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {getVisiblePageNumbers().map(pageNum => (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[36px] ${currentPage === pageNum ? "bg-iris-600" : ""}`}
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
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
