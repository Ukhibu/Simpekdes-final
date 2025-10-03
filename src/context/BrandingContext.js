import React, { createContext, useState, useEffect, useContext } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import defaultLogo from '../assets/banjarnegara-logo.png';
// PERBAIKAN: Mengimpor gambar latar belakang default sebagai fallback.
import defaultBackground from '../assets/default-bg.jpg';

const BrandingContext = createContext();

export function useBranding() {
    return useContext(BrandingContext);
}

export function BrandingProvider({ children }) {
    const [branding, setBranding] = useState({
        appName: 'SIMPEKDES',
        loginTitle: 'Sistem Informasi Manajemen Perangkat Desa',
        loginSubtitle: 'Kecamatan Punggelan',
        loginLogoUrl: defaultLogo,
        // PERBAIKAN: Menambahkan properti baru dengan gambar default.
        hubBackgroundUrl: defaultBackground,
    });
    const [loading, setLoading] = useState(true);

    const { currentUser } = useAuth();

    useEffect(() => {
        // If user is not signed in, do not attach a secure snapshot listener (rules require auth)
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const docRef = doc(db, 'settings', 'branding');
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // PERBAIKAN: Memastikan semua properti memiliki nilai fallback jika tidak ada di database.
                setBranding({
                    appName: data.appName || 'SIMPEKDES',
                    loginTitle: data.loginTitle || 'Sistem Informasi',
                    loginSubtitle: data.loginSubtitle || 'Kecamatan Punggelan',
                    loginLogoUrl: data.loginLogoUrl || defaultLogo,
                    hubBackgroundUrl: data.hubBackgroundUrl || defaultBackground
                });
            } else {
                console.log("Dokumen branding tidak ditemukan, menggunakan default.");
            }
            setLoading(false);
        }, (error) => {
            // Handle permission-denied and other errors gracefully
            console.error("Error fetching branding:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const value = {
        branding,
        loading,
    };

    return (
        <BrandingContext.Provider value={value}>
            {children}
        </BrandingContext.Provider>
    );
}
