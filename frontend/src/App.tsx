import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
