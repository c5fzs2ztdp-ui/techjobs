import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@/components/ErrorBoundary';
import AuthErrorToast from '@/components/AuthErrorToast';
import { Toaster } from 'sonner';

import Layout from '@/components/Layout';
import AccessibilityWidget from '@/components/AccessibilityWidget';
import Home from '@/pages/Home';
import Jobs from '@/pages/Jobs';

// Route-level code splitting: every page except the two landing routes
// (Home, Jobs) loads on demand, so first paint no longer downloads Leaflet
// and the other secondary-route code.
const Companies = lazy(() => import('@/pages/Companies'));
const CompanyProfile = lazy(() => import('@/pages/CompanyProfile'));
const SavedJobs = lazy(() => import('@/pages/SavedJobs'));
const Map = lazy(() => import('@/pages/Map'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const AccessibilityStatement = lazy(() => import('@/pages/AccessibilityStatement'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Per-route document titles (SEO + screen readers announce page changes).
const PAGE_TITLES: [RegExp, string][] = [
  [/^\/$/, 'TechJobsIL - Israeli Tech Jobs'],
  [/^\/jobs/, 'Jobs - TechJobsIL'],
  [/^\/companies/, 'Companies - TechJobsIL'],
  [/^\/company/, 'Company Profile - TechJobsIL'],
  [/^\/saved/, 'Saved Jobs - TechJobsIL'],
  [/^\/map/, 'Jobs Map - TechJobsIL'],
  [/^\/privacy/, 'Privacy Policy - TechJobsIL'],
  [/^\/terms/, 'Terms of Service - TechJobsIL'],
  [/^\/accessibility/, 'Accessibility Statement - TechJobsIL'],
];

function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = PAGE_TITLES.find(([re]) => re.test(pathname));
    document.title = match ? match[1] : 'Page Not Found - TechJobsIL';
  }, [pathname]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <PageTitle />
        <AuthErrorToast />
        <ErrorBoundary>
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-warm-500">Loading...</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <Layout currentPageName="Home">
                <Home />
              </Layout>
            }
          />
          <Route
            path="/jobs"
            element={
              <Layout currentPageName="Jobs">
                <Jobs />
              </Layout>
            }
          />
          <Route
            path="/companies"
            element={
              <Layout currentPageName="Companies">
                <Companies />
              </Layout>
            }
          />
          <Route
            path="/company"
            element={
              <Layout currentPageName="CompanyProfile">
                <CompanyProfile />
              </Layout>
            }
          />
          <Route
            path="/saved"
            element={
              <Layout currentPageName="SavedJobs">
                <SavedJobs />
              </Layout>
            }
          />
          <Route
            path="/map"
            element={
              <Layout currentPageName="Map">
                <Map />
              </Layout>
            }
          />
          <Route
            path="/privacy"
            element={
              <Layout currentPageName="PrivacyPolicy">
                <PrivacyPolicy />
              </Layout>
            }
          />
          <Route
            path="/terms"
            element={
              <Layout currentPageName="TermsOfService">
                <TermsOfService />
              </Layout>
            }
          />
          <Route
            path="/accessibility"
            element={
              <Layout currentPageName="AccessibilityStatement">
                <AccessibilityStatement />
              </Layout>
            }
          />
          <Route
            path="*"
            element={
              <Layout currentPageName="NotFound">
                <NotFound />
              </Layout>
            }
          />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        <AccessibilityWidget />
      </Router>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
