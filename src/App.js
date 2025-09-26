import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend } from 'chart.js';

import AppLayout from './components/layout/AppLayout';
import Spinner from './components/common/Spinner';
import NotificationContainer from './components/common/NotificationContainer';

// Halaman Utama & Otentikasi
import LoginPage from './pages/LoginPage';
import HubPage from './pages/HubPage';

// Halaman Modul Inti
import DashboardPage from './pages/DashboardPage';
import Perangkat from './pages/Perangkat';
import RekapitulasiAparatur from './pages/RekapitulasiAparatur';
import LaporanPage from './pages/LaporanPage';
import ManajemenAdmin from './pages/ManajemenAdmin';
import PengaturanAplikasi from './pages/PengaturanAplikasi';
import EFileDashboard from './pages/EFileDashboard';
import EFilePage from './pages/EFilePage';
import KeuanganDesa from './pages/KeuanganDesa';
import AsetDesa from './pages/AsetDesa';
import KalenderKegiatanPage from './pages/KalenderKegiatanPage'; // <-- Impor baru

// Halaman Modul Organisasi Desa
import OrganisasiDesaHub from './pages/OrganisasiDesaHub';
import BPDDashboard from './pages/BPDDashboard';
import BPDPage from './pages/BPDPage';
import BeritaAcaraBPDPage from './pages/BeritaAcaraBPDPage';
import PengaturanBPD from './pages/PengaturanBPD';
import LPMDashboard from './pages/LPMDashboard';
import LPMPage from './pages/LPMPage';
import PKKDashboard from './pages/PKKDashboard';
import PKKPage from './pages/PKKPage';
import PKKProgramPage from './pages/PKKProgramPage';
import KarangTarunaDashboard from './pages/KarangTarunaDashboard';
import KarangTarunaPage from './pages/KarangTarunaPage';
import KarangTarunaKegiatanPage from './pages/KarangTarunaKegiatanPage';
import RtRwDashboard from './pages/RtRwDashboard';
import RtRwPage from './pages/RtRwPage';

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
    <>
      <NotificationContainer />
      <Router>
        <AuthProvider>
          <BrandingProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<PrivateRoute><HubPage /></PrivateRoute>} />
              
              <Route path="/app/organisasi-desa" element={<PrivateRoute><OrganisasiDesaHub /></PrivateRoute>} />

              <Route path="/app" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                <Route index element={<DashboardPage />} /> 
                <Route path="perangkat" element={<Perangkat />} />
                <Route path="rekapitulasi-aparatur" element={<RekapitulasiAparatur />} />
                <Route path="kalender-kegiatan" element={<KalenderKegiatanPage />} /> {/* <-- Rute baru */}
                <Route path="manajemen-admin" element={<ManajemenAdmin />} />
                <Route path="pengaturan" element={<PengaturanAplikasi />} />
                <Route path="laporan" element={<LaporanPage />} />
                
                <Route path="bpd" element={<BPDDashboard />} />
                <Route path="bpd/data" element={<BPDPage />} />
                <Route path="bpd/berita-acara" element={<BeritaAcaraBPDPage />} />
                <Route path="bpd/pengaturan" element={<PengaturanBPD />} />

                <Route path="lpm" element={<LPMDashboard />} />
                <Route path="lpm/data" element={<LPMPage />} />

                <Route path="pkk" element={<PKKDashboard />} />
                <Route path="pkk/data" element={<PKKPage />} />
                <Route path="pkk/program" element={<PKKProgramPage />} />

                <Route path="karang-taruna" element={<KarangTarunaDashboard />} />
                <Route path="karang-taruna/data" element={<KarangTarunaPage />} />
                <Route path="karang-taruna/kegiatan" element={<KarangTarunaKegiatanPage />} />
                
                <Route path="rt-rw" element={<RtRwDashboard />} />
                <Route path="rt-rw/data" element={<RtRwPage />} />

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
    </>
  );
}

export default App;

