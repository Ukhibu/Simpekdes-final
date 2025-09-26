import { useState, useEffect, useCallback, useMemo } from 'react'; // useMemo ditambahkan di sini
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

/**
 * Custom hook untuk mengelola operasi CRUD pada koleksi Firestore.
 * @param {string} collectionName - Nama koleksi di Firestore.
 */
export const useFirestoreCollection = (collectionName) => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Memoize the collection reference creation
    const collectionRef = useMemo(() => collection(db, collectionName), [collectionName]);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }
        setLoading(true);

        // Membuat query berdasarkan peran pengguna
        const q = currentUser.role === 'admin_kecamatan'
            ? query(collectionRef)
            : query(collectionRef, where("desa", "==", currentUser.desa || ''));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setData(list);
            setLoading(false);
        }, (err) => {
            console.error(`Error fetching ${collectionName}: `, err);
            setError(err);
            showNotification(`Gagal memuat data ${collectionName}.`, 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionRef, currentUser, showNotification, collectionName]);

    const addItem = useCallback(async (newItem) => {
        try {
            await addDoc(collectionRef, newItem);
            showNotification('Data berhasil ditambahkan!', 'success');
        } catch (err) {
            console.error(`Error adding item to ${collectionName}: `, err);
            showNotification(`Gagal menambahkan data: ${err.message}`, 'error');
            throw err; // Lemparkan error agar bisa ditangani di komponen
        }
    }, [collectionRef, collectionName, showNotification]);

    const updateItem = useCallback(async (id, updatedItem) => {
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, updatedItem);
            showNotification('Data berhasil diperbarui!', 'success');
        } catch (err) {
            console.error(`Error updating item in ${collectionName}: `, err);
            showNotification(`Gagal memperbarui data: ${err.message}`, 'error');
            throw err;
        }
    }, [collectionName, showNotification]);

    const deleteItem = useCallback(async (id) => {
        try {
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
            showNotification('Data berhasil dihapus!', 'success');
        } catch (err) {
            console.error(`Error deleting item from ${collectionName}: `, err);
            showNotification(`Gagal menghapus data: ${err.message}`, 'error');
            throw err;
        }
    }, [collectionName, showNotification]);

    return { data, loading, error, addItem, updateItem, deleteItem };
};

