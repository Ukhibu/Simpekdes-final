import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    // Loading default true untuk menangani pengecekan auth pertama kali (menghindari layar putih)
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    
    // Inisialisasi tema dari localStorage
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    // Effect untuk menerapkan class dark mode ke HTML root
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };
    
    useEffect(() => {
        // Mendefinisikan fungsi unsubscribe di cakupan yang lebih tinggi agar bisa di-reset
        let unsubscribeUserDoc = () => {};
        let personalNotifsUnsubscribe = () => {};
        let roleNotifsUnsubscribe = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setAuthError('');
            
            // Membersihkan listener sebelumnya saat status otentikasi berubah (misal logout/login akun lain)
            unsubscribeUserDoc();
            personalNotifsUnsubscribe();
            roleNotifsUnsubscribe();

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);

                // Listener real-time untuk data profil pengguna
                unsubscribeUserDoc = onSnapshot(userDocRef, (userDocSnap) => {
                    if (userDocSnap.exists()) {
                        const userData = { uid: user.uid, email: user.email, ...userDocSnap.data() };
                        setCurrentUser(userData);

                        // --- Logika notifikasi di dalam listener pengguna ---
                        const handleSnapshots = (personalSnapshot, roleSnapshot) => {
                            const personalNotifs = personalSnapshot ? personalSnapshot.docs.map(d => ({ id: d.id, ...d.data(), isRoleBased: false })) : [];
                            const roleNotifs = roleSnapshot ? roleSnapshot.docs.map(d => ({ id: d.id, ...d.data(), isRoleBased: true })) : [];
                            
                            // Gabungkan notifikasi, urutkan jika perlu (misal berdasarkan timestamp)
                            const allNotifs = [...personalNotifs, ...roleNotifs].sort((a, b) => b.createdAt - a.createdAt);
                            
                            setNotifications(allNotifs);

                            // Hitung unread count
                            const unreadPersonal = personalNotifs.filter(n => !n.readStatus).length;
                            const unreadRole = roleNotifs.filter(n => !n.readBy || !n.readBy.includes(user.uid)).length;
                            setUnreadCount(unreadPersonal + unreadRole);
                        };

                        let personalSnapshotCache = null;
                        let roleSnapshotCache = null;

                        // 1. Listener untuk notifikasi pribadi (berdasarkan userId)
                        const personalQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid));
                        personalNotifsUnsubscribe = onSnapshot(personalQuery, (snapshot) => {
                            personalSnapshotCache = snapshot;
                            handleSnapshots(personalSnapshotCache, roleSnapshotCache);
                        });

                        // 2. Listener tambahan jika pengguna adalah Admin Kecamatan (berdasarkan role)
                        if (userData.role === 'admin_kecamatan') {
                            const roleQuery = query(collection(db, 'notifications'), where('targetRole', '==', 'admin_kecamatan'));
                            roleNotifsUnsubscribe = onSnapshot(roleQuery, (snapshot) => {
                                roleSnapshotCache = snapshot;
                                handleSnapshots(personalSnapshotCache, roleSnapshotCache);
                            });
                        }
                        // --- Akhir dari logika notifikasi ---

                    } else {
                        console.error(`Profil pengguna untuk UID: ${user.uid} tidak ditemukan di Firestore.`);
                        setAuthError('Profil pengguna tidak ditemukan. Silakan hubungi administrator.');
                        // Force logout jika data user di firestore tidak ada
                        signOut(auth);
                        setCurrentUser(null);
                    }
                    
                    // KUNCI PERBAIKAN: Matikan loading hanya setelah data user berhasil dimuat
                    setLoading(false); 

                }, (error) => {
                    console.error("Error listening to user document:", error);
                    setAuthError('Gagal memuat profil pengguna.');
                    setLoading(false); // Matikan loading meskipun error agar tidak stuck
                });
            } else {
                // Jika tidak ada user (belum login/logout)
                setCurrentUser(null);
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false); // Matikan loading segera
            }
        });
        
        return () => {
            unsubscribeAuth();
            // Pastikan semua listener dibersihkan saat unmount
            unsubscribeUserDoc();
            personalNotifsUnsubscribe();
            roleNotifsUnsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
    };

    const markNotificationAsRead = useCallback(async (notificationId) => {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification || !currentUser) return;

        const notificationRef = doc(db, 'notifications', notificationId);
        try {
            if (notification.isRoleBased) {
                // Untuk notifikasi berbasis peran, tambahkan pengguna ke array 'readBy'
                await updateDoc(notificationRef, {
                    readBy: arrayUnion(currentUser.uid)
                });
            } else {
                // Untuk notifikasi pribadi, cukup perbarui status readStatus boolean
                await updateDoc(notificationRef, { readStatus: true });
            }
        } catch (error) {
            console.error("Gagal menandai notifikasi:", error);
        }
    }, [notifications, currentUser]);

    // Fungsi untuk memperbarui profil pengguna di Firestore
    const updateUserProfile = async (uid, data) => {
        if (!uid) {
            throw new Error("User ID is required to update profile.");
        }
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, data);
        // Listener onSnapshot akan secara otomatis memperbarui state currentUser di seluruh aplikasi.
    };

    const value = {
        currentUser,
        loading,
        authError,
        setAuthError,
        theme,
        toggleTheme,
        logout,
        notifications,
        unreadCount,
        markNotificationAsRead,
        updateUserProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {/* Render children HANYA jika loading false. 
               Ini mencegah glitch tampilan atau redirect prematur di App.js 
            */}
            {!loading && children}
        </AuthContext.Provider>
    );
};