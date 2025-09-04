import React, { createContext, useState, useEffect, useContext } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import defaultLogo from '../assets/banjarnegara-logo.png';

const BrandingContext = createContext();

export function useBranding() {
    return useContext(BrandingContext);
}

export function BrandingProvider({ children }) {
    const [branding, setBranding] = useState({
        appName: 'SIMPEKDES',
        loginTitle: 'Sistem Informasi Manajemen Perangkat Desa',
        loginSubtitle: 'Kecamatan Punggelan',
        loginLogoUrl: defaultLogo, // Logo default
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listener realtime ke dokumen 'branding' di koleksi 'settings'
        const docRef = doc(db, 'settings', 'branding');
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                setBranding(doc.data());
            } else {
                // Jika dokumen belum ada, gunakan nilai default
                console.log("Dokumen branding tidak ditemukan, menggunakan default.");
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching branding:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
