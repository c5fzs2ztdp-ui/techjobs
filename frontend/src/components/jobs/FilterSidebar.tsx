import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMobileDialogAccessibility } from "@/hooks/useDialogAccessibility";
import { EMPTY_FILTERS, type Filters } from "./filters";
import { REGION_LABELS, CATEGORY_LABELS } from "./jobsData";
import AlertSubscribe from "./AlertSubscribe";

// Derived from the taxonomy (insertion order) so a new converter category
// appears here automatically instead of silently missing from the filters.
const jobCategories = Object.keys(CATEGORY_LABELS);

const workModels = ["remote", "hybrid", "on-site"];

const employmentTypes = ["full-time", "part-time", "student", "intern", "temp", "contract"];

const seniorities = ["intern", "junior", "senior", "staff", "principal", "lead", "manager"];

const regions = Object.keys(REGION_LABELS);

interface FilterSidebarProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  cities: string[];
  cityLabels?: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

export default function FilterSidebar({
  filters,
  setFilters,
  cities,
  cityLabels = {},
  isOpen,
  onClose,
  isMobile
}: FilterSidebarProps) {
  const { dialogRef: panelRef } = useMobileDialogAccessibility({
    isOpen,
    isMobile,
    onClose,
  });

  const toggleListFilter = (key: keyof Omit<Filters, 'search' | 'showClosed'>, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value]
    }));
  };

  const resetFilters = () => setFilters({ ...EMPTY_FILTERS });

  const activeFiltersCount =
    filters.jobCategories.length +
    filters.workModels.length +
    filters.employmentTypes.length +
    filters.seniorities.length +
    filters.cities.length +
    filters.regions.length +
    (filters.showClosed ? 1 : 0);

  const renderCheckboxList = (
    legend: string,
    values: string[],
    selected: string[],
    key: keyof Omit<Filters, 'search' | 'showClosed'>,
    maxHeight = false,
    labelFor: (v: string) => string = v => v.replace(/-/g, ' ')
  ) => (
    <fieldset>
      <legend className="font-medium text-sm text-warm-900 mb-3">{legend}</legend>
      <div className={`space-y-2 ${maxHeight ? 'max-h-48 overflow-y-auto' : ''}`} role="group">
        {values.map(value => (
          <div key={value} className="flex items-center space-x-2">
            <Checkbox
              id={`${key}-${value}`}
              checked={selected.includes(value)}
              onCheckedChange={() => toggleListFilter(key, value)}
            />
            <Label htmlFor={`${key}-${value}`} className="text-sm text-warm-600 capitalize cursor-pointer">
              {labelFor(value)}
            </Label>
          </div>
        ))}
      </div>
    </fieldset>
  );

  const sidebarContent = (
    <aside className="h-full flex flex-col bg-white" aria-label="Job filters">
      <div className="p-4 border-b border-warm-200 flex items-center justify-between">
        <h2 className="font-semibold text-warm-900" id="filter-heading">Filters</h2>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-warm-500 hover:text-warm-700"
              aria-label={`Reset all filters (${activeFiltersCount} active)`}
            >
              <RotateCcw className="w-4 h-4 mr-1" aria-hidden="true" />
              Reset
            </Button>
          )}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close filter panel"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6" aria-labelledby="filter-heading">
          {renderCheckboxList("Job Category", jobCategories, filters.jobCategories, 'jobCategories', true, v => CATEGORY_LABELS[v] || v)}
          {renderCheckboxList("Region", regions, filters.regions, 'regions', false, v => REGION_LABELS[v] || v)}
          {renderCheckboxList("Work Model", workModels, filters.workModels, 'workModels')}
          {renderCheckboxList("Employment Type", employmentTypes, filters.employmentTypes, 'employmentTypes')}
          {renderCheckboxList("Seniority", seniorities, filters.seniorities, 'seniorities')}
          {cities.length > 0 && renderCheckboxList("City", cities, filters.cities, 'cities', true, v => cityLabels[v] || v)}
          <fieldset>
            <legend className="font-medium text-sm text-warm-900 mb-3">Closed Jobs</legend>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-closed"
                checked={filters.showClosed}
                onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showClosed: checked === true }))}
              />
              <Label htmlFor="show-closed" className="text-sm text-warm-600 cursor-pointer">
                Show jobs that are no longer listed
              </Label>
            </div>
          </fieldset>
        </div>
      </ScrollArea>
      <AlertSubscribe />
    </aside>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={onClose}
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              tabIndex={-1}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-80 z-50 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Job filters"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <div className="hidden lg:block w-72 border-r border-warm-200 h-full bg-white">
      {sidebarContent}
    </div>
  );
}
