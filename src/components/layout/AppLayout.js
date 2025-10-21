import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ProfileModal from '../profile/ProfileModal';
import { useAuth } from '../../context/AuthContext';

// Fungsi untuk mendapatkan konteks halaman berdasarkan URL
const getPageContext = (pathname) => {
    // Modul Organisasi Desa
    if (
        pathname.startsWith('/app/bpd') ||
        pathname.startsWith('/app/lpm') ||
        pathname.startsWith('/app/pkk') ||
        pathname.startsWith('/app/karang-taruna') ||
        pathname.startsWith('/app/rt-rw')) {

        switch (true) {
            // BPD
            case pathname.startsWith('/app/bpd/data'): return { module: 'organisasi', subModule: 'bpd', title: 'Manajemen Data BPD' };
            case pathname.startsWith('/app/bpd/berita-acara'): return { module: 'organisasi', subModule: 'bpd', title: 'Berita Acara BPD' };
            case pathname.startsWith('/app/bpd/pengaturan'): return { module: 'organisasi', subModule: 'bpd', title: 'Setelan Modul BPD' };
            case pathname.startsWith('/app/bpd'): return { module: 'organisasi', subModule: 'bpd', title: 'Dashboard BPD' };
            
            // LPM
            case pathname.startsWith('/app/lpm/data'): return { module: 'organisasi', subModule: 'lpm', title: 'Manajemen Data LPM' };
            case pathname.startsWith('/app/lpm/program'): return { module: 'organisasi', subModule: 'lpm', title: 'Program Kerja LPM' };
            case pathname.startsWith('/app/lpm'): return { module: 'organisasi', subModule: 'lpm', title: 'Dashboard LPM' };

            // PKK
            case pathname.startsWith('/app/pkk/data'): return { module: 'organisasi', subModule: 'pkk', title: 'Manajemen Pengurus PKK' };
            case pathname.startsWith('/app/pkk/program'): return { module: 'organisasi', subModule: 'pkk', title: 'Program Kerja PKK' };
            case pathname.startsWith('/app/pkk'): return { module: 'organisasi', subModule: 'pkk', title: 'Dashboard PKK' };
            
            // Karang Taruna
            case pathname.startsWith('/app/karang-taruna/data'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Manajemen Pengurus Karang Taruna' };
            case pathname.startsWith('/app/karang-taruna/kegiatan'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Kegiatan Karang Taruna' };
            case pathname.startsWith('/app/karang-taruna'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Dashboard Karang Taruna' };
            
            case pathname.startsWith('/app/rt-rw/rt'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Manajemen Data RT' };
            case pathname.startsWith('/app/rt-rw/rw'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Manajemen Data RW' };
            case pathname.startsWith('/app/rt-rw/rekapitulasi'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Rekapitulasi RT/RW' };
            case pathname.startsWith('/app/rt-rw'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Dashboard RT/RW' };
            
            default: return { module: 'organisasi', title: 'Organisasi Desa' };
        }
    }

    // Modul Keuangan
    if (pathname.startsWith('/app/keuangan')) {
        switch (pathname) {
            case '/app/keuangan': return { module: 'keuangan', title: 'Dashboard Keuangan Desa' };
            case '/app/keuangan/penganggaran': return { module: 'keuangan', title: 'Penganggaran (APBDes)' };
            case '/app/keuangan/penatausahaan': return { module: 'keuangan', title: 'Penatausahaan (Buku Kas Umum)' };
            case '/app/keuangan/laporan': return { module: 'keuangan', title: 'Laporan Realisasi Anggaran' };
            default: return { module: 'keuangan', title: 'Manajemen Keuangan Desa' };
        }
    }
    
    // Modul Aset
    if (pathname.startsWith('/app/aset')) {
        switch(pathname) {
            case '/app/aset': return { module: 'aset', title: 'Dashboard Aset Desa' };
            case '/app/aset/manajemen': return { module: 'aset', title: 'Manajemen Aset (KIB)' };
            case '/app/aset/peta': return { module: 'aset', title: 'Peta Aset Desa' };
            default: return { module: 'aset', title: 'Manajemen Aset Desa' };
        }
    }

    // Modul E-File / Arsip Digital
    if (pathname.startsWith('/app/efile') || pathname.startsWith('/app/manajemen-sk') || pathname.startsWith('/app/data-sk')) {
        const titleMap = {
            '/app/efile': 'Dashboard Arsip Digital',
            '/app/manajemen-sk': 'Manajemen Unggah SK',
            '/app/data-sk/perangkat': 'Data SK Perangkat Desa',
            '/app/data-sk/bpd': 'Data SK BPD',
            '/app/data-sk/lpm': 'Data SK LPM',
            '/app/data-sk/pkk': 'Data SK PKK',
            '/app/data-sk/karang_taruna': 'Data SK Karang Taruna',
            '/app/data-sk/rt_rw': 'Data SK RT/RW',
        };
        return { module: 'efile', title: titleMap[pathname] || 'Arsip Digital' };
    }
    
    // Modul Pemerintahan (Default)
    switch (pathname) {
        case '/app': return { module: 'perangkat', title: 'Dashboard' };
        case '/app/perangkat': return { module: 'perangkat', title: 'Manajemen Data Perangkat' };
        case '/app/histori-perangkat': return { module: 'perangkat', title: 'Riwayat Purna Tugas' };
        case '/app/rekapitulasi-aparatur': return { module: 'perangkat', title: 'Rekapitulasi Aparatur' };
        case '/app/laporan': return { module: 'perangkat', title: 'Pusat Laporan' };
        case '/app/manajemen-admin': return { module: 'perangkat', title: 'Manajemen Admin Desa' };
        case '/app/pengaturan': return { module: 'perangkat', title: 'Pengaturan Aplikasi' };
        case '/app/kalender-kegiatan': return { module: 'perangkat', title: 'Kalender Kegiatan' };
        default: return { module: 'perangkat', title: 'Dashboard' };
    }
};

const AppLayout = () => {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { module, subModule, title } = getPageContext(location.pathname);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const { currentUser } = useAuth();

    // Tutup sidebar saat navigasi di perangkat mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Pengecualian untuk halaman hub organisasi agar tidak menampilkan layout utama
    if (location.pathname === '/app/organisasi-desa') {
        return <Outlet />;
    }

    return (
        <div className="flex bg-gray-100 dark:bg-gray-900 min-h-screen">
            <Sidebar 
                currentModule={module} 
                activeSubModule={subModule} 
                isOpen={isSidebarOpen} 
                setIsOpen={setIsSidebarOpen}
                onProfileClick={() => setIsProfileModalOpen(true)}
            />
            
            <div className="flex-1 flex flex-col md:ml-20 lg:ml-64 transition-all duration-300 ease-in-out">
                <Header 
                    pageTitle={title} 
                    onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    onProfileClick={() => setIsProfileModalOpen(true)}
                />
                
                <main className="flex-grow p-4 md:p-8">
                    <Outlet />
                </main>
            </div>

            {/* Modal profil sekarang dipanggil di sini */}
            {currentUser && (
                <ProfileModal
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                />
            )}
        </div>
    );
};

export default AppLayout;

