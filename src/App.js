import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext'; // [FIX] Impor Provider
import NotificationContainer from './components/common/NotificationContainer';
import { BrandingProvider } from './context/BrandingContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend } from 'chart.js';

// Impor LoadingScreen untuk fallback Suspense
import LoadingScreen from './components/common/LoadingScreen';

// Halaman Utama & Otentikasi
// [FIX] Mengganti from(...) menjadi import(...)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HubPage = lazy(() => import('./pages/HubPage'));

// Halaman Modul Inti
const AppLayout = lazy(() => import('./components/layout/AppLayout'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const Perangkat = lazy(() => import('./pages/Perangkat'));
const HistoriPerangkat = lazy(() => import('./pages/HistoriPerangkat'));
const RekapitulasiAparatur = lazy(() => import('./pages/RekapitulasiAparatur'));
const LaporanPage = lazy(() => import('./pages/LaporanPage'));
const ManajemenAdmin = lazy(() => import('./pages/ManajemenAdmin'));
const PengaturanAplikasi = lazy(() => import('./pages/PengaturanAplikasi'));
const KalenderKegiatanPage = lazy(() => import('./pages/KalenderKegiatanPage'));

// Halaman Modul E-File
const EFileDashboard = lazy(() => import('./pages/EFileDashboard'));
const ManajemenSK = lazy(() => import('./pages/ManajemenSK'));
const DataSK = lazy(() => import('./pages/DataSK'));

// Modul Keuangan
const KeuanganDashboard = lazy(() => import('./pages/KeuanganDashboard'));
const PenganggaranPage = lazy(() => import('./pages/PenganggaranPage'));
const PenatausahaanPage = lazy(() => import('./pages/PenatausahaanPage'));
const LaporanRealisasiPage = lazy(() => import('./pages/LaporanRealisasiPage'));

// Modul Aset
const AsetDashboard = lazy(() => import('./pages/AsetDashboard'));
const AsetDesa = lazy(() => import('./pages/AsetDesa'));
const PetaAsetPage = lazy(() => import('./pages/PetaAsetPage'));

// Halaman Modul Organisasi Desa
const OrganisasiDesaHub = lazy(() => import('./pages/OrganisasiDesaHub'));
const BPDDashboard = lazy(() => import('./pages/BPDDashboard'));
const BPDPage = lazy(() => import('./pages/BPDPage'));
const BeritaAcaraBPDPage = lazy(() => import('./pages/BeritaAcaraBPDPage'));
const PengaturanBPD = lazy(() => import('./pages/PengaturanBPD'));
const LPMDashboard = lazy(() => import('./pages/LPMDashboard'));
const LPMPage = lazy(() => import('./pages/LPMPage'));
const LPMProgramPage = lazy(() => import('./pages/LPMProgramPage'));
const PKKDashboard = lazy(() => import('./pages/PKKDashboard'));
const PKKPage = lazy(() => import('./pages/PKKPage'));
const PKKProgramPage = lazy(() => import('./pages/PKKProgramPage'));
const KarangTarunaDashboard = lazy(() => import('./pages/KarangTarunaDashboard'));
const KarangTarunaPage = lazy(() => import('./pages/KarangTarunaPage'));
const KarangTarunaKegiatanPage = lazy(() => import('./pages/KarangTarunaKegiatanPage'));
const RtRwDashboard = lazy(() => import('./pages/RtRwDashboard'));
const RtPage = lazy(() => import('./pages/RtPage'));
const RwPage = lazy(() => import('./pages/RwPage'));
const RekapitulasiRtRwPage = lazy(() => import('./pages/RekapitulasiRtRwPage'));

// Registrasi semua komponen Chart.js yang dibutuhkan di seluruh aplikasi
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, 
  ArcElement, RadialLinearScale, Title, Tooltip, Legend
);
// [FIX] Menghapus registrasi ganda

// Komponen PrivateRoute untuk melindungi rute yang memerlukan otentikasi
function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return currentUser ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    // [FIX] Struktur Provider diperbaiki
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <BrandingProvider>
            <NotificationContainer />
            {/* [FIX] Menambahkan <Suspense> sebagai wrapper <Routes> */}
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                
                {/* Rute terproteksi */}
                <Route path="/" element={<PrivateRoute><HubPage /></PrivateRoute>} />
                <Route path="/app/organisasi-desa" element={<PrivateRoute><OrganisasiDesaHub /></PrivateRoute>} />

                <Route path="/app" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                  {/* Rute default di dalam layout */}
                  <Route index element={<DashboardPage />} />
                  
                  {/* Modul Pemerintahan */}
                  <Route path="perangkat" element={<Perangkat />} />
                  <Route path="histori-perangkat" element={<HistoriPerangkat />} />
                  <Route path="rekapitulasi-aparatur" element={<RekapitulasiAparatur />} />
                  <Route path="kalender-kegiatan" element={<KalenderKegiatanPage />} />
                  <Route path="laporan" element={<LaporanPage />} />
                  <Route path="manajemen-admin" element={<ManajemenAdmin />} />
                  <Route path="pengaturan" element={<PengaturanAplikasi />} />
                  
                  {/* Rute Organisasi Desa */}
                  <Route path="bpd" element={<BPDDashboard />} />
                  <Route path="bpd/data" element={<BPDPage />} />
                  <Route path="bpd/berita-acara" element={<BeritaAcaraBPDPage />} />
                  <Route path="bpd/pengaturan" element={<PengaturanBPD />} />
                  <Route path="lpm" element={<LPMDashboard />} />
                  <Route path="lpm/data" element={<LPMPage />} />
                  <Route path="lpm/program" element={<LPMProgramPage />} />
                  <Route path="pkk" element={<PKKDashboard />} />
                  <Route path="pkk/data" element={<PKKPage />} />
                  <Route path="pkk/program" element={<PKKProgramPage />} />
                  <Route path="karang-taruna" element={<KarangTarunaDashboard />} />
                  <Route path="karang-taruna/data" element={<KarangTarunaPage />} />
                  <Route path="karang-taruna/kegiatan" element={<KarangTarunaKegiatanPage />} />
                  <Route path="rt-rw" element={<RtRwDashboard />} />
                  <Route path="rt-rw/rt" element={<RtPage />} />
                  <Route path="rt-rw/rw" element={<RwPage />} />
                  <Route path="rt-rw/rekapitulasi" element={<RekapitulasiRtRwPage />} />
                  
                  {/* Modul E-File */}
                  <Route path="efile" element={<EFileDashboard />} />
                  <Route path="manajemen-sk" element={<ManajemenSK />} />
                  <Route path="data-sk/:skType" element={<DataSK />} />

                  {/* Modul Keuangan */}
                  <Route path="keuangan" element={<KeuanganDashboard />} />
                  <Route path="keuangan/penganggaran" element={<PenganggaranPage />} />
                  <Route path="keuangan/penatausahaan" element={<PenatausahaanPage />} />
                  <Route path="keuangan/laporan" element={<LaporanRealisasiPage />} />
                  
                  {/* Modul Aset */}
                  <Route path="aset" element={<AsetDashboard />} />
                  <Route path="aset/manajemen" element={<AsetDesa />} />
                  <Route path="aset/peta" element={<PetaAsetPage />} />
                </Route>
                
                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrandingProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

