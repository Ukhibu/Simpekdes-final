import React from 'react';
import logoDefault from '../../assets/banjarnegara-logo.png'; // Logo default (fallback)
import { useBranding } from '../../context/BrandingContext'; // 1. Impor useBranding

/**
 * Komponen LoadingScreen menampilkan animasi splash screen saat aplikasi dimuat.
 * Menggunakan logo aplikasi dan teks (dari BrandingContext) dengan efek animasi modern.
 */
const LoadingScreen = () => {
  // 2. Ambil data branding untuk Logo dan Nama Aplikasi dinamis
  const { branding } = useBranding();
  
  // Gunakan data dari context, atau fallback ke default jika belum disetting
  const appName = branding?.namaAplikasi || 'SIMPEKDES';
  const appLogo = branding?.logo || logoDefault;

  // 3. Ubah nama aplikasi menjadi array huruf untuk animasi per karakter
  const letters = appName.split('').map((char, index) => (
    <span 
      key={index} 
      className="inline-block animate-bounce-short text-slate-700 hover:text-blue-600 transition-colors duration-300"
      // Menggunakan inline style untuk delay animasi yang dinamis (staggered effect)
      style={{ 
        animationDelay: `${index * 0.1}s`,
        animationDuration: '1s'
      }}
    >
      {/* Gunakan non-breaking space untuk spasi agar tetap memiliki lebar */}
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));

  // 4. Logic BARU: Ubah teks loading menjadi array huruf agar bergelombang
  const loadingText = "Memuat Data Aplikasi...";
  const loadingLetters = loadingText.split('').map((char, index) => (
    <span 
      key={index} 
      className="inline-block animate-bounce" // Gunakan animate-bounce standar untuk efek gelombang naik-turun
      style={{ 
        animationDelay: `${index * 0.1}s`, // Delay bertingkat menciptakan efek ombak
        animationDuration: '1.5s' // Durasi sedikit lambat agar terlihat santai/elegan
      }}
    >
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 transition-opacity duration-500">
      <div className="relative flex flex-col items-center">
        
        {/* Container Logo dengan Efek Glow */}
        <div className="mb-8 relative group">
          <div className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500 animate-pulse"></div>
          <img 
            src={appLogo} 
            alt="Logo Aplikasi" 
            className="w-28 h-28 object-contain relative z-10 drop-shadow-xl transform transition-transform duration-500 hover:scale-105"
          />
        </div>

        {/* Spinner Loading Modern */}
        <div className="flex flex-col items-center space-y-6">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin shadow-md"></div>
          
          <div className="text-center">
            {/* Render Judul Aplikasi dengan Animasi Huruf */}
            <h1 className="text-2xl font-extrabold tracking-wide mb-2 flex justify-center space-x-[1px]">
              {letters}
            </h1>
            
            {/* Render Teks Loading dengan Animasi Bergelombang */}
            <div className="text-sm text-slate-500 font-medium flex justify-center">
              {loadingLetters}
            </div>
          </div>
        </div>

      </div>

      {/* Footer Kecil (Opsional - menambah kesan profesional) */}
      <div className="absolute bottom-8 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Sistem Informasi Pemerintah Desa
      </div>
    </div>
  );
};

export default LoadingScreen;