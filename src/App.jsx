import React, { Suspense } from 'react';
import { Activity } from 'lucide-react';

// --- DYNAMIC IMPORT ---
// This tells the bundler to split SupplyChainDashboard into a separate chunk.
// It will only be loaded when the App component renders.
const SupplyChainDashboard = React.lazy(() => import('./SupplyChainDashboard'));

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Suspense shows a fallback loading state while the heavy code downloads */}
      <Suspense fallback={<LoadingScreen />}>
        <SupplyChainDashboard />
      </Suspense>
    </div>
  );
}

// A pretty loading screen to show while the dashboard chunk is loading
const LoadingScreen = () => (
  <div className="flex h-screen w-full items-center justify-center flex-col gap-4 bg-slate-50">
    <div className="relative">
      {/* Background Ring */}
      <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
      {/* Spinning Ring */}
      <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
    </div>
    <div className="text-indigo-900 font-medium animate-pulse flex items-center gap-2">
      <Activity className="w-5 h-5 text-indigo-600" />
      <span>Initializing Analytics Engine...</span>
    </div>
    <p className="text-xs text-slate-400">Optimizing visualizations</p>
  </div>
);

export default App;
