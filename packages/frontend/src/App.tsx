import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Topbar } from './components/Topbar/Topbar.js';
import { ManifestView } from './views/ManifestView/ManifestView.js';
import { HireDetailView } from './views/HireDetailView/HireDetailView.js';
import { NewHireForm } from './views/NewHireForm/NewHireForm.js';
import { EscalationsView } from './views/EscalationsView/EscalationsView.js';
import { RulesView } from './views/RulesView/RulesView.js';
import { useSocket } from './socket/useSocket.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:            1,
      staleTime:        10_000,
      refetchOnWindowFocus: true,
    },
  },
});

function AppInner() {
  // Initialize WebSocket connection globally — cache invalidation happens inside the hook
  useSocket();

  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/"              element={<ManifestView />} />
        <Route path="/hires/:id"     element={<HireDetailView />} />
        <Route path="/new"           element={<NewHireForm />} />
        <Route path="/escalations"   element={<EscalationsView />} />
        <Route path="/rules"         element={<RulesView />} />
        <Route path="*"              element={<ManifestView />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
