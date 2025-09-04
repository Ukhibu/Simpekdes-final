import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Spinner from '../components/common/Spinner'; 
import { FiEye, FiEyeOff, FiMail, FiLock } from 'react-icons/fi';
import AnimatedFooter from '../components/common/AnimatedFooter';

const LoginPage = () => {
    // State dari kode baru Anda, dipertahankan
    const { branding, loading: brandingLoading } = useBranding();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // --- FIX: Mengintegrasikan kembali hook yang penting ---
    const navigate = useNavigate();
    const { currentUser, authError, setAuthError } = useAuth();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // --- FIX: useEffect untuk navigasi otomatis setelah login berhasil ---
    useEffect(() => {
        // Jika currentUser (dari AuthContext) terdeteksi, artinya login sukses
        // dan profil pengguna valid. Arahkan ke halaman utama.
        if (currentUser) {
            navigate('/');
        }
    }, [currentUser, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLocalError('');
        setAuthError(null); // Reset galat dari context
        setIsLoggingIn(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Tidak perlu navigasi di sini. useEffect di atas akan menanganinya.
        } catch (err) {
            // Ini menangani galat dasar seperti email/password salah
            setLocalError('Email atau password yang Anda masukkan salah.');
            setIsLoggingIn(false); // Pastikan loading berhenti jika ada error
        }
        // Jangan set isLoggingIn ke false di sini, biarkan proses verifikasi di AuthContext selesai
    };

    if (brandingLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900"><Spinner size="lg" /></div>;
    }

    // Menggabungkan error dari state lokal (password salah) dan dari context (profil tidak ditemukan)
    const displayError = localError || authError;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row h-screen">
                
                {/* Kolom Kiri: Branding & Visual (Desain Anda dipertahankan) */}
                <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 p-12 text-white">
                    <div className={`text-center transition-all duration-1000 ease-in-out ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
                        <img src={branding.loginLogoUrl} alt="Logo Aplikasi" className="w-28 h-28 mx-auto mb-6 object-contain drop-shadow-lg" />
                        <h1 className="text-4xl font-bold tracking-tight">{branding.appName}</h1>
                        <p className="text-lg mt-2 opacity-80">{branding.loginTitle}</p>
                        <p className="font-semibold text-xl mt-1 opacity-90">{branding.loginSubtitle}</p>
                    </div>
                </div>

                {/* Kolom Kanan: Form Login (Desain Anda dipertahankan) */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                    <div className="w-full max-w-md">
                        {/* Header untuk Tampilan Mobile */}
                        <div className="lg:hidden text-center mb-8">
                            <img src={branding.loginLogoUrl} alt="Logo Aplikasi" className="w-20 h-20 mx-auto mb-4 object-contain" />
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{branding.appName}</h1>
                        </div>

                        <div className={`bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl transition-all duration-700 ease-in-out ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">Masuk ke Akun Anda</h2>
                            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Selamat datang kembali!</p>
                            
                            {/* --- FIX: Menampilkan pesan galat gabungan --- */}
                            {displayError && (
                                <div className="mb-4 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-md text-sm" role="alert">
                                    <span className="font-bold">Terjadi Kesalahan:</span> {displayError}
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-6">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                    <div className="relative mt-1">
                                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="email" 
                                            value={email} 
                                            onChange={(e) => setEmail(e.target.value)} 
                                            required 
                                            className="w-full pl-10 pr-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500" 
                                            placeholder="contoh@email.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                    <div className="relative mt-1">
                                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)} 
                                            required 
                                            className="w-full pl-10 pr-10 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                                            placeholder="********"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-gray-400">
                                            {showPassword ? <FiEyeOff /> : <FiEye />}
                                        </button>
                                    </div>
                                </div>
                                
                                <div>
                                    <button type="submit" disabled={isLoggingIn} className="w-full flex justify-center px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-transform transform hover:-translate-y-1 shadow-lg hover:shadow-xl">
                                        {isLoggingIn ? <Spinner size="sm" /> : 'Masuk'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                 <AnimatedFooter />
            </div>
        </div>
    );
};

export default LoginPage;

