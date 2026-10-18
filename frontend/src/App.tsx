import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@/components/ErrorBoundary';
import AuthErrorToast from '@/components/AuthErrorToast';
import { Toaster } from 'sonner';

import Layout from '@/components/Layout';
import AccessibilityWidget from '@/components/AccessibilityWidget';
import Home from '@/pages/Home';
import Jobs from '@/pages/Jobs';
import Companies from '@/pages/Companies';
import CompanyProfile from '@/pages/CompanyProfile';
import SavedJobs from '@/pages/SavedJobs';
import Map from '@/pages/Map';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import AccessibilityStatement from '@/pages/AccessibilityStatement';

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
        </Routes>
        </ErrorBoundary>
        <AccessibilityWidget />
      </Router>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;
