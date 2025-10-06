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
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setAuthError('');
            let personalNotifsUnsubscribe = () => {};
            let roleNotifsUnsubscribe = () => {};

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = { uid: user.uid, email: user.email, ...userDocSnap.data() };
                    setCurrentUser(userData);

                    // Fungsi untuk menggabungkan notifikasi dari dua sumber
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

                } else {
                    console.error(`Profil pengguna untuk UID: ${user.uid} tidak ditemukan di Firestore.`);
                    setAuthError('Profil pengguna tidak ditemukan. Silakan hubungi administrator.');
                    await signOut(auth);
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
                setNotifications([]);
                setUnreadCount(0);
            }
            setLoading(false);
            
            return () => {
                personalNotifsUnsubscribe();
                roleNotifsUnsubscribe();
            };
        });
        
        return () => unsubscribeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
    };

    // [REVISED] Fungsi ini sekarang menangani notifikasi pribadi dan berbasis peran
    const markNotificationAsRead = useCallback(async (notificationId) => {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return;

        const notificationRef = doc(db, 'notifications', notificationId);
        try {
            if (notification.isRoleBased) {
                // Untuk berbasis peran, tambahkan pengguna ke array 'readBy'
                await updateDoc(notificationRef, {
                    readBy: arrayUnion(currentUser.uid)
                });
            } else {
                // Untuk pribadi, cukup perbarui status
                await updateDoc(notificationRef, { readStatus: true });
            }
        } catch (error) {
            console.error("Gagal menandai notifikasi:", error);
        }
    }, [notifications, currentUser]);

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
        markNotificationAsRead
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
