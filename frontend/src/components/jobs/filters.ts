export interface Filters {
  search: string;
  jobCategories: string[];
  workModels: string[];
  employmentTypes: string[];
  seniorities: string[];
  cities: string[];
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  jobCategories: [],
  workModels: [],
  employmentTypes: [],
  seniorities: [],
  cities: []
};
