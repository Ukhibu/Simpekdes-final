import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import Spinner from '../components/common/Spinner';
import { 
    FiLogOut, FiUsers, FiFileText, 
    FiDollarSign, FiArchive, FiShare2 
} from 'react-icons/fi';
import '../styles/HubPage.css';
import AnimatedFooter from '../components/common/AnimatedFooter';
// [PERBAIKAN] Impor komponen partikel yang baru dan teroptimasi
import ParticleBackground from '../components/common/ParticleBackground';

const HubPage = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    const navigate = useNavigate();

    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isMenuLocked, setIsMenuLocked] = useState(false);
    const [isTitleVisible, setIsTitleVisible] = useState(true);

    // [PERBAIKAN] Logika particles.js yang lama dihapus

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
        const newLockState = !isMenuLocked;
        setIsMenuLocked(newLockState);
        setIsMenuVisible(true);
        setIsTitleVisible(!newLockState);
    };
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

    const menuItems = [
        { to: "/app", icon: <FiUsers size={32} />, label: "Perangkat Desa" },
        { to: "/app/organisasi-desa", icon: <FiShare2 size={32} />, label: "Organisasi Desa" },
        { to: "/app/efile", icon: <FiFileText size={32} />, label: "E-File" },
        { to: "/app/keuangan", icon: <FiDollarSign size={32} />, label: "Keuangan" },
        { to: "/app/aset", icon: <FiArchive size={32} />, label: "Aset Desa" },
    ];

    return (
        <div className="hub-container" onClick={handleBackdropClick}>
            <div className="hub-background-layers">
                <div 
                    className="background-image" 
                    style={{ backgroundImage: `url(${branding.hubBackgroundUrl})` }}
                />
                {/* [PERBAIKAN] Menggunakan komponen ParticleBackground */}
                <ParticleBackground />
            </div>

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
                    <p className="subtitle">{branding.loginTitle}</p>
                </div>

                <div 
                    className={`hub-main-circle-container ${isMenuVisible || isMenuLocked ? 'menu-visible-expanded' : ''}`}
                    onMouseEnter={showMenu}
                    onMouseLeave={hideMenu}
                >
                    <div className="hub-main-circle" onClick={toggleMenuLock}>
                        <img src={branding.loginLogoUrl} alt="Logo Aplikasi" />
                    </div>

                    {menuItems.map((item, index) => (
                         <Link key={index} to={item.to} className={`menu-item menu-item-${index + 1}`}>
                            {item.icon}
                            <span className="menu-item-label">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </main>
            <AnimatedFooter />
        </div>
    );
};

export default HubPage;

