import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Building2, Briefcase, Loader2, AlertCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { fetchJobsPayload, isClosed, JOBS_PAYLOAD_QUERY_KEY, selectSortedJobs } from "@/components/jobs/jobsData";

// Israeli city coordinates - English and Hebrew names
const CITY_COORDS: Record<string, [number, number]> = {
  // Tel Aviv area
  "Tel Aviv": [32.0853, 34.7818],
  "Tel Aviv-Yafo": [32.0853, 34.7818],
  "Tel-Aviv": [32.0853, 34.7818],
  "TLV": [32.0853, 34.7818],
  "תל אביב": [32.0853, 34.7818],
  "תל אביב-יפו": [32.0853, 34.7818],
  "תל-אביב": [32.0853, 34.7818],

  // Herzliya
  "Herzliya": [32.1663, 34.8464],
  "הרצליה": [32.1663, 34.8464],

  // Ramat Gan
  "Ramat Gan": [32.0680, 34.8248],
  "רמת גן": [32.0680, 34.8248],
  "רמת-גן": [32.0680, 34.8248],

  // Petah Tikva
  "Petah Tikva": [32.0841, 34.8878],
  "Petach Tikva": [32.0841, 34.8878],
  "פתח תקווה": [32.0841, 34.8878],
  "פתח תקוה": [32.0841, 34.8878],

  // Bnei Brak
  "Bnei Brak": [32.0833, 34.8333],
  "בני ברק": [32.0833, 34.8333],

  // Jerusalem
  "Jerusalem": [31.7683, 35.2137],
  "ירושלים": [31.7683, 35.2137],

  // Haifa
  "Haifa": [32.7940, 34.9896],
  "חיפה": [32.7940, 34.9896],

  // Beer Sheva
  "Beer Sheva": [31.2518, 34.7913],
  "Be'er Sheva": [31.2518, 34.7913],
  "Beersheba": [31.2518, 34.7913],
  "באר שבע": [31.2518, 34.7913],

  // Netanya
  "Netanya": [32.3286, 34.8572],
  "נתניה": [32.3286, 34.8572],

  // Holon
  "Holon": [32.0117, 34.7728],
  "חולון": [32.0117, 34.7728],

  // Rishon LeZion
  "Rishon LeZion": [31.9730, 34.7925],
  "Rishon Lezion": [31.9730, 34.7925],
  "ראשון לציון": [31.9730, 34.7925],

  // Rehovot
  "Rehovot": [31.8928, 34.8113],
  "רחובות": [31.8928, 34.8113],

  // Ashdod
  "Ashdod": [31.8014, 34.6428],
  "אשדוד": [31.8014, 34.6428],

  // Ashkelon
  "Ashkelon": [31.6688, 34.5742],
  "אשקלון": [31.6688, 34.5742],

  // Kfar Saba
  "Kfar Saba": [32.1780, 34.9066],
  "כפר סבא": [32.1780, 34.9066],

  // Ra'anana
  "Ra'anana": [32.1840, 34.8710],
  "Raanana": [32.1840, 34.8710],
  "רעננה": [32.1840, 34.8710],

  // Modiin
  "Modiin": [31.8908, 35.0104],
  "Modi'in": [31.8908, 35.0104],
  "מודיעין": [31.8908, 35.0104],

  // Yokneam
  "Yokneam": [32.6592, 35.1097],
  "Yoqneam": [32.6592, 35.1097],
  "יקנעם": [32.6592, 35.1097],

  // Caesarea
  "Caesarea": [32.5000, 34.8833],
  "קיסריה": [32.5000, 34.8833],

  // Nazareth
  "Nazareth": [32.6996, 35.3035],
  "נצרת": [32.6996, 35.3035],

  // Acre/Akko
  "Acre": [32.9276, 35.0818],
  "Akko": [32.9276, 35.0818],
  "עכו": [32.9276, 35.0818],

  // Eilat
  "Eilat": [29.5577, 34.9519],
  "אילת": [29.5577, 34.9519],

  // Givatayim
  "Givatayim": [32.0719, 34.8102],
  "גבעתיים": [32.0719, 34.8102],

  // Lod
  "Lod": [31.9508, 34.8893],
  "לוד": [31.9508, 34.8893],

  // Ramla
  "Ramla": [31.9275, 34.8625],
  "רמלה": [31.9275, 34.8625],

  // Kiryat Gat
  "Kiryat Gat": [31.6086, 34.7647],
  "קריית גת": [31.6086, 34.7647],

  // Rosh HaAyin
  "Rosh HaAyin": [32.0956, 34.9567],
  "Rosh Haayin": [32.0956, 34.9567],
  "ראש העין": [32.0956, 34.9567],

  // Hod HaSharon
  "Hod HaSharon": [32.1500, 34.8833],
  "הוד השרון": [32.1500, 34.8833],

  // Shoham
  "Shoham": [31.9989, 34.9467],
  "שוהם": [31.9989, 34.9467],

  // Bat Yam
  "Bat Yam": [32.0231, 34.7503],
  "בת ים": [32.0231, 34.7503],

  // Karmiel
  "Karmiel": [32.9136, 35.2961],
  "כרמיאל": [32.9136, 35.2961],

  // Kiryat Ata
  "Kiryat Ata": [32.8097, 35.1064],
  "קריית אתא": [32.8097, 35.1064],

  // Kiryat Bialik
  "Kiryat Bialik": [32.8333, 35.0833],
  "קריית ביאליק": [32.8333, 35.0833],

  // Kiryat Motzkin
  "Kiryat Motzkin": [32.8397, 35.0772],
  "קריית מוצקין": [32.8397, 35.0772],

  // Kiryat Yam
  "Kiryat Yam": [32.8500, 35.0667],
  "קריית ים": [32.8500, 35.0667],

  // Nahariya
  "Nahariya": [33.0078, 35.0950],
  "נהריה": [33.0078, 35.0950],

  // Afula
  "Afula": [32.6100, 35.2900],
  "עפולה": [32.6100, 35.2900],

  // Tiberias
  "Tiberias": [32.7922, 35.5312],
  "טבריה": [32.7922, 35.5312],

  // Safed/Tzfat
  "Safed": [32.9658, 35.4983],
  "Tzfat": [32.9658, 35.4983],
  "צפת": [32.9658, 35.4983],

  // Dimona
  "Dimona": [31.0697, 35.0331],
  "דימונה": [31.0697, 35.0331],

  // Sderot
  "Sderot": [31.5250, 34.5967],
  "שדרות": [31.5250, 34.5967],

  // Beit Shemesh
  "Beit Shemesh": [31.7514, 34.9886],
  "בית שמש": [31.7514, 34.9886],

  // Or Yehuda
  "Or Yehuda": [32.0306, 34.8544],
  "אור יהודה": [32.0306, 34.8544],

  // Yavne
  "Yavne": [31.8786, 34.7394],
  "יבנה": [31.8786, 34.7394],

  // Default/Remote
  "Israel": [31.5, 34.75],
  "Remote": [31.5, 34.75],
  "ישראל": [31.5, 34.75],
  "מרחוק": [31.5, 34.75],
};

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
      let coords: [number, number] | null = null;
      for (const [name, c] of Object.entries(CITY_COORDS)) {
        if (city.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(city.toLowerCase())) {
          coords = c;
          break;
        }
      }

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
      let coords: [number, number] = CITY_COORDS["Israel"];
      for (const [name, c] of Object.entries(CITY_COORDS)) {
        if (city.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(city.toLowerCase())) {
          coords = c;
          break;
        }
      }

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
