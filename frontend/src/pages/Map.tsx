import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Building2, Briefcase, Loader2, AlertCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { CITY_COORDS } from "@/components/map/cityCoords";
import { fetchJobsPayload, isClosed, JOBS_PAYLOAD_QUERY_KEY, selectSortedJobs } from "@/components/jobs/jobsData";


// Custom marker icon - Using iris color theme
const createCustomIcon = (count: number) => {
  const size = Math.min(50, Math.max(30, 20 + Math.log(count) * 8));
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: linear-gradient(135deg, #4A489A 0%, #3D3B8E 100%);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${size > 35 ? '14px' : '12px'};
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        border: 2px solid white;
      ">${count}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Exact (case-insensitive) match first; the substring fallback picks the
// longest matching key so "Or Yehuda" never resolves to "Yehud".
function findCityCoords(city: string): [number, number] | null {
  const needle = city.toLowerCase();
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    if (name.toLowerCase() === needle) return c;
  }
  let best: [number, number] | null = null;
  let bestLen = -1;
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    const key = name.toLowerCase();
    if ((needle.includes(key) || key.includes(needle)) && key.length > bestLen) {
      best = c;
      bestLen = key.length;
    }
  }
  return best;
}

interface CityData {
  city: string;
  coords: [number, number];
  companies: string[];
  jobCount: number;
}

interface CityMapEntry {
  companies: Set<string>;
  jobCount: number;
}

// Component to fit bounds
function FitBounds({ cities }: { cities: CityData[] }) {
  const map = useMap();

  useEffect(() => {
    if (cities.length > 0) {
      const bounds = L.latLngBounds(cities.map(c => c.coords));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [cities, map]);

  return null;
}

export default function Map() {
  const { data: jobs = [], isLoading: loading, isError } = useQuery({
    queryKey: JOBS_PAYLOAD_QUERY_KEY,
    queryFn: fetchJobsPayload,
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (payload) => selectSortedJobs(payload).filter(j => !isClosed(j)),
  });
  const error = isError ? 'Failed to load job data. Please try again later.' : null;

  // Aggregate jobs by city
  const cityData = useMemo(() => {
    const cityMap: Record<string, CityMapEntry> = {};

    jobs.forEach((job) => {
      // Count the job once per canonical city, matching filter semantics.
      const jobCities = (job.cities?.length ? job.cities : [job.city]).filter((c): c is string => Boolean(c));
      const seen = new Set<string>();
      for (const rawCity of jobCities) {
      const city = rawCity.trim();
      if (!city || seen.has(city)) continue;
      seen.add(city);

      // Find matching city coords
      const coords = findCityCoords(city);

      if (!coords) continue; // Skip unknown cities

      if (!cityMap[city]) {
        cityMap[city] = { companies: new Set<string>(), jobCount: 0 };
      }
      cityMap[city].companies.add(job.company);
      cityMap[city].jobCount++;
      }
    });

    // Convert to array and merge similar cities
    const processedCoords: Record<string, CityData> = {};

    Object.entries(cityMap).forEach(([city, data]: [string, CityMapEntry]) => {
      const coords = findCityCoords(city) ?? CITY_COORDS["Israel"];

      const coordKey = coords.join(",");
      const existing = processedCoords[coordKey];

      if (existing) {
        data.companies.forEach((c: string) => existing.companies.push(c));
        existing.jobCount += data.jobCount;
        existing.companies = [...new Set(existing.companies)];
      } else {
        processedCoords[coordKey] = {
          city,
          coords,
          companies: [...data.companies],
          jobCount: data.jobCount,
        };
      }
    });

    return Object.values(processedCoords).sort((a, b) => b.jobCount - a.jobCount);
  }, [jobs]);

  return (
    <div className="bg-white" style={{ height: "calc(100vh - 64px)" }}>
      {/* Stats Bar */}
      <div className="bg-warm-50 border-b border-warm-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-warm-600">
          <span className="font-medium">TechJobsIL</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {new Set(jobs.map(j => j.company)).size} Companies
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" />
              {jobs.length} Jobs
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: "calc(100% - 40px)", width: "100%" }}>
        {loading ? (
          <div className="h-full flex items-center justify-center bg-warm-50">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-iris-500 mx-auto mb-3" />
              <p className="text-warm-500">Loading tech companies...</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center bg-warm-50">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-warm-700 font-medium mb-2">Error Loading Map</p>
              <p className="text-warm-500 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={[31.5, 34.75]}
            zoom={8}
            style={{ height: "100%", width: "100%", background: "#FDFBF7" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds cities={cityData} />
            {cityData.map((city) => (
              <Marker
                key={city.coords.join(",")}
                position={city.coords}
                icon={createCustomIcon(city.jobCount)}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <h3 className="font-bold text-lg text-warm-900 mb-2">{city.city}</h3>
                    <div className="flex items-center gap-4 text-sm text-warm-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {city.companies.length} companies
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {city.jobCount} jobs
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      <p className="text-xs text-warm-500 mb-1">Top companies:</p>
                      <div className="flex flex-wrap gap-1">
                        {city.companies.slice(0, 10).map((company: string) => (
                          <Link
                            key={company}
                            to={`${createPageUrl("CompanyProfile")}?name=${encodeURIComponent(company)}`}
                            className="text-xs bg-iris-100 text-iris-700 px-2 py-0.5 rounded hover:bg-iris-200"
                          >
                            {company}
                          </Link>
                        ))}
                        {city.companies.length > 10 && (
                          <span className="text-xs text-warm-400">
                            +{city.companies.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`${createPageUrl("Jobs")}?city=${encodeURIComponent(city.city)}`}
                      className="mt-3 block text-center text-sm text-iris-600 hover:text-iris-700 font-medium"
                    >
                      View all jobs in {city.city} →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

    </div>
  );
}
