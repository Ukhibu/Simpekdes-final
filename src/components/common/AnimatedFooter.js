import React, { useState } from 'react';
import { FiPhone, FiCheck, FiCopy } from 'react-icons/fi'; // Pastikan install react-icons jika belum
import '../../styles/AnimatedFooter.css';

const AnimatedFooter = () => {
    // Kita gunakan tahun statis 2025 sesuai permintaan atau dinamis jika diinginkan
    // const currentYear = new Date().getFullYear(); 
    const [isCopied, setIsCopied] = useState(false);

    // Fitur Tambahan: Salin Nomor saat diklik
    const handleCopyContact = () => {
        navigator.clipboard.writeText("0838-4664-4286");
        setIsCopied(true);
        
        // Reset status setelah 2 detik
        setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    return (
        <footer className="animated-footer">
            <div className="footer-content">
                {/* Bagian Kiri: Copyright Text Updated */}
                <span className="footer-text">
                    &copy; 2025 <strong>SIMPEKDES</strong> By Bangkhi. All rights reserved.
                </span>

                {/* Bagian Kanan: Kontak Interaktif (Kapsul) */}
                <div 
                    className="contact-info" 
                    onClick={handleCopyContact}
                    title={isCopied ? "Nomor tersalin!" : "Klik untuk menyalin nomor"}
                >
                    {isCopied ? (
                        <>
                            <FiCheck size={16} className="contact-icon success-icon" />
                            <span className="contact-text" style={{ color: '#4ade80' }}>Tersalin!</span>
                        </>
                    ) : (
                        <>
                            <FiPhone size={16} className="contact-icon phone-ring" />
                            <span className="contact-text">
                                Kontak: 0838-4664-4286
                            </span>
                            <FiCopy size={12} style={{ marginLeft: 5, opacity: 0.5, color: 'white' }} />
                        </>
                    )}
                </div>
            </div>
        </footer>
    );
};

export default AnimatedFooter;