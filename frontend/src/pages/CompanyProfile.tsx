import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { displayCity, fetchJobsPayload, isClosed, JOBS_PAYLOAD_QUERY_KEY, selectSortedJobs, type Job } from "@/components/jobs/jobsData";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MapPin, Globe,
  Search, Briefcase
} from "lucide-react";
import { Input } from "@/components/ui/input";
import JobCard from "@/components/jobs/JobCard";
import CompanyLogo from "@/components/CompanyLogo";
import GuestGateModal from "@/components/GuestGateModal";
import { GUEST_JOB_LIMIT, useGuestGate } from "@/hooks/useGuestGate";
import { savedJobsApi } from "@/api/storage";
import { toast } from "sonner";

export default function CompanyProfile() {
  const [searchQuery, setSearchQuery] = useState('');
  const queryParams = new URLSearchParams(window.location.search);
  const companyName = queryParams.get('name');
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading: isJobsLoading } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (payload) => selectSortedJobs(payload).filter(j => !isClosed(j)),
  });

  const { data: cityLabels = {} } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (payload) => payload.cityLabels ?? {},
  });

  const { data: savedJobs = [] } = useQuery({
    queryKey: ['savedJobs'],
    queryFn: () => savedJobsApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (job: Job) => {
      const existing = savedJobs.find(s => s.url === job.url);
      if (existing) {
        await savedJobsApi.delete(existing.id, existing.url);
        return { action: 'removed' };
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
        return { action: 'saved' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['savedJobs'] });
      toast.success(result.action === 'saved' ? 'Job saved!' : 'Job removed from saved');
    },
  });

  const companyData = useMemo(() => {
    if (!companyName || jobs.length === 0) return null;

    const companyJobs = jobs.filter(j => j.company === companyName);
    if (companyJobs.length === 0) return null;

    // Aggregate data
    const categories = Array.from(new Set(companyJobs.map(j => j.department).filter(Boolean))) as string[];
    // Cards may list several canonical cities; surface them all (with
    // their Hebrew labels), not just the primary one.
    const locations = Array.from(new Set(companyJobs.flatMap(j =>
      j.cities.length > 0 ? j.cities.map(c => cityLabels[c] || c) : [displayCity(j)]
    ).filter(Boolean)));
    const jobCategories = Array.from(new Set(companyJobs.map(j => j.job_category).filter(Boolean)));

    // Mirror the Jobs page: search every canonical city and its Hebrew
    // label, not just the primary English city.
    const search = searchQuery.toLowerCase();
    const filteredJobs = companyJobs.filter(job =>
      !searchQuery ||
      job.title.toLowerCase().includes(search) ||
      job.city?.toLowerCase().includes(search) ||
      job.cityHe?.includes(searchQuery) ||
      job.cities.some(city =>
        city.toLowerCase().includes(search) ||
        (cityLabels[city] || '').toLowerCase().includes(search)
      ) ||
      job.job_category?.toLowerCase().includes(search)
    );

    return {
      name: companyName,
      jobs: filteredJobs,
      totalJobs: companyJobs.length,
      categories,
      locations,
      jobCategories,
      latestUpdate: companyJobs[0]?.updated
    };
  }, [jobs, companyName, searchQuery, cityLabels]);

  const isJobSaved = (job: Job) => savedJobs.some(s => s.url === job.url);

  // Same guest gate as the Jobs page (shared first-visit clock), so company
  // pages are not a way around the preview limit.
  const guestGate = useGuestGate((companyData?.jobs.length ?? 0) > 0);
  const visibleJobs = guestGate.listLimited
    ? (companyData?.jobs ?? []).slice(0, GUEST_JOB_LIMIT)
    : (companyData?.jobs ?? []);
  const lockedCount = (companyData?.jobs.length ?? 0) - visibleJobs.length;

  if (!companyName) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold text-warm-800 mb-4">Company not found</h2>
        <Button asChild>
          <Link to={createPageUrl("Companies")}>Back to Companies</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {guestGate.showModal && <GuestGateModal onClose={guestGate.dismiss} />}
      {/* Header */}
      <div className="bg-white border-b border-warm-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Button asChild variant="ghost" className="mb-6 -ml-2 text-warm-500 hover:text-warm-900">
            <Link to={createPageUrl("Companies")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Companies
            </Link>
          </Button>

          {isJobsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-warm-200 rounded w-1/3" />
              <div className="h-6 bg-warm-200 rounded w-1/2" />
            </div>
          ) : companyData ? (
            <div className="space-y-8">
              {/* Main Info */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-start gap-5">
                    <CompanyLogo
                      name={companyData.name}
                      className="w-20 h-20 shadow-sm border-warm-200"
                      textSize="text-3xl"
                    />
                    <div className="space-y-2">
                      <div>
                        <h1 className="text-3xl font-bold text-warm-900">{companyData.name}</h1>
                        {companyData.categories.length > 0 && (
                          <div className="flex items-center gap-2 text-warm-500 mt-1">
                            <Badge variant="secondary" className="font-normal">
                              {companyData.categories.join(', ')}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[200px]">
                  <div className="flex items-center gap-2 text-warm-600">
                    <MapPin className="w-4 h-4 text-warm-400" />
                    <span>
                      {companyData.locations.join(', ') || 'Location not specified'}
                    </span>
                  </div>
                  <Button asChild variant="outline" size="sm" className="gap-2 justify-start">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(companyData.name + " Israel careers website")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="w-4 h-4" />
                      Visit Website
                    </a>
                  </Button>
                </div>
              </div>

              {/* Stats & Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Locations & Categories */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-warm-500 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Locations
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {companyData.locations.map(loc => (
                        <Badge key={loc} variant="outline" className="bg-warm-50">{loc}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-warm-500 mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Job Categories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {companyData.jobCategories.map(cat => (
                        <Badge key={cat} variant="outline" className="bg-iris-50 text-iris-700 border-iris-200">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <h2 className="text-xl font-semibold text-warm-800">Company not found</h2>
            </div>
          )}
        </div>
      </div>

      {/* Jobs Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {companyData && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-warm-900">
                Open Positions
                <span className="ml-2 text-warm-500 text-sm font-normal">
                  ({companyData.totalJobs})
                </span>
              </h2>

              {
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                  <Input
                    placeholder="Filter jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              }
            </div>

            {
              <div className="grid gap-4">
                {companyData.jobs.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-lg border border-warm-200 border-dashed">
                    <Search className="w-12 h-12 text-warm-300 mx-auto mb-3" />
                    <p className="text-warm-500">No jobs match your filter</p>
                    <Button variant="link" onClick={() => setSearchQuery('')}>Clear filter</Button>
                  </div>
                )}
                {visibleJobs.map((job, index) => (
                  <JobCard
                    key={`${job.url}-${index}`}
                    job={job}
                    index={index}
                    onSave={(job) => saveMutation.mutate(job)}
                    isSaved={isJobSaved(job)}
                  />
                ))}
                {guestGate.listLimited && lockedCount > 0 && (
                  <div className="rounded-lg border border-warm-200 bg-white p-6 text-center space-y-2">
                    <p className="text-warm-700 font-medium">
                      {lockedCount} more jobs are locked for guests
                    </p>
                    <p className="text-warm-500 text-sm">Log in to see all jobs at this company.</p>
                  </div>
                )}
              </div>}
          </div>
        )}
      </div>
    </div>
  );
}
