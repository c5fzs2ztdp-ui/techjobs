import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <Compass className="w-12 h-12 text-iris-400 mb-4" />
      <h1 className="text-2xl font-bold text-warm-800 mb-2">Page not found</h1>
      <p className="text-warm-500 mb-6">The page you're looking for doesn't exist or has moved.</p>
      <Button asChild className="bg-iris-600 hover:bg-iris-700 text-white">
        <Link to="/jobs">Browse jobs</Link>
      </Button>
    </div>
  );
}
