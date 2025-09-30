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

const HubPage = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    const navigate = useNavigate();

    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isMenuLocked, setIsMenuLocked] = useState(false);
    const [isTitleVisible, setIsTitleVisible] = useState(true);

    // Efek untuk memuat dan menginisialisasi particles.js
    useEffect(() => {
        const scriptId = 'particles-js-script';
        
        // Cek jika script sudah ada untuk menghindari duplikasi saat hot-reloading
        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = "https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js";
        script.async = true;
        script.onload = () => {
            if (window.particlesJS) {
                window.particlesJS('particles-js-container', {
                    "particles": {
                        "number": {
                            "value": 120,
                            "density": { "enable": true, "value_area": 800 }
                        },
                        "color": { "value": "#ffffff" },
                        "shape": { "type": "circle" },
                        "opacity": {
                            "value": 0.5,
                            "random": true,
                            "anim": { "enable": true, "speed": 1, "opacity_min": 0.1, "sync": false }
                        },
                        "size": { "value": 2.5, "random": true },
                        "line_linked": {
                            "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.2, "width": 1
                        },
                        "move": {
                            "enable": true, "speed": 1.5, "direction": "none", "random": true,
                            "straight": false, "out_mode": "out", "bounce": false
                        }
                    },
                    "interactivity": {
                        "detect_on": "canvas",
                        "events": {
                            "onhover": { "enable": true, "mode": "repulse" },
                            "onclick": { "enable": true, "mode": "push" },
                            "resize": true
                        },
                        "modes": {
                            "repulse": { "distance": 100, "duration": 0.4 },
                            "push": { "particles_nb": 4 }
                        }
                    },
                    "retina_detect": true
                });
            }
        };
        document.body.appendChild(script);

        // Fungsi cleanup untuk menghapus script dan canvas saat komponen dilepas
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
            // Hancurkan instance particles.js untuk membersihkan event listeners dan loop animasi
            if (window.pJSDom && window.pJSDom.length > 0) {
                window.pJSDom[0].pJS.fn.vendors.destroypJS();
                window.pJSDom = [];
            }
        };
    }, []);


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
            {/* Lapisan Latar Belakang */}
            <div className="hub-background-layers">
                <div 
                    className="background-image" 
                    style={{ backgroundImage: `url(${branding.hubBackgroundUrl})` }}
                />
                <div id="particles-js-container" className="particle-canvas"></div>
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
