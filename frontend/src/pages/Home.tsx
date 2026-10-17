import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJobsPayload } from "@/components/jobs/jobsData";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Briefcase,
  MapPin,
  Building2,
  Search,
  ArrowRight,
  Cpu,
  Shield,
  Gamepad2,
  HeartPulse,
  Coins,
  Rocket,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import AddCompanyModal from "@/components/AddCompanyModal";

// Industry cards link to the closest role-category slug in the jobs taxonomy.
const categories = [
  { name: "AI/ML", slug: "data-ai", icon: Cpu, color: "from-violet-500 to-purple-600" },
  { name: "Cybersecurity", slug: "security", icon: Shield, color: "from-emerald-500 to-teal-600" },
  { name: "Gaming", slug: "software", icon: Gamepad2, color: "from-pink-500 to-rose-600" },
  { name: "Health", slug: "other", icon: HeartPulse, color: "from-red-500 to-orange-600" },
  { name: "Fintech", slug: "finance", icon: Coins, color: "from-amber-500 to-yellow-600" },
  { name: "Aerospace", slug: "hardware-electronics", icon: Rocket, color: "from-blue-500 to-cyan-600" },
];

const FALLBACK_STATS = { jobs: "2,500+", companies: "500+", cities: "50+" };

export default function Home() {
  const { data: payload } = useQuery({
    queryKey: ['jobsPayload'],
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5,
  });
  const stats = useMemo(() => {
    const jobs = payload?.jobs || [];
    const companies = new Set(jobs.map(j => j.company)).size;
    const cities = new Set(jobs.flatMap(j => j.cities || [])).size;
    return [
      { label: "Active Jobs", value: jobs.length ? jobs.length.toLocaleString() : FALLBACK_STATS.jobs, icon: Briefcase },
      { label: "Tech Companies", value: companies ? companies.toLocaleString() : FALLBACK_STATS.companies, icon: Building2 },
      { label: "Cities Covered", value: cities ? String(cities) : FALLBACK_STATS.cities, icon: MapPin },
    ];
  }, [payload]);
  const navigate = useNavigate();
  const [showAddCompany, setShowAddCompany] = useState(false);

  const handleCategoryClick = (categorySlug: string) => {
    navigate(`${createPageUrl("Jobs")}?category=${encodeURIComponent(categorySlug)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 via-white to-iris-50/30">
      {/* Hero Section - with padding-top for the absolute header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-iris-700 via-iris-800 to-iris-900" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-iris-400/10 rounded-full blur-3xl" />
        </div>

        {/* Spacer for the absolute positioned header */}
        <div className="h-16" />

        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white/90 text-sm mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Updated daily with new opportunities
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
              Find Your Dream Job in
              <br />
              <span className="bg-gradient-to-r from-copper-400 to-copper-500 bg-clip-text text-transparent">
                Israeli Tech
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-iris-100 max-w-2xl mx-auto mb-10">
              Discover opportunities at Israel's leading startups and tech giants.
              All in one place, updated in real-time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-copper-500 text-white hover:bg-copper-600 text-lg px-8 py-6 rounded-xl shadow-xl shadow-black/20"
              >
                <Link to={createPageUrl("Jobs")}>
                  <Search className="w-5 h-5 mr-2" />
                  Explore Jobs
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 text-lg px-8 py-6 rounded-xl backdrop-blur-sm"
              >
                <Link to={createPageUrl("Map")}>
                  <MapPin className="w-5 h-5 mr-2" />
                  View Map
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 -mt-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="bg-white shadow-xl border-0 rounded-2xl">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 bg-iris-100 rounded-xl">
                    <stat.icon className="w-6 h-6 text-iris-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-warm-900">{stat.value}</p>
                    <p className="text-warm-500">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Categories Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-warm-900 mb-4">
            Browse by Industry
          </h2>
          <p className="text-lg text-warm-600 max-w-2xl mx-auto">
            From AI and Cybersecurity to Gaming and Fintech — find your niche
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card
                className="group cursor-pointer hover:shadow-xl transition-all duration-300 overflow-hidden border-0 bg-white rounded-2xl card-hover"
                onClick={() => handleCategoryClick(category.slug)}
              >
                <CardContent className="p-6 text-center">
                  <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center transform group-hover:scale-110 transition-transform`}>
                    <category.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-warm-900 group-hover:text-iris-600 transition-colors">
                    {category.name}
                  </h3>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button asChild variant="outline" size="lg" className="gap-2 rounded-xl">
            <Link to={createPageUrl("Jobs")}>
              View All Categories
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-iris-900 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Find Your Next Opportunity?
          </h2>
          <p className="text-lg text-iris-200 mb-8 max-w-2xl mx-auto">
            Join thousands of tech professionals who use our platform to discover
            their dream jobs at Israel's most innovative companies.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-copper-500 hover:bg-copper-600 text-lg px-8 py-6 rounded-xl"
          >
            <Link to={createPageUrl("Jobs")}>
              Start Searching Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-warm-900 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCompany(true)}
            className="border-warm-700 text-warm-300 hover:text-white hover:bg-warm-800 gap-2"
            aria-label="Add your company to TechJobsIL"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Your Company
          </Button>

          <nav className="flex items-center justify-center gap-3 flex-wrap" aria-label="Legal links">
            <Button asChild variant="ghost" size="sm" className="text-warm-400 hover:text-white hover:bg-warm-800">
              <Link to={createPageUrl("PrivacyPolicy")}>
                Privacy Policy
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-warm-400 hover:text-white hover:bg-warm-800">
              <Link to={createPageUrl("TermsOfService")}>
                Terms of Service
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-warm-400 hover:text-white hover:bg-warm-800">
              <Link to={createPageUrl("AccessibilityStatement")}>
                Accessibility
              </Link>
            </Button>
          </nav>

          <p className="text-warm-500 text-xs">
            © {new Date().getFullYear()} TechJobsIL. All rights reserved.
          </p>
        </div>
      </footer>

      <AddCompanyModal open={showAddCompany} onOpenChange={setShowAddCompany} />
    </div>
  );
}
