import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
    FiGrid, FiUsers, FiFileText, FiUserPlus, FiSettings,
    FiBarChart2, FiArrowLeft, FiBriefcase, FiBookOpen,
    FiDollarSign, FiArchive, FiShare2, FiAward, FiHome, FiHeart, FiActivity, FiCalendar,
    FiClipboard, FiEdit, FiMap, FiChevronDown, FiDatabase, FiUpload
} from 'react-icons/fi';

const Sidebar = ({ currentModule, activeSubModule, isOpen, setIsOpen, onProfileClick }) => {
    const { currentUser } = useAuth();
    const { branding } = useBranding();
    const location = useLocation();
    
    const [isSkMenuOpen, setIsSkMenuOpen] = useState(false);

    useEffect(() => {
        if (location.pathname.startsWith('/app/data-sk')) {
            setIsSkMenuOpen(true);
        }
    }, [location.pathname]);

    const navLinkClasses = ({ isActive }) =>
        `flex items-center px-4 py-3 transition-colors duration-200 transform rounded-md ${
            isActive
            ? 'bg-blue-600 text-white'
            : 'text-gray-200 hover:bg-gray-700 hover:text-white'
        }`;

    const subNavLinkClasses = ({ isActive }) =>
        `flex items-center pl-11 pr-4 py-2 text-sm transition-colors duration-200 transform rounded-md ${
            isActive
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:bg-gray-600 hover:text-white'
        }`;
    
    // --- MENU KOMPONEN ---

    const PerangkatMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pemerintahan</div>
            <NavLink to="/app" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/perangkat" className={navLinkClasses}>
                <FiUsers className="w-5 h-5 mr-3" /><span>Data Perangkat</span>
            </NavLink>
            <NavLink to="/app/kalender-kegiatan" className={navLinkClasses}>
                <FiCalendar className="w-5 h-5 mr-3" /><span>Kalender Kegiatan</span>
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

    const EFileMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Arsip Digital</div>
            <NavLink to="/app/efile" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard Arsip</span>
            </NavLink>
            <NavLink to="/app/manajemen-sk" className={navLinkClasses}>
                <FiUpload className="w-5 h-5 mr-3" /><span>Manajemen SK</span>
            </NavLink>
            
            <div>
                <button 
                    onClick={() => setIsSkMenuOpen(!isSkMenuOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 text-gray-200 hover:bg-gray-700 hover:text-white rounded-md focus:outline-none"
                >
                    <div className="flex items-center">
                        <FiDatabase className="w-5 h-5 mr-3" />
                        <span>Data SK</span>
                    </div>
                    <FiChevronDown className={`w-5 h-5 transition-transform duration-300 ${isSkMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSkMenuOpen ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="py-2 flex flex-col space-y-1">
                        <NavLink to="/app/data-sk/perangkat" className={subNavLinkClasses}>Perangkat Desa</NavLink>
                        <NavLink to="/app/data-sk/bpd" className={subNavLinkClasses}>BPD</NavLink>
                        <NavLink to="/app/data-sk/lpm" className={subNavLinkClasses}>LPM</NavLink>
                        <NavLink to="/app/data-sk/pkk" className={subNavLinkClasses}>PKK</NavLink>
                        <NavLink to="/app/data-sk/karang_taruna" className={subNavLinkClasses}>Karang Taruna</NavLink>
                        <NavLink to="/app/data-sk/rt_rw" className={subNavLinkClasses}>RT/RW</NavLink>
                    </div>
                </div>
            </div>
        </>
    );

    const BpdMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">BPD</div>
            <NavLink to="/app/bpd" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span></NavLink>
            <NavLink to="/app/bpd/data" className={navLinkClasses}><FiUsers className="w-5 h-5 mr-3" /><span>Data Anggota</span></NavLink>
            <NavLink to="/app/bpd/berita-acara" className={navLinkClasses}><FiBookOpen className="w-5 h-5 mr-3" /><span>Manajemen BA</span></NavLink>
            {currentUser?.role === 'admin_kecamatan' && (<NavLink to="/app/bpd/pengaturan" className={navLinkClasses}><FiSettings className="w-5 h-5 mr-3" /><span>Setelan BPD</span></NavLink>)}
        </>
    );

    const LpmMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">LPM</div>
            <NavLink to="/app/lpm" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span></NavLink>
            <NavLink to="/app/lpm/data" className={navLinkClasses}><FiAward className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span></NavLink>
            <NavLink to="/app/lpm/program" className={navLinkClasses}><FiClipboard className="w-5 h-5 mr-3" /><span>Program Kerja</span></NavLink>
        </>
    );

    const PkkMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">PKK</div>
            <NavLink to="/app/pkk" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span></NavLink>
            <NavLink to="/app/pkk/data" className={navLinkClasses}><FiHeart className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span></NavLink>
            <NavLink to="/app/pkk/program" className={navLinkClasses}><FiBookOpen className="w-5 h-5 mr-3" /><span>Program Kerja</span></NavLink>
        </>
    );

    const KarangTarunaMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Karang Taruna</div>
            <NavLink to="/app/karang-taruna" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span></NavLink>
            <NavLink to="/app/karang-taruna/data" className={navLinkClasses}><FiUserPlus className="w-5 h-5 mr-3" /><span>Manajemen Pengurus</span></NavLink>
            <NavLink to="/app/karang-taruna/kegiatan" className={navLinkClasses}><FiActivity className="w-5 h-5 mr-3" /><span>Manajemen Kegiatan</span></NavLink>
        </>
    );

    const RtRwMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">RT / RW</div>
            <NavLink to="/app/rt-rw" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span></NavLink>
            <NavLink to="/app/rt-rw/rt" className={navLinkClasses}><FiHome className="w-5 h-5 mr-3" /><span>Data RT</span></NavLink>
            <NavLink to="/app/rt-rw/rw" className={navLinkClasses}><FiHome className="w-5 h-5 mr-3" /><span>Data RW</span></NavLink>
            <NavLink to="/app/rt-rw/rekapitulasi" className={navLinkClasses}><FiFileText className="w-5 h-5 mr-3" /><span>Rekapitulasi RT/RW</span></NavLink>
        </>
    );

    const KeuanganMenu = () => (
        <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Keuangan Desa</div>
             <NavLink to="/app/keuangan" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard Keuangan</span></NavLink>
            <NavLink to="/app/keuangan/penganggaran" className={navLinkClasses}><FiClipboard className="w-5 h-5 mr-3" /><span>Penganggaran (APBDes)</span></NavLink>
            <NavLink to="/app/keuangan/penatausahaan" className={navLinkClasses}><FiEdit className="w-5 h-5 mr-3" /><span>Penatausahaan (BKU)</span></NavLink>
            <NavLink to="/app/keuangan/laporan" className={navLinkClasses}><FiFileText className="w-5 h-5 mr-3" /><span>Laporan Realisasi</span></NavLink>
        </>
    );
    
    const AsetMenu = () => (
         <>
            <div className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Aset Desa</div>
             <NavLink to="/app/aset" end className={navLinkClasses}><FiGrid className="w-5 h-5 mr-3" /><span>Dashboard Aset</span></NavLink>
            <NavLink to="/app/aset/manajemen" className={navLinkClasses}><FiArchive className="w-5 h-5 mr-3" /><span>Manajemen Aset (KIB)</span></NavLink>
            <NavLink to="/app/aset/peta" className={navLinkClasses}><FiMap className="w-5 h-5 mr-3" /><span>Peta Aset</span></NavLink>
        </>
    );

    const renderCurrentMenu = () => {
        if (currentModule === 'organisasi') {
            switch (activeSubModule) {
                case 'bpd': return <BpdMenu />;
                case 'lpm': return <LpmMenu />;
                case 'pkk': return <PkkMenu />;
                case 'karang_taruna': return <KarangTarunaMenu />;
                case 'rt_rw': return <RtRwMenu />;
                default: return null;
            }
        }

        switch (currentModule) {
            case 'perangkat': return <PerangkatMenu />;
            case 'efile': return <EFileMenu />;
            case 'keuangan': return <KeuanganMenu />;
            case 'aset': return <AsetMenu />;
            default: return <PerangkatMenu />;
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
        <>
            <div
                onClick={() => setIsOpen(false)}
                className={`fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden="true"
            ></div>
            <aside
                className={`fixed inset-y-0 left-0 z-30 w-64 px-4 py-4 overflow-y-auto bg-gray-800 dark:bg-gray-900 border-r border-gray-700 dark:border-gray-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex items-center justify-center h-16 px-2 border-b border-gray-700">
                    <img src={branding.loginLogoUrl} alt="Logo" className="w-10 h-10 mr-3 object-contain" />
                    <span className="text-xl font-bold text-white whitespace-nowrap">{branding.appName}</span>
                </div>

                {/* Bagian Profil Pengguna */}
                <div 
                    className="mt-4 p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors duration-200"
                    onClick={onProfileClick}
                >
                    <div className="flex items-center">
                        {currentUser?.foto_url ? (
                            <img src={currentUser.foto_url} alt="Profil" className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"/>
                        ) : (
                            <div className="w-12 h-12 bg-blue-500 text-white flex items-center justify-center rounded-full font-bold text-lg border-2 border-gray-600">
                                {getInitials(currentUser?.nama)}
                            </div>
                        )}
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-semibold text-white truncate">{currentUser?.nama || 'Nama Pengguna'}</p>
                            <p className="text-xs text-gray-400 truncate">
                                {currentUser?.role === 'admin_kecamatan' ? 'Admin Kecamatan' : `Admin ${currentUser?.desa || ''}`}
                            </p>
                        </div>
                    </div>
                </div>


                <nav className="flex flex-col justify-between flex-1 mt-2">
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

