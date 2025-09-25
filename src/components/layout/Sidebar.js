import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { 
    FiGrid, FiUsers, FiFileText, FiUserPlus, FiSettings, 
    FiBarChart2, FiArrowLeft, FiBriefcase, FiBookOpen, 
    FiDollarSign, FiArchive, FiShare2, FiAward, FiHome, FiHeart, FiActivity
} from 'react-icons/fi';

const Sidebar = ({ currentModule, activeSubModule, isOpen, setIsOpen }) => {
    const { currentUser } = useAuth();
    const { branding } = useBranding();

    const navLinkClasses = ({ isActive }) =>
        `flex items-center px-4 py-3 transition-colors duration-200 transform rounded-md ${
            isActive 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-200 hover:bg-gray-700 hover:text-white'
        }`;
    
    // --- MENU KOMPONEN UNTUK SETIAP MODUL ---

    const PerangkatMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pemerintahan</div>
            <NavLink to="/app" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/perangkat" className={navLinkClasses}>
                <FiUsers className="w-5 h-5 mr-3" /><span>Data Perangkat</span>
            </NavLink>
            {currentUser?.role === 'admin_kecamatan' && (
                <>
                    <NavLink to="/app/rekapitulasi-aparatur" className={navLinkClasses}>
                        <FiBarChart2 className="w-5 h-5 mr-3" /><span>Rekap Aparatur</span>
                    </NavLink>
                    <NavLink to="/app/laporan" className={navLinkClasses}>
                        <FiFileText className="w-5 h-5 mr-3" /><span>Pusat Laporan</span>
                    </NavLink>
                    <hr className="my-2 border-gray-700" />
                    <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Administrasi</div>
                    <NavLink to="/app/manajemen-admin" className={navLinkClasses}>
                        <FiUserPlus className="w-5 h-5 mr-3" /><span>Manajemen Admin</span>
                    </NavLink>
                    <NavLink to="/app/pengaturan" className={navLinkClasses}>
                        <FiSettings className="w-5 h-5 mr-3" /><span>Pengaturan</span>
                    </NavLink>
                </>
            )}
        </>
    );

    // --- MENU FOKUS UNTUK SETIAP SUB-MODUL ORGANISASI ---

    const BpdMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">BPD</div>
            <NavLink to="/app/bpd" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/bpd/data" className={navLinkClasses}>
                <FiUsers className="w-5 h-5 mr-3" /><span>Data Anggota</span>
            </NavLink>
            <NavLink to="/app/bpd/berita-acara" className={navLinkClasses}>
                <FiBookOpen className="w-5 h-5 mr-3" /><span>Manajemen BA</span>
            </NavLink>
            {currentUser?.role === 'admin_kecamatan' && (
                <NavLink to="/app/bpd/pengaturan" className={navLinkClasses}>
                    <FiSettings className="w-5 h-5 mr-3" /><span>Setelan BPD</span>
                </NavLink>
            )}
        </>
    );

    const LpmMenu = () => (
         <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">LPM</div>
            <NavLink to="/app/lpm" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/lpm/data" className={navLinkClasses}>
                <FiAward className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span>
            </NavLink>
        </>
    );
    
    const PkkMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">PKK</div>
            <NavLink to="/app/pkk" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/pkk/data" className={navLinkClasses}>
                <FiHeart className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span>
            </NavLink>
            <NavLink to="/app/pkk/program" className={navLinkClasses}>
                <FiBookOpen className="w-5 h-5 mr-3" /><span>Program Kerja</span>
            </NavLink>
        </>
    );

    const KarangTarunaMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Karang Taruna</div>
            <NavLink to="/app/karang-taruna" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/karang-taruna/data" className={navLinkClasses}>
                <FiUserPlus className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span>
            </NavLink>
            <NavLink to="/app/karang-taruna/kegiatan" className={navLinkClasses}>
                <FiActivity className="w-5 h-5 mr-3" /><span>Manajemen Kegiatan</span>
            </NavLink>
        </>
    );

    const RtRwMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">RT / RW</div>
            <NavLink to="/app/rt-rw" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/rt-rw/data" className={navLinkClasses}>
                <FiHome className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span>
            </NavLink>
        </>
    );

    const EFileMenu = () => (
        <>
            <NavLink to="/app/efile" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard E-File</span>
            </NavLink>
            <NavLink to="/app/efile/manage" className={navLinkClasses}>
                <FiFileText className="w-5 h-5 mr-3" /><span>Manajemen SK</span>
            </NavLink>
        </>
    );

    const KeuanganMenu = () => (
        <>
             <NavLink to="/app/keuangan" end className={navLinkClasses}>
                <FiDollarSign className="w-5 h-5 mr-3" /><span>APBDes</span>
            </NavLink>
        </>
    );

    const AsetMenu = () => (
         <>
             <NavLink to="/app/aset" end className={navLinkClasses}>
                <FiArchive className="w-5 h-5 mr-3" /><span>Manajemen Aset</span>
            </NavLink>
        </>
    );

   
    // --- LOGIKA UTAMA RENDER SIDEBAR ---

    const renderCurrentMenu = () => {
        if (currentModule === 'organisasi') {
            switch (activeSubModule) {
                case 'bpd': return <BpdMenu />;
                case 'lpm': return <LpmMenu />;
                case 'pkk': return <PkkMenu />;
                case 'karang_taruna': return <KarangTarunaMenu />;
                case 'rt_rw': return <RtRwMenu />;
                default: return null; // Tidak ada menu jika tidak di sub-modul spesifik
            }
        }
        
        switch (currentModule) {
            case 'perangkat': return <PerangkatMenu />;
            case 'efile': return <EFileMenu />;
            case 'keuangan': return <KeuanganMenu />;
            case 'aset': return <AsetMenu />;
            default: return <PerangkatMenu />; // Fallback
        }
    };

    return (
        <>
            <div
                onClick={() => setIsOpen(false)}
                className={`fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity md:hidden ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden="true"
            ></div>
            <aside
                className={`fixed inset-y-0 left-0 z-30 w-64 px-4 py-4 overflow-y-auto bg-gray-800 dark:bg-gray-900 border-r border-gray-700 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex items-center justify-center h-16 px-2 border-b border-gray-700">
                    <img src={branding.loginLogoUrl} alt="Logo" className="w-10 h-10 mr-3 object-contain" />
                    <span className="text-xl font-bold text-white whitespace-nowrap">{branding.appName}</span>
                </div>
                <nav className="flex flex-col justify-between flex-1 mt-6">
                    <div>
                        {renderCurrentMenu()}
                    </div>
                    <div>
                        <hr className="my-4 border-gray-600" />
                        {currentModule === 'organisasi' && (
                            <NavLink to="/app/organisasi-desa" className={navLinkClasses}>
                                <FiShare2 className="w-5 h-5 mr-3" />
                                <span>Hub Organisasi</span>
                            </NavLink>
                        )}
                        <NavLink to="/" className={navLinkClasses}>
                            <FiArrowLeft className="w-5 h-5 mr-3" />
                            <span>Menu Utama</span>
                        </NavLink>
                    </div>
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;

