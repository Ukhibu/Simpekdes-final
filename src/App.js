import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend } from 'chart.js';

import AppLayout from './components/layout/AppLayout';
import NotificationContainer from './components/common/NotificationContainer';
import LoadingScreen from './components/common/LoadingScreen';

// Halaman Utama & Otentikasi
import LoginPage from './pages/LoginPage';
import HubPage from './pages/HubPage';

// Halaman Modul Inti
import DashboardPage from './pages/DashboardPage';
import Perangkat from './pages/Perangkat';
import HistoriPerangkat from './pages/HistoriPerangkat';
import RekapitulasiAparatur from './pages/RekapitulasiAparatur';
import LaporanPage from './pages/LaporanPage';
import ManajemenAdmin from './pages/ManajemenAdmin';
import PengaturanAplikasi from './pages/PengaturanAplikasi';
import KalenderKegiatanPage from './pages/KalenderKegiatanPage';

// Halaman Modul E-File
import EFileDashboard from './pages/EFileDashboard';
import ManajemenSK from './pages/ManajemenSK';
import DataSK from './pages/DataSK';

// Modul Keuangan
import KeuanganDashboard from './pages/KeuanganDashboard';
import PenganggaranPage from './pages/PenganggaranPage';
import PenatausahaanPage from './pages/PenatausahaanPage';
import LaporanRealisasiPage from './pages/LaporanRealisasiPage';

// Modul Aset
import AsetDashboard from './pages/AsetDashboard';
import AsetDesa from './pages/AsetDesa';
import PetaAsetPage from './pages/PetaAsetPage';

// Halaman Modul Organisasi Desa
import OrganisasiDesaHub from './pages/OrganisasiDesaHub';
import BPDDashboard from './pages/BPDDashboard';
import BPDPage from './pages/BPDPage';
import BeritaAcaraBPDPage from './pages/BeritaAcaraBPDPage';
import PengaturanBPD from './pages/PengaturanBPD';
import LPMDashboard from './pages/LPMDashboard';
import LPMPage from './pages/LPMPage';
import LPMProgramPage from './pages/LPMProgramPage';
import PKKDashboard from './pages/PKKDashboard';
import PKKPage from './pages/PKKPage';
import PKKProgramPage from './pages/PKKProgramPage';
import KarangTarunaDashboard from './pages/KarangTarunaDashboard';
import KarangTarunaPage from './pages/KarangTarunaPage';
import KarangTarunaKegiatanPage from './pages/KarangTarunaKegiatanPage';
import RtRwDashboard from './pages/RtRwDashboard';
import RtPage from './pages/RtPage';
import RwPage from './pages/RwPage';
import RekapitulasiRtRwPage from './pages/RekapitulasiRtRwPage';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend);

// Registrasi semua komponen Chart.js yang dibutuhkan di seluruh aplikasi
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, 
  ArcElement, RadialLinearScale, Title, Tooltip, Legend
);

// Komponen PrivateRoute untuk melindungi rute yang memerlukan otentikasi
function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    // Saat auth loading, KITA TETAP TAMPILKAN LoadingScreen
    // Ini penting agar transisi dari splash screen ke app mulus
    return <LoadingScreen />;
  }
  
  return currentUser ? children : <Navigate to="/login" replace />;
}

function App() {
  // [LOGIKA BARU]
  // State untuk mengontrol tampilan splash screen
  const [isSplashscreen, setIsSplashscreen] = useState(true);

  useEffect(() => {
    // Atur timer untuk menyembunyikan splash screen setelah 5 detik
    const timer = setTimeout(() => {
      setIsSplashscreen(false);
    }, 5000); // [DIUBAH] Durasi diubah dari 3 detik menjadi 5 detik

    // Bersihkan timer jika komponen unmount
    return () => clearTimeout(timer);
  }, []); // [] berarti efek ini hanya berjalan sekali saat aplikasi pertama kali dimuat

  return (
    <>
      <Router>
        <AuthProvider>
          <BrandingProvider>
            {/* NotificationContainer dipindah ke sini agar selalu ada */}
            <NotificationContainer /> 
            
            {/* [LOGIKA BARU] */}
            {isSplashscreen ? (
              // 1. Jika true, tampilkan HANYA LoadingScreen
              // BrandingProvider di atas memastikan LoadingScreen dapat mengambil nama aplikasi
              <LoadingScreen />
            ) : (
              // 2. Jika false, tampilkan seluruh aplikasi seperti biasa
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
            )}
            
          </BrandingProvider>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;

