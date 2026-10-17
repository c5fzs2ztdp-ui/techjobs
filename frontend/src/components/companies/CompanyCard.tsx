import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import CompanyLogo from "@/components/CompanyLogo";

interface CompanyData {
  name: string;
  jobCount: number;
  sizes: string[];
  locations: string[];
  categories: string[];
}

interface CompanyCardProps {
  company: CompanyData;
  index?: number;
  cityLabels?: Record<string, string>;
}

export default function CompanyCard({ company, index = 0, cityLabels = {} }: CompanyCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
    >
      <Link to={`${createPageUrl("CompanyProfile")}?name=${encodeURIComponent(company.name)}`}>
        <Card className="h-full hover:shadow-lg transition-all duration-300 hover:border-iris-200 group cursor-pointer border-warm-100 rounded-xl card-hover">
          <CardContent className="p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <CompanyLogo name={company.name} className="w-12 h-12 bg-warm-50 group-hover:bg-white transition-colors" />
              <Badge className="bg-iris-50 text-iris-700 hover:bg-iris-100">
                {company.jobCount} Jobs
              </Badge>
            </div>

            <h3 className="text-xl font-bold text-warm-900 mb-2 group-hover:text-iris-600 transition-colors line-clamp-1">
              {company.name}
            </h3>

            <div className="space-y-2 mb-4 flex-1">

              {company.locations.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-warm-600">
                  <MapPin className="w-4 h-4 text-warm-400" />
                  <span className="line-clamp-1">
                    {company.locations.slice(0, 3).map(l => cityLabels[l] || l).join(', ')}
                    {company.locations.length > 3 && ` +${company.locations.length - 3}`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-auto">
              {company.categories.slice(0, 3).map(cat => (
                <Badge key={cat} variant="secondary" className="text-xs font-normal">
                  {cat}
                </Badge>
              ))}
              {company.categories.length > 3 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  +{company.categories.length - 3}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
