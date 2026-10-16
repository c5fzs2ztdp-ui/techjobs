import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bookmark,
  BookmarkX,
  MapPin,
  Building2,
  ExternalLink,
  Briefcase,
  CheckCircle2,
  Circle,
  MessageSquare,
  Pencil,
  X
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { savedJobsApi, type SavedJob } from "@/api/storage";

const levelColors: Record<string, string> = {
  'Engineer': 'bg-blue-50 text-blue-700 border-blue-200',
  'Manager': 'bg-purple-50 text-purple-700 border-purple-200',
  'Executive': 'bg-amber-50 text-amber-700 border-amber-200',
  'Intern': 'bg-green-50 text-green-700 border-green-200',
};

type FilterType = 'all' | 'applied' | 'not-applied';

export default function SavedJobs() {
  const queryClient = useQueryClient();
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const { data: savedJobs = [], isLoading } = useQuery({
    queryKey: ['savedJobs'],
    queryFn: () => savedJobsApi.list('-created_date'),
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  });

  const filteredJobs = savedJobs.filter(job => {
    if (filter === 'applied') return job.applied;
    if (filter === 'not-applied') return !job.applied;
    return true;
  });

  const appliedCount = savedJobs.filter(j => j.applied).length;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savedJobsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedJobs'] });
      toast.success('Job removed from saved');
    },
    onError: () => {
      toast.error('Failed to remove job');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SavedJob> }) =>
      savedJobsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedJobs'] });
    },
    onError: () => {
      toast.error('Failed to update job');
    },
  });

  const toggleApplied = (job: SavedJob) => {
    const newApplied = !job.applied;
    updateMutation.mutate({
      id: job.id,
      data: {
        applied: newApplied,
        applied_date: newApplied ? new Date().toISOString().split('T')[0] : undefined
      }
    }, {
      onSuccess: () => {
        toast.success(newApplied ? 'Marked as applied!' : 'Unmarked as applied');
      }
    });
  };

  const startEditingComment = (job: SavedJob) => {
    setEditingComment(job.id);
    setCommentText(job.comments || '');
  };

  const saveComment = (jobId: string) => {
    const text = commentText;
    setEditingComment(null);
    setCommentText('');
    updateMutation.mutate({
      id: jobId,
      data: { comments: text }
    }, {
      onSuccess: () => {
        toast.success('Comment saved');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 to-iris-50/30">
      {/* Header */}
      <div className="bg-white border-b border-warm-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button asChild variant="ghost" size="icon">
              <Link to={createPageUrl("Jobs")}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-iris-100 rounded-lg">
                <Bookmark className="w-6 h-6 text-iris-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-warm-900">Saved Jobs</h1>
                <p className="text-warm-500">{savedJobs.length} jobs saved • {appliedCount} applied</p>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          {savedJobs.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'bg-iris-600 hover:bg-iris-700' : ''}
              >
                All ({savedJobs.length})
              </Button>
              <Button
                variant={filter === 'applied' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('applied')}
                className={filter === 'applied' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Applied ({appliedCount})
              </Button>
              <Button
                variant={filter === 'not-applied' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('not-applied')}
                className={filter === 'not-applied' ? 'bg-warm-600 hover:bg-warm-700' : ''}
              >
                <Circle className="w-4 h-4 mr-1.5" />
                Not Applied ({savedJobs.length - appliedCount})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-6 bg-warm-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-warm-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredJobs.length === 0 && savedJobs.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="w-16 h-16 text-warm-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-warm-700 mb-2">No saved jobs yet</h3>
            <p className="text-warm-500 mb-6">
              Browse jobs and click the bookmark icon to save them here
            </p>
            <Button asChild className="bg-iris-600 hover:bg-iris-700">
              <Link to={createPageUrl("Jobs")}>
                Browse Jobs
              </Link>
            </Button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 text-warm-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-warm-700 mb-2">
              {filter === 'applied' ? 'No applied jobs yet' : 'All jobs have been applied to!'}
            </h3>
            <p className="text-warm-500 mb-6">
              {filter === 'applied'
                ? 'Mark jobs as applied when you submit your application'
                : 'Great job! You\'ve applied to all your saved positions'}
            </p>
            <Button onClick={() => setFilter('all')} variant="outline">
              View All Jobs
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {filteredJobs.map((job, index) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className="bg-white hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {job.level && (
                              <Badge
                                variant="outline"
                                className={`${levelColors[job.level] || 'bg-warm-50 text-warm-700 border-warm-200'} text-xs capitalize`}
                              >
                                {job.level}
                              </Badge>
                            )}
                            {job.job_category && (
                              <Badge variant="outline" className="bg-iris-50 text-iris-700 border-iris-200 text-xs capitalize">
                                {job.job_category.replace(/-/g, ' ')}
                              </Badge>
                            )}
                            {job.applied && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Applied {job.applied_date && `• ${format(new Date(job.applied_date), 'MMM d')}`}
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-semibold text-lg text-warm-900 mb-2 truncate">
                            {job.job_title}
                          </h3>

                          <div className="flex items-center gap-2 text-warm-600 mb-2">
                            <Building2 className="w-4 h-4 text-warm-400" />
                            <span className="font-medium">{job.company}</span>
                            {job.category && (
                              <>
                                <span className="text-warm-300">•</span>
                                <span className="text-sm text-warm-500">{job.category}</span>
                              </>
                            )}
                          </div>

                          {job.city && (
                            <div className="flex items-center gap-1.5 text-sm text-warm-500">
                              <MapPin className="w-4 h-4 text-warm-400" />
                              <span>{job.city}</span>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(job.id)}
                          disabled={deleteMutation.isPending}
                          className="text-warm-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <BookmarkX className="w-5 h-5" />
                        </Button>
                      </div>

                      {/* Comments Section */}
                      {editingComment === job.id ? (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            placeholder="Add notes about this application..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="min-h-20"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingComment(null);
                                setCommentText('');
                              }}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveComment(job.id)}
                              disabled={updateMutation.isPending}
                              className="bg-iris-600 hover:bg-iris-700 disabled:opacity-50"
                            >
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      ) : job.comments ? (
                        <div className="mt-4 p-3 bg-warm-50 rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 text-sm text-warm-600">
                              <MessageSquare className="w-4 h-4 text-warm-400 mt-0.5 shrink-0" />
                              <p className="whitespace-pre-wrap">{job.comments}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-warm-400 hover:text-warm-600"
                              onClick={() => startEditingComment(job)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 pt-4 border-t border-warm-100 flex justify-between items-center">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleApplied(job)}
                            disabled={updateMutation.isPending}
                            className={`${job.applied ? 'text-emerald-600 border-emerald-300 hover:bg-emerald-50' : ''} disabled:opacity-50`}
                          >
                            {job.applied ? (
                              <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            ) : (
                              <Circle className="w-4 h-4 mr-1.5" />
                            )}
                            {job.applied ? 'Applied' : 'Mark Applied'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingComment(job)}
                            className="gap-1.5"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {job.comments ? 'Edit Note' : 'Add Note'}
                          </Button>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          className="bg-iris-600 hover:bg-iris-700 text-white gap-2"
                        >
                          <a href={job.url} target="_blank" rel="noopener noreferrer">
                            Apply Now
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
