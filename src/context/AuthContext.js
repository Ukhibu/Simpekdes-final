import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';

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
            let notificationUnsubscribe = () => {}; // Fungsi kosong untuk unsubscribe

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = { uid: user.uid, email: user.email, ...userDocSnap.data() };
                    setCurrentUser(userData);

                    // Setup listener notifikasi
                    const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid));
                    notificationUnsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
                        const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                        setNotifications(notifs);
                        setUnreadCount(notifs.filter(n => !n.readStatus).length);
                    });

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
            
            // Cleanup listener notifikasi saat user berubah atau logout
            return () => notificationUnsubscribe();
        });
        
        return () => unsubscribeAuth();
    }, []);

    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
    };

    const markNotificationAsRead = async (notificationId) => {
        const notificationRef = doc(db, 'notifications', notificationId);
        try {
            await updateDoc(notificationRef, { readStatus: true });
        } catch (error) {
            console.error("Gagal menandai notifikasi:", error);
        }
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
        markNotificationAsRead
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

