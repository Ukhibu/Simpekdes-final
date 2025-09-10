import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

// Fungsi ini menentukan judul halaman dan modul mana yang aktif
const getPageContext = (pathname) => {
    // Modul Keuangan
    if (pathname.startsWith('/app/keuangan')) {
        return { module: 'keuangan', title: 'Manajemen Keuangan Desa' };
    }
    // Modul Aset
    if (pathname.startsWith('/app/aset')) {
        return { module: 'aset', title: 'Manajemen Aset Desa' };
    }
    // Modul BPD
    if (pathname.startsWith('/app/bpd')) {
        if (pathname === '/app/bpd') return { module: 'bpd', title: 'Dashboard BPD' };
        if (pathname.startsWith('/app/bpd/data')) return { module: 'bpd', title: 'Manajemen Data BPD' };
        if (pathname.startsWith('/app/bpd/berita-acara')) return { module: 'bpd', title: 'Berita Acara BPD' };
        // Konteks baru untuk Setelan BPD
        if (pathname.startsWith('/app/bpd/pengaturan')) return { module: 'bpd', title: 'Setelan Modul BPD' };
        return { module: 'bpd', title: 'Manajemen BPD' };
    }
    // Modul E-File
    if (pathname.startsWith('/app/efile')) {
        if (pathname === '/app/efile') return { module: 'efile', title: 'Dashboard E-File' };
        if (pathname.startsWith('/app/efile/manage')) return { module: 'efile', title: 'Manajemen SK' };
        return { module: 'efile', title: 'E-File' };
    }
    
    // Modul default: Perangkat Desa
    switch (pathname) {
        case '/app':
            return { module: 'perangkat', title: 'Dashboard' };
        case '/app/perangkat':
            return { module: 'perangkat', title: 'Manajemen Data Perangkat' };
        case '/app/rekapitulasi-aparatur':
            return { module: 'perangkat', title: 'Rekapitulasi Aparatur' };
        case '/app/manajemen-admin':
            return { module: 'perangkat', title: 'Manajemen Admin Desa' };
        case '/app/pengaturan':
            return { module: 'perangkat', title: 'Pengaturan Aplikasi' };
        default:
            return { module: 'perangkat', title: 'Dashboard' };
    }
};

const AppLayout = () => {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { module, title } = getPageContext(location.pathname);

    useEffect(() => {
        // Menutup sidebar saat navigasi di perangkat mobile
        setIsSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div className="flex bg-gray-100 dark:bg-gray-900 min-h-screen">
            <Sidebar currentModule={module} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
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

