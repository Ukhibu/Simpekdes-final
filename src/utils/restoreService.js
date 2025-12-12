import { doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Fungsi untuk mengembalikan data dari History ke Perangkat Aktif.
 * @param {string} id - ID dokumen yang akan dikembalikan
 */
export const restorePerangkatFromHistory = async (id) => {
    if (!id) throw new Error("ID tidak valid");

    try {
        await runTransaction(db, async (transaction) => {
            const historyRef = doc(db, 'historyPerangkatDesa', id);
            const perangkatRef = doc(db, 'perangkat', id);

            const historySnap = await transaction.get(historyRef);

            if (!historySnap.exists()) {
                throw new Error("Data tidak ditemukan di riwayat.");
            }

            const data = historySnap.data();

            // Hapus field yang ditambahkan saat masuk history
            const restoredData = { ...data };
            delete restoredData.tanggalPurna;
            delete restoredData.keterangan;
            
            // Kembalikan status (opsional, sesuaikan dengan logika Anda)
            // Jika sebelumnya statusnya 'Purna Tugas', ubah jadi 'Aktif' atau hapus field status agar mengikuti default
            if (restoredData.status === 'Purna Tugas') {
                delete restoredData.status; 
            }

            // 1. Tulis kembali ke koleksi 'perangkat'
            transaction.set(perangkatRef, restoredData);

            // 2. Hapus dari koleksi 'historyPerangkatDesa'
            transaction.delete(historyRef);
        });

        console.log(`Berhasil mengembalikan data ID: ${id}`);
        return { success: true };

    } catch (error) {
        console.error("Gagal mengembalikan data:", error);
        throw error;
    }
};