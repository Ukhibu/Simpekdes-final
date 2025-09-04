import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { 
    FiGrid, FiUsers, FiFileText, FiUserPlus, FiSettings, 
    FiBarChart2, FiArrowLeft, FiBriefcase, FiBookOpen 
} from 'react-icons/fi';

const Sidebar = ({ currentModule, isOpen, setIsOpen }) => {
    const { currentUser } = useAuth();
    const { branding } = useBranding();

    const navLinkClasses = ({ isActive }) =>
        `flex items-center px-4 py-3 transition-colors duration-200 transform rounded-md ${
            isActive 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-200 hover:bg-gray-700 hover:text-white'
        }`;

    const PerangkatMenu = () => (
        <>
            <NavLink to="/app" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard</span>
            </NavLink>
            <NavLink to="/app/perangkat" className={navLinkClasses}>
                <FiUsers className="w-5 h-5 mr-3" /><span>Data Perangkat</span>
            </NavLink>
            {currentUser?.role === 'admin_kecamatan' && (
                <>
                    <hr className="my-2 border-gray-700" />
                    <NavLink to="/app/rekapitulasi-aparatur" className={navLinkClasses}>
                        <FiBarChart2 className="w-5 h-5 mr-3" /><span>Rekap Aparatur</span>
                    </NavLink>
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

    const BpdMenu = () => (
        <>
            <NavLink to="/app/bpd" end className={navLinkClasses}>
                <FiGrid className="w-5 h-5 mr-3" /><span>Dashboard BPD</span>
            </NavLink>
            <NavLink to="/app/bpd/data" className={navLinkClasses}>
                <FiBriefcase className="w-5 h-5 mr-3" /><span>Data Anggota</span>
            </NavLink>
            {/* Tautan Baru */}
            <NavLink to="/app/bpd/berita-acara" className={navLinkClasses}>
                <FiBookOpen className="w-5 h-5 mr-3" /><span>Manajemen BA</span>
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
                        {currentModule === 'perangkat' && <PerangkatMenu />}
                        {currentModule === 'bpd' && <BpdMenu />}
                        {currentModule === 'efile' && <EFileMenu />}
                    </div>
                    <div>
                        <hr className="my-4 border-gray-600" />
                        <NavLink to="/" className={navLinkClasses}>
                            <FiArrowLeft className="w-5 h-5 mr-3" />
                            <span>Kembali ke Menu</span>
                        </NavLink>
                    </div>
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;

