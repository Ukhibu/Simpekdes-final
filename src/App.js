import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardContent from './pages/DashboardContent';
import Perangkat from './pages/Perangkat';
import ManajemenAdmin from './pages/ManajemenAdmin';
import PengaturanAplikasi from './pages/PengaturanAplikasi';
import HubPage from './pages/HubPage';
import AppLayout from './components/layout/AppLayout';
import BPDPage from './pages/BPDPage';
import EFilePage from './pages/EFilePage';
import BPDDashboard from './pages/BPDDashboard';
import EFileDashboard from './pages/EFileDashboard';
import RekapitulasiAparatur from './pages/RekapitulasiAparatur';
import BeritaAcaraBPDPage from './pages/BeritaAcaraBPDPage';
import KeuanganDesa from './pages/KeuanganDesa';
import AsetDesa from './pages/AsetDesa';
// Impor halaman setelan BPD baru
import PengaturanBPD from './pages/PengaturanBPD';
import { BrandingProvider } from './context/BrandingContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend } from 'chart.js';
import Spinner from './components/common/Spinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend);

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <Spinner size="lg"/>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <BrandingProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PrivateRoute><HubPage /></PrivateRoute>} />
            
            <Route path="/app" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              <Route index element={<DashboardContent />} /> 
              <Route path="perangkat" element={<Perangkat />} />
              <Route path="rekapitulasi-aparatur" element={<RekapitulasiAparatur />} />
              <Route path="manajemen-admin" element={<ManajemenAdmin />} />
              <Route path="pengaturan" element={<PengaturanAplikasi />} />
              
              <Route path="bpd" element={<BPDDashboard />} />
              <Route path="bpd/data" element={<BPDPage />} />
              <Route path="bpd/berita-acara" element={<BeritaAcaraBPDPage />} />
              {/* Rute baru untuk Setelan BPD */}
              <Route path="bpd/pengaturan" element={<PengaturanBPD />} />

              <Route path="efile" element={<EFileDashboard />} />
              <Route path="efile/manage" element={<EFilePage />} />

              <Route path="keuangan" element={<KeuanganDesa />} />
              <Route path="aset" element={<AsetDesa />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrandingProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

