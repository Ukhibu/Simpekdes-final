import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import Spinner from '../components/common/Spinner';
import { FiLogOut, FiUsers, FiBriefcase, FiFileText, FiDollarSign, FiArchive } from 'react-icons/fi'; // Ikon baru
import '../styles/HubPage.css';
import AnimatedFooter from '../components/common/AnimatedFooter';

const HubPage = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    const navigate = useNavigate();
    const hubContainerRef = useRef(null);

    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isMenuLocked, setIsMenuLocked] = useState(false);
    const [isTitleVisible, setIsTitleVisible] = useState(true);

    useEffect(() => {
        const container = hubContainerRef.current;
        if (!container || brandingLoading || authLoading) {
            return;
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
        return () => container.removeEventListener('mousemove', handleMouseMove);
    }, [brandingLoading, authLoading]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Gagal logout:', error);
        }
    };

    const showMenu = () => !isMenuLocked && (setIsMenuVisible(true), setIsTitleVisible(false));
    const hideMenu = () => !isMenuLocked && (setIsMenuVisible(false), setIsTitleVisible(true));
    const toggleMenuLock = (e) => {
        e.stopPropagation();
        setIsMenuLocked(!isMenuLocked);
        setIsMenuVisible(true);
        setIsTitleVisible(isMenuLocked);
    };
    const handleBackdropClick = () => {
        if (isMenuLocked) {
            setIsMenuLocked(false);
            setIsMenuVisible(false);
            setIsTitleVisible(true);
        }
    };

    if (brandingLoading || authLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900"><Spinner /></div>;
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
                    <h1 className="main-title">{branding.appName}</h1>
                    <p className="subtitle">Sistem Informasi Manajemen Pemerintahan Desa</p>
                    <p className="subtitle-small">Kecamatan Punggelan</p>
                </div>

                <div 
                    className={`hub-main-circle-container ${isMenuVisible || isMenuLocked ? 'menu-visible-expanded' : ''}`}
                    onMouseEnter={showMenu}
                    onMouseLeave={hideMenu}
                >
                    <div className="hub-main-circle" onClick={toggleMenuLock}>
                        <img src={branding.loginLogoUrl} alt="Logo Aplikasi" />
                    </div>

                    {/* Menu Items Updated */}
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
                    <Link to="/app/keuangan" className="menu-item menu-item-4">
                        <FiDollarSign size={32} />
                        <span className="menu-item-label">Keuangan</span>
                    </Link>
                    <Link to="/app/aset" className="menu-item menu-item-5">
                        <FiArchive size={32} />
                        <span className="menu-item-label">Aset Desa</span>
                    </Link>
                </div>
            </main>
            <AnimatedFooter />
        </div>
    );
};

export default HubPage;
