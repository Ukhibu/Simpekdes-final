import React from 'react';
import '../../styles/LoadingScreen.css';
import logo from '../../assets/banjarnegara-logo.png';
import { useBranding } from '../../context/BrandingContext'; // 1. Impor useBranding

/**
 * Komponen LoadingScreen menampilkan animasi splash screen saat aplikasi dimuat.
 * Menggunakan logo aplikasi dan teks (dari BrandingContext) dengan efek animasi.
 */
const LoadingScreen = () => {
  // 2. Ambil data branding
  const { branding } = useBranding();
  const appName = branding?.namaAplikasi || 'SIMPEKDES';

  // 3. Ubah nama aplikasi menjadi array huruf, masing-masing dalam span
  const letters = appName.split('').map((char, index) => (
    <span key={index} style={{ '--i': index + 1 }}>
      {/* Gunakan non-breaking space untuk spasi agar tetap di-render */}
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img src={logo} alt="Logo Simpekdes" className="loading-logo" />
        <h1 className="loading-title">
          {/* 4. Render setiap huruf sebagai span */}
          {letters}
        </h1>
      </div>
    </div>
  );
};

export default LoadingScreen;

