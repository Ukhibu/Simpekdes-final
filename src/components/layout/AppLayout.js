import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

// Fungsi ini menentukan judul halaman dan modul mana yang aktif
const getPageContext = (pathname) => {
    // Modul Organisasi Desa (termasuk semua sub-modulnya)
    if (
        pathname.startsWith('/app/bpd') || 
        pathname.startsWith('/app/lpm') || 
        pathname.startsWith('/app/pkk') || 
        pathname.startsWith('/app/karang-taruna') || 
        pathname.startsWith('/app/rt-rw')) {
        
        switch (true) {
            // Rute BPD
            case pathname.startsWith('/app/bpd/data'): return { module: 'organisasi', subModule: 'bpd', title: 'Manajemen Data BPD' };
            case pathname.startsWith('/app/bpd/berita-acara'): return { module: 'organisasi', subModule: 'bpd', title: 'Berita Acara BPD' };
            case pathname.startsWith('/app/bpd/pengaturan'): return { module: 'organisasi', subModule: 'bpd', title: 'Setelan Modul BPD' };
            case pathname.startsWith('/app/bpd'): return { module: 'organisasi', subModule: 'bpd', title: 'Dashboard BPD' };
            
            // Rute LPM
            case pathname.startsWith('/app/lpm/data'): return { module: 'organisasi', subModule: 'lpm', title: 'Manajemen Data LPM' };
            case pathname.startsWith('/app/lpm'): return { module: 'organisasi', subModule: 'lpm', title: 'Dashboard LPM' };

            // Rute PKK
            case pathname.startsWith('/app/pkk/data'): return { module: 'organisasi', subModule: 'pkk', title: 'Manajemen Pengurus PKK' };
            case pathname.startsWith('/app/pkk/program'): return { module: 'organisasi', subModule: 'pkk', title: 'Program Kerja PKK' };
            case pathname.startsWith('/app/pkk'): return { module: 'organisasi', subModule: 'pkk', title: 'Dashboard PKK' };
            
            // Rute Karang Taruna
            case pathname.startsWith('/app/karang-taruna/data'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Manajemen Pengurus Karang Taruna' };
            case pathname.startsWith('/app/karang-taruna/kegiatan'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Kegiatan Karang Taruna' };
            case pathname.startsWith('/app/karang-taruna'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Dashboard Karang Taruna' };
            
            // Rute RT/RW
            case pathname.startsWith('/app/rt-rw/data'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Manajemen Data RT/RW' };
            case pathname.startsWith('/app/rt-rw'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Dashboard RT/RW' };
            
            default: return { module: 'organisasi', title: 'Organisasi Desa' };
        }
    }
    
    // Logika untuk modul lain tetap sama
    if (pathname.startsWith('/app/keuangan')) return { module: 'keuangan', title: 'Manajemen Keuangan Desa' };
    if (pathname.startsWith('/app/aset')) return { module: 'aset', title: 'Manajemen Aset Desa' };
    if (pathname.startsWith('/app/efile')) {
        if (pathname === '/app/efile') return { module: 'efile', title: 'Dashboard E-File' };
        return { module: 'efile', title: 'Manajemen SK' };
    }
    
    switch (pathname) {
        case '/app': return { module: 'perangkat', title: 'Dashboard' };
        case '/app/perangkat': return { module: 'perangkat', title: 'Manajemen Data Perangkat' };
        case '/app/rekapitulasi-aparatur': return { module: 'perangkat', title: 'Rekapitulasi Aparatur' };
        case '/app/laporan': return { module: 'perangkat', title: 'Pusat Laporan' };
        case '/app/manajemen-admin': return { module: 'perangkat', title: 'Manajemen Admin Desa' };
        case '/app/pengaturan': return { module: 'perangkat', title: 'Pengaturan Aplikasi' };
        default: return { module: 'perangkat', title: 'Dashboard' };
    }
};

const AppLayout = () => {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { module, subModule, title } = getPageContext(location.pathname);

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Jangan render AppLayout untuk halaman Hub Organisasi Desa
    if (location.pathname === '/app/organisasi-desa') {
        return <Outlet />;
    }

    return (
        <div className="flex bg-gray-100 dark:bg-gray-900 min-h-screen">
            <Sidebar currentModule={module} activeSubModule={subModule} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <main className="flex-1 md:ml-64 transition-all duration-300 ease-in-out">
                <Header pageTitle={title} onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
                <div className="p-4 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AppLayout;

