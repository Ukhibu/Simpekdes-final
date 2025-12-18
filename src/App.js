import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend } from 'chart.js';

import NotificationContainer from './components/common/NotificationContainer';
import LoadingScreen from './components/common/LoadingScreen';

// Layout (Lazy Load agar login lebih cepat)
const AppLayout = React.lazy(() => import('./components/layout/AppLayout'));

// Halaman Utama & Otentikasi (Lazy Load)
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const HubPage = React.lazy(() => import('./pages/HubPage'));

// Halaman Modul Inti (Lazy Load)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const Perangkat = React.lazy(() => import('./pages/Perangkat'));
const HistoriPerangkat = React.lazy(() => import('./pages/HistoriPerangkat'));
const RekapitulasiAparatur = React.lazy(() => import('./pages/RekapitulasiAparatur'));
const LaporanPage = React.lazy(() => import('./pages/LaporanPage'));
const ManajemenAdmin = React.lazy(() => import('./pages/ManajemenAdmin'));
const PengaturanAplikasi = React.lazy(() => import('./pages/PengaturanAplikasi'));
const KalenderKegiatanPage = React.lazy(() => import('./pages/KalenderKegiatanPage'));

// Halaman Modul E-File (Lazy Load)
const EFileDashboard = React.lazy(() => import('./pages/EFileDashboard'));
const ManajemenSK = React.lazy(() => import('./pages/ManajemenSK'));
const DataSK = React.lazy(() => import('./pages/DataSK'));

// Modul Keuangan (Lazy Load)
const KeuanganDashboard = React.lazy(() => import('./pages/KeuanganDashboard'));
const PenganggaranPage = React.lazy(() => import('./pages/PenganggaranPage'));
const PenatausahaanPage = React.lazy(() => import('./pages/PenatausahaanPage'));
const LaporanRealisasiPage = React.lazy(() => import('./pages/LaporanRealisasiPage'));

// Modul Aset (Lazy Load)
const AsetDashboard = React.lazy(() => import('./pages/AsetDashboard'));
const AsetDesa = React.lazy(() => import('./pages/AsetDesa'));
const PetaAsetPage = React.lazy(() => import('./pages/PetaAsetPage'));

// Halaman Modul Organisasi Desa (Lazy Load)
const OrganisasiDesaHub = React.lazy(() => import('./pages/OrganisasiDesaHub'));
const BPDDashboard = React.lazy(() => import('./pages/BPDDashboard'));
const BPDPage = React.lazy(() => import('./pages/BPDPage'));
const BeritaAcaraBPDPage = React.lazy(() => import('./pages/BeritaAcaraBPDPage'));
const PengaturanBPD = React.lazy(() => import('./pages/PengaturanBPD'));
const LPMDashboard = React.lazy(() => import('./pages/LPMDashboard'));
const LPMPage = React.lazy(() => import('./pages/LPMPage'));
const LPMProgramPage = React.lazy(() => import('./pages/LPMProgramPage'));
const PKKDashboard = React.lazy(() => import('./pages/PKKDashboard'));
const PKKPage = React.lazy(() => import('./pages/PKKPage'));
const PKKProgramPage = React.lazy(() => import('./pages/PKKProgramPage'));
const KarangTarunaDashboard = React.lazy(() => import('./pages/KarangTarunaDashboard'));
const KarangTarunaPage = React.lazy(() => import('./pages/KarangTarunaPage'));
const KarangTarunaKegiatanPage = React.lazy(() => import('./pages/KarangTarunaKegiatanPage'));
const RtRwDashboard = React.lazy(() => import('./pages/RtRwDashboard'));
const RtPage = React.lazy(() => import('./pages/RtPage'));
const RwPage = React.lazy(() => import('./pages/RwPage'));
const RekapitulasiRtRwPage = React.lazy(() => import('./pages/RekapitulasiRtRwPage'));

// Registrasi semua komponen Chart.js yang dibutuhkan di seluruh aplikasi
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, 
  ArcElement, RadialLinearScale, Title, Tooltip, Legend
);

// Komponen PrivateRoute untuk melindungi rute yang memerlukan otentikasi
function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    // Saat auth loading (misal refresh halaman di url dalam),
    // KITA TETAP TAMPILKAN LoadingScreen agar tidak white screen
    return <LoadingScreen />;
  }
  
  return currentUser ? children : <Navigate to="/login" replace />;
}

function App() {
  // State untuk mengontrol tampilan splash screen
  const [isSplashscreen, setIsSplashscreen] = useState(true);

  useEffect(() => {
    // Atur timer untuk menyembunyikan splash screen setelah 5 detik
    const timer = setTimeout(() => {
      setIsSplashscreen(false);
    }, 5000); 

    // Bersihkan timer jika komponen unmount
    return () => clearTimeout(timer);
  }, []); 

  return (
    <Router>
      <AuthProvider>
        <BrandingProvider>
          <NotificationProvider>
            {/* NotificationContainer agar notifikasi bisa muncul di mana saja */}
            <NotificationContainer />
            
            {isSplashscreen ? (
              // 1. Jika true (5 detik pertama), tampilkan LoadingScreen
              <LoadingScreen />
            ) : (
              // 2. Jika false, tampilkan routing aplikasi dengan Suspense
              // Suspense akan menampilkan LoadingScreen saat modul sedang di-download (lazy loaded)
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* Rute terproteksi */}
                  {/* Hub Page sebagai halaman awal setelah login */}
                  <Route path="/" element={<PrivateRoute><HubPage /></PrivateRoute>} />
                  
                  {/* Rute khusus Organisasi Desa Hub */}
                  <Route path="/app/organisasi-desa" element={<PrivateRoute><OrganisasiDesaHub /></PrivateRoute>} />

                  {/* Dashboard Layout Utama */}
                  <Route path="/app" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                    <Route index element={<DashboardPage />} />
                    
                    {/* Modul Pemerintahan */}
                    <Route path="perangkat" element={<Perangkat />} />
                    <Route path="histori-perangkat" element={<HistoriPerangkat />} />
                    <Route path="rekapitulasi-aparatur" element={<RekapitulasiAparatur />} />
                    <Route path="kalender-kegiatan" element={<KalenderKegiatanPage />} />
                    <Route path="laporan" element={<LaporanPage />} />
                    <Route path="manajemen-admin" element={<ManajemenAdmin />} />
                    <Route path="pengaturan" element={<PengaturanAplikasi />} />
                    
                    {/* Rute Organisasi Desa (Sub-modul) */}
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
                  
                  {/* Fallback route - Redirect ke root (yang akan dicek auth-nya) */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            )}
            
          </NotificationProvider>
        </BrandingProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;