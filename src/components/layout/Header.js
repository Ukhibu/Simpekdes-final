import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiMenu, FiMoon, FiSun, FiLogOut } from 'react-icons/fi';

const Header = ({ pageTitle, onMenuClick }) => {
    // --- FIX: Mengambil fungsi 'logout' dari context ---
    const { currentUser, logout, theme, toggleTheme } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileMenuRef = useRef(null);
    const navigate = useNavigate();

    const getInitials = (name) => {
        if (!name) return '...';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [profileMenuRef]);

    // --- FIX: Fungsi handleLogout sekarang menggunakan 'logout' dari context ---
    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Gagal logout:", error);
        }
    };

    return (
        <header className="flex items-center justify-between p-4 md:p-6 bg-white dark:bg-gray-800 shadow-md">
            <div className="flex items-center">
                <button onClick={onMenuClick} className="text-gray-500 dark:text-gray-300 focus:outline-none md:hidden mr-4">
                    <FiMenu size={24} />
                </button>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">{pageTitle || 'Selamat Datang'}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selamat datang kembali, {currentUser?.nama || 'Pengguna'}!</p>
                </div>
            </div>
            
            <div className="relative" ref={profileMenuRef}>
                <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center space-x-3 cursor-pointer">
                    <div className="hidden md:block text-right">
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{currentUser?.nama || 'Nama Pengguna'}</p>
                        <span className="text-xs px-2 py-0.5 font-semibold text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                            {currentUser?.role === 'admin_kecamatan' ? 'Admin Kecamatan' : `Admin ${currentUser?.desa || ''}`}
                        </span>
                    </div>
                    <div className="w-10 h-10 bg-blue-500 text-white flex items-center justify-center rounded-full font-bold text-lg">
                        {getInitials(currentUser?.nama)}
                    </div>
                </button>
                
                <div className={`absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-2 z-50 transition-all duration-300 ease-in-out ${isProfileOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Tema Tampilan</p>
                        <div className="mt-2">
                            <label htmlFor="theme-toggle" className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input type="checkbox" id="theme-toggle" className="sr-only" checked={theme === 'dark'} onChange={toggleTheme} />
                                    <div className="block bg-gray-200 dark:bg-gray-600 w-14 h-8 rounded-full"></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out flex items-center justify-center ${theme === 'dark' ? 'transform translate-x-6' : ''}`}>
                                        <FiSun className={`text-yellow-500 transition-opacity duration-300 ${theme === 'light' ? 'opacity-100' : 'opacity-0'}`} />
                                        <FiMoon className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500 transition-opacity duration-300 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                </div>
                                <div className="ml-3 text-gray-700 dark:text-gray-300 text-sm font-medium">
                                    {theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}
                                </div>
                            </label>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                       <FiLogOut />
                       <span>Keluar</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;

