import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

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
        // Mendefinisikan fungsi unsubscribe di cakupan yang lebih tinggi
        let unsubscribeUserDoc = () => {};
        let personalNotifsUnsubscribe = () => {};
        let roleNotifsUnsubscribe = () => {};

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setAuthError('');
            // Membersihkan listener sebelumnya saat status otentikasi berubah
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

                        // --- Logika notifikasi tetap ada tetapi sekarang di dalam listener pengguna ---
                        const handleSnapshots = (personalSnapshot, roleSnapshot) => {
                            const personalNotifs = personalSnapshot ? personalSnapshot.docs.map(d => ({ id: d.id, ...d.data(), isRoleBased: false })) : [];
                            const roleNotifs = roleSnapshot ? roleSnapshot.docs.map(d => ({ id: d.id, ...d.data(), isRoleBased: true })) : [];
                            
                            const allNotifs = [...personalNotifs, ...roleNotifs];
                            
                            setNotifications(allNotifs);

                            const unreadPersonal = personalNotifs.filter(n => !n.readStatus).length;
                            const unreadRole = roleNotifs.filter(n => !n.readBy || !n.readBy.includes(user.uid)).length;
                            setUnreadCount(unreadPersonal + unreadRole);
                        };

                        let personalSnapshotCache = null;
                        let roleSnapshotCache = null;

                        // Listener untuk notifikasi pribadi
                        const personalQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid));
                        personalNotifsUnsubscribe = onSnapshot(personalQuery, (snapshot) => {
                            personalSnapshotCache = snapshot;
                            handleSnapshots(personalSnapshotCache, roleSnapshotCache);
                        });

                        // Listener tambahan jika pengguna adalah Admin Kecamatan
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
                        signOut(auth);
                        setCurrentUser(null);
                    }
                    setLoading(false); // Set loading menjadi false setelah data pengguna (atau error) ditangani
                }, (error) => {
                    console.error("Error listening to user document:", error);
                    setLoading(false);
                });
            } else {
                setCurrentUser(null);
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false);
            }
        });
        
        return () => {
            unsubscribeAuth();
            // Pastikan semua listener dibersihkan
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
        if (!notification) return;

        const notificationRef = doc(db, 'notifications', notificationId);
        try {
            if (notification.isRoleBased) {
                // Untuk notifikasi berbasis peran, tambahkan pengguna ke array 'readBy'
                await updateDoc(notificationRef, {
                    readBy: arrayUnion(currentUser.uid)
                });
            } else {
                // Untuk notifikasi pribadi, cukup perbarui status
                await updateDoc(notificationRef, { readStatus: true });
            }
        } catch (error) {
            console.error("Gagal menandai notifikasi:", error);
        }
    }, [notifications, currentUser]);

    // Fungsi baru untuk memperbarui profil pengguna di Firestore
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
        updateUserProfile // Mengekspos fungsi pembaruan
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

