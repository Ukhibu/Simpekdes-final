import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import Spinner from '../components/common/Spinner';
import { FiLogOut, FiUsers, FiBriefcase, FiFileText } from 'react-icons/fi';
import '../styles/HubPage.css';
import AnimatedFooter from '../components/common/AnimatedFooter';

const HubPage = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    const navigate = useNavigate();
    const hubContainerRef = useRef(null);

    // State untuk mengontrol visibilitas menu dan judul
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isMenuLocked, setIsMenuLocked] = useState(false);
    const [isTitleVisible, setIsTitleVisible] = useState(true);

    // --- FIX: useEffect untuk animasi latar belakang ---
    // Efek ini sekarang hanya berjalan setelah loading selesai dan container sudah ada.
    useEffect(() => {
        const container = hubContainerRef.current;
        if (!container || brandingLoading || authLoading) {
            return; // Jangan jalankan jika masih loading atau container belum ada
        }

        const handleMouseMove = (e) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;
            const x = (clientX / innerWidth) * 100;
            const y = (clientY / innerHeight) * 100;
            container.style.setProperty('--mouse-x', `${x}%`);
            container.style.setProperty('--mouse-y', `${y}%`);
        };

        container.addEventListener('mousemove', handleMouseMove);

        // Cleanup function
        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
        };
    }, [brandingLoading, authLoading]); // <-- Bergantung pada status loading

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Gagal logout:', error);
        }
    };

    // Fungsi untuk menampilkan menu (saat hover)
    const showMenu = () => {
        if (!isMenuLocked) {
            setIsMenuVisible(true);
            setIsTitleVisible(false);
        }
    };

    // Fungsi untuk menyembunyikan menu (saat kursor meninggalkan area)
    const hideMenu = () => {
        if (!isMenuLocked) {
            setIsMenuVisible(false);
            setIsTitleVisible(true);
        }
    };
    
    // Fungsi untuk mengunci/membuka menu saat diklik
    const toggleMenuLock = (e) => {
        e.stopPropagation();
        setIsMenuLocked(!isMenuLocked);
        setIsMenuVisible(true); 
        setIsTitleVisible(isMenuLocked);
    };

    // Fungsi untuk menutup menu saat mengklik di luar
    const handleBackdropClick = () => {
        if (isMenuLocked) {
            setIsMenuLocked(false);
            setIsMenuVisible(false);
            setIsTitleVisible(true);
        }
    };

    if (brandingLoading || authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <Spinner />
            </div>
        );
    }

    return (
        <div ref={hubContainerRef} className="hub-container" onClick={handleBackdropClick}>
            <div className="interactive-background"></div>

            <header className="hub-header">
                <div className="user-greeting">
                    <span>Selamat Datang,</span>
                    <span className="font-bold">{currentUser?.nama || 'Pengguna'}</span>
                </div>
                <button onClick={handleLogout} className="logout-button">
                    <FiLogOut className="mr-2" />
                    <span>Keluar</span>
                </button>
            </header>

            <main className="hub-main-content">
                <div className={`hub-title-container ${isTitleVisible ? 'fade-in' : 'fade-out'}`}>
                    <h1 className="main-title">
                         {branding.appName}
                    </h1>
                    <p className="subtitle">Sistem Informasi Manajemen Perangkat Desa</p>
                    <p className="subtitle-small">Kecamatan Punggelan</p>
                </div>

                <div 
                    className={`hub-main-circle-container ${isMenuVisible || isMenuLocked ? 'menu-visible' : ''}`}
                    onMouseEnter={showMenu}
                    onMouseLeave={hideMenu}
                >
                    <div className="hub-main-circle" onClick={toggleMenuLock}>
                        <img src={branding.loginLogoUrl} alt="Logo Aplikasi" />
                    </div>

                    <Link to="/app" className="menu-item menu-item-1">
                        <FiUsers size={32} />
                        <span className="menu-item-label">Perangkat Desa</span>
                    </Link>
                    <Link to="/app/bpd" className="menu-item menu-item-2">
                        <FiBriefcase size={32} />
                        <span className="menu-item-label">B P D</span>
                    </Link>
                    <Link to="/app/efile" className="menu-item menu-item-3">
                        <FiFileText size={32} />
                        <span className="menu-item-label">E-File</span>
                    </Link>
                </div>
            </main>
            <AnimatedFooter />
        </div>
    );
};

export default HubPage;

