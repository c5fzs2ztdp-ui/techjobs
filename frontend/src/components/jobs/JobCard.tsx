import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Bookmark, BookmarkCheck, ExternalLink, CheckCircle2, Globe, Building } from "lucide-react";
import { motion } from "framer-motion";
import { usePostHog } from 'posthog-js/react';
import CompanyLogo from "@/components/CompanyLogo";
import { displayCity, isClosed, isNewToday, CATEGORY_LABELS, type Job } from "./jobsData";

const seniorityColors: Record<string, string> = {
  intern: 'bg-green-50 text-green-700 border-green-200',
  junior: 'bg-blue-50 text-blue-700 border-blue-200',
  senior: 'bg-purple-50 text-purple-700 border-purple-200',
  staff: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  principal: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  lead: 'bg-amber-50 text-amber-700 border-amber-200',
  manager: 'bg-amber-50 text-amber-700 border-amber-200',
};

const workModelIcons: Record<string, typeof Globe> = {
  remote: Globe,
  hybrid: Briefcase,
  'on-site': Building,
};

const MAX_TECH_CHIPS = 6;

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => void;
  isSaved: boolean;
  onApply?: (job: Job) => void;
  isApplied?: boolean;
  index?: number;
}

export default function JobCard({ job, onSave, isSaved, onApply, isApplied, index = 0 }: JobCardProps) {
  const posthog = usePostHog();
  const city = displayCity(job);
  const WorkModelIcon = job.workModel ? workModelIcons[job.workModel] : null;

  const handleApplyClick = () => {
    posthog.capture('job_apply_clicked', {
      job_title: job.title,
      company: job.company,
      job_category: job.job_category,
      city: job.city,
      seniority: job.seniority,
      url: job.url,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        role="article"
        aria-label={`${job.title} at ${job.company}`}
        className="group bg-white hover:shadow-xl transition-all duration-300 border border-warm-100 hover:border-warm-200 overflow-hidden rounded-xl card-hover"
      >
        <CardContent className="p-6">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-4">
                <CompanyLogo name={job.company} className="w-12 h-12 hidden sm:flex" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isClosed(job) && (
                      <Badge variant="outline" className="bg-warm-100 text-warm-500 border-warm-300 text-xs">
                        Closed
                      </Badge>
                    )}
                    {!isClosed(job) && isNewToday(job) && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs font-semibold">
                        New
                      </Badge>
                    )}
                    {job.seniority && (
                      <Badge
                        variant="outline"
                        className={`${seniorityColors[job.seniority] || 'bg-warm-50 text-warm-700 border-warm-200'} text-xs font-medium capitalize`}
                      >
                        {job.seniority}
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-iris-50 text-iris-700 border-iris-200 text-xs capitalize">
                      {CATEGORY_LABELS[job.job_category] || job.job_category.replace(/-/g, ' ')}
                    </Badge>
                    {job.employmentType && (
                      <Badge variant="outline" className="bg-copper-500/10 text-copper-600 border-copper-400/40 text-xs capitalize">
                        {job.employmentType.replace(/-/g, ' ')}
                      </Badge>
                    )}
                    {isSaved && (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1 pl-1.5">
                        <BookmarkCheck className="w-3 h-3" aria-hidden="true" />
                        Saved
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg text-warm-900 mb-1 group-hover:text-iris-600 transition-colors truncate">
                    {job.title}
                  </h3>

                  <div className="flex items-center gap-2 text-warm-600 mb-3">
                    <span className="font-medium">{job.company}</span>
                    {job.department && (
                      <>
                        <span className="text-warm-300">•</span>
                        <span className="text-sm text-warm-500">{job.department}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-warm-500">
                {city && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-warm-400" aria-hidden="true" />
                    <span aria-label={`Location: ${city}`}>
                      {city}{job.cities.length > 1 && ` +${job.cities.length - 1}`}
                    </span>
                  </div>
                )}
                {job.workModel && WorkModelIcon && (
                  <div className="flex items-center gap-1.5">
                    <WorkModelIcon className="w-4 h-4 text-warm-400" aria-hidden="true" />
                    <span className="capitalize" aria-label={`Work model: ${job.workModel}`}>{job.workModel.replace(/-/g, ' ')}</span>
                  </div>
                )}
              </div>

              {job.technologies.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3" aria-label="Technologies">
                  {job.technologies.slice(0, MAX_TECH_CHIPS).map(tech => (
                    <span
                      key={tech}
                      className="inline-flex items-center rounded-md bg-warm-50 px-2 py-0.5 text-xs text-warm-600 border border-warm-200"
                    >
                      {tech}
                    </span>
                  ))}
                  {job.technologies.length > MAX_TECH_CHIPS && (
                    <span className="text-xs text-warm-400">+{job.technologies.length - MAX_TECH_CHIPS} more</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2" role="group" aria-label="Job actions">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSave(job)}
                aria-label={isSaved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                aria-pressed={isSaved}
                className={`rounded-full ${isSaved ? 'text-iris-600 bg-iris-50' : 'text-warm-400 hover:text-iris-600'}`}
              >
                {isSaved ? <BookmarkCheck className="w-5 h-5" aria-hidden="true" /> : <Bookmark className="w-5 h-5" aria-hidden="true" />}
              </Button>
              {onApply && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onApply(job)}
                  aria-label={isApplied ? `Unmark ${job.title} as applied` : `Mark ${job.title} as applied`}
                  aria-pressed={isApplied}
                  className={`rounded-full ${isApplied ? 'text-emerald-600 bg-emerald-50' : 'text-warm-400 hover:text-emerald-600'}`}
                >
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-warm-100 flex justify-between items-center">
            {job.updated ? (
              <time className="text-xs text-warm-400" dateTime={job.updated}>
                {job.postedAt ? 'Posted' : 'Updated'}: {new Date(job.updated).toLocaleDateString('en-US')}
              </time>
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                className="bg-copper-500 hover:bg-copper-600 text-white gap-2 rounded-lg"
                onClick={handleApplyClick}
              >
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Apply to ${job.title} at ${job.company} (opens in new window)`}
                >
                  Apply Now
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
