import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJobsPayload, isClosed, JOBS_PAYLOAD_QUERY_KEY, selectCityLabels, selectSortedJobs } from "@/components/jobs/jobsData";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Building2, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import CompanyCard from "@/components/companies/CompanyCard";

export default function Companies() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (payload) => selectSortedJobs(payload).filter(j => !isClosed(j)),
  });

  // Aggregate jobs by company
  const companies = useMemo(() => {
    const companyMap = new Map<string, {
      name: string;
      jobs: typeof jobs;
      categories: Set<string>;
      sizes: Set<string>;
      locations: Set<string>;
      latestUpdate: string;
    }>();

    jobs.forEach(job => {
      const normalizedName = job.company?.trim();
      if (!normalizedName) return;

      if (!companyMap.has(normalizedName)) {
        companyMap.set(normalizedName, {
          name: normalizedName,
          jobs: [],
          categories: new Set(),
          sizes: new Set(),
          locations: new Set(),
          latestUpdate: job.updated || ''
        });
      }

      const company = companyMap.get(normalizedName)!;
      company.jobs.push(job);
      // Canonical cities only - never raw location strings ("2 Locations").
      const jobCities = job.cities?.length ? job.cities : (job.city ? [job.city] : []);
      jobCities.forEach(c => company.locations.add(c));
      if (job.department) company.categories.add(job.department);
      const t = job.updated ? new Date(job.updated).getTime() : 0;
      const cur = company.latestUpdate ? new Date(company.latestUpdate).getTime() : 0;
      if (t > cur) {
        company.latestUpdate = job.updated || '';
      }
    });

    return Array.from(companyMap.values())
      .map(c => ({
        ...c,
        categories: Array.from(c.categories),
        sizes: Array.from(c.sizes),
        locations: Array.from(c.locations),
        jobCount: c.jobs.length
      }))
      .sort((a, b) => b.jobCount - a.jobCount); // Sort by most jobs first
  }, [jobs]);

  const { data: cityLabels = {} } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5,
    select: selectCityLabels,
  });

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    const lowerQuery = searchQuery.toLowerCase();
    return companies.filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.categories.some(cat => cat.toLowerCase().includes(lowerQuery)) ||
      c.locations.some(loc =>
        loc.toLowerCase().includes(lowerQuery) ||
        (cityLabels[loc] || '').toLowerCase().includes(lowerQuery)
      )
    );
  }, [companies, searchQuery, cityLabels]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 to-iris-50/30">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-iris-700 via-iris-800 to-iris-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur">
                  <Building2 className="w-8 h-8" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">Tech Companies</h1>
              </div>
              <p className="text-lg text-iris-100 max-w-2xl">
                Discover Israel's leading tech companies and startups.
                Find the perfect workplace for your next career move.
              </p>
            </div>
            <Button asChild className="bg-copper-500 text-white hover:bg-copper-600 border-none shadow-lg">
              <Link to={createPageUrl("Jobs")}>
                <Briefcase className="w-4 h-4 mr-2" />
                Browse Jobs
              </Link>
            </Button>
          </div>

          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <Input
              placeholder="Search companies by name, industry, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-warm-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <motion.p
              className="text-warm-500 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              Found <span className="font-semibold text-warm-700">{filteredCompanies.length}</span> companies with active listings
            </motion.p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCompanies.map((company, index) => (
                <CompanyCard key={company.name} company={company} index={index} cityLabels={cityLabels} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
