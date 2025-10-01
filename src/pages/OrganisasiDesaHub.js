import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import AnimatedFooter from '../components/common/AnimatedFooter';
import { FiArrowLeft, FiBriefcase, FiHeart, FiUsers, FiHome, FiAward } from 'react-icons/fi';
import '../styles/OrganisasiDesaHub.css';
// [PERBAIKAN] Impor komponen partikel yang baru dan bisa digunakan kembali
import ParticleBackground from '../components/common/ParticleBackground';

// [PERBAIKAN] Menghapus komponen ParticleBackground yang duplikat dari file ini

const OrganisasiDesaHub = () => {
    const { branding } = useBranding();
    const navigate = useNavigate();

    const menuItems = [
        { to: "/app/bpd", label: "BPD", icon: <FiBriefcase size={32} /> },
        { to: "/app/lpm", label: "LPM", icon: <FiAward size={32} /> },
        { to: "/app/pkk", label: "PKK", icon: <FiHeart size={32} /> },
        { to: "/app/karang-taruna", label: "Karang Taruna", icon: <FiUsers size={32} /> },
        { to: "/app/rt-rw", label: "RT / RW", icon: <FiHome size={32} /> },
    ];

    return (
        <div className="org-hub-container">
            {/* [PERBAIKAN] Menggunakan komponen partikel yang sudah diimpor */}
            <ParticleBackground />
            
            <div className="hub-content-wrapper">
                <header className="org-hub-header">
                    <div className="org-hub-branding">
                        <img src={branding.loginLogoUrl} alt="Logo" className="org-hub-logo" />
                        <div>
                            <h1 className="org-hub-title">{branding.appName}</h1>
                            <p className="org-hub-subtitle">Pusat Organisasi & Lembaga Desa</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="org-hub-back-button">
                        <FiArrowLeft className="mr-2" />
                        <span>Kembali ke Menu Utama</span>
                    </button>
                </header>

                <main className="org-hub-main">
                    <div className="menu-grid">
                        {menuItems.map((item, index) => (
                            <Link to={item.to} key={item.label} className="menu-item-circle" style={{ animationDelay: `${index * 100}ms` }}>
                                <div className="menu-item-icon">{item.icon}</div>
                                <span className="menu-item-label">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </main>

                <footer className="org-hub-footer">
                    <p className="instruction-text">Pilih salah satu lembaga di atas untuk memulai pengelolaan data.</p>
                    <AnimatedFooter />
                </footer>
            </div>
        </div>
    );
};

export default OrganisasiDesaHub;
