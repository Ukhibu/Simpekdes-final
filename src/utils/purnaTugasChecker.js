import { collection, getDocs, doc, writeBatch, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Helper untuk mengonversi berbagai format tanggal ke Javascript Date Object
 */
const parseDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate(); // Firestore Timestamp
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Menghitung usia pensiun berdasarkan Tahun SK.
 * Aturan:
 * - SK sebelum tahun 2020: Pensiun usia 65 tahun.
 * - SK tahun 2020 ke atas: Pensiun usia 60 tahun.
 */
const getUsiaPurna = (tglSK) => {
    const dateObj = parseDate(tglSK);
    if (!dateObj) return 60; // Default jika tidak ada tanggal SK

    const tahunSK = dateObj.getFullYear();
    return tahunSK < 2020 ? 65 : 60;
};

/**
 * Memindahkan data perangkat ke history dan menghapusnya dari koleksi aktif.
 */
const processPurnaTugas = (docSnap, batch) => {
    const purnaData = docSnap.data();
    
    // Referensi dokumen baru di koleksi history
    const historyRef = doc(db, 'historyPerangkatDesa', docSnap.id);
    
    // Referensi dokumen lama di koleksi perangkat untuk dihapus
    const perangkatRef = doc(db, 'perangkat', docSnap.id);

    // 1. Tambahkan ke history dengan metadata tambahan
    batch.set(historyRef, {
        ...purnaData,
        status: 'Purna Tugas',
        tanggalPurna: Timestamp.now(), // Catat waktu pemrosesan otomatis
        keterangan: 'Dipindahkan otomatis oleh sistem (Purna Tugas)'
    });

    // 2. Hapus dari koleksi aktif
    batch.delete(perangkatRef);
};

/**
 * Fungsi utama pengecekan.
 * Sebaiknya dipanggil di root aplikasi (misal: di useEffect App.js atau Dashboard).
 */
export const checkAndProcessPurnaTugas = async () => {
    try {
        // 1. Cek throttle (agar tidak berjalan setiap kali refresh halaman dalam waktu singkat)
        const lastCheckRef = doc(db, 'settings', 'lastPurnaTugasCheck'); // Disimpan di 'settings' agar rapi
        const lastCheckSnap = await getDoc(lastCheckRef);
        const now = new Date();

        if (lastCheckSnap.exists()) {
            const lastCheckTime = lastCheckSnap.data().timestamp?.toDate();
            if (lastCheckTime) {
                const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);
                // Jika belum 24 jam sejak pengecekan terakhir, skip.
                if (hoursSinceLastCheck < 24) {
                    return { processed: 0, skipped: true };
                }
            }
        }

        console.log('Menjalankan pengecekan purna tugas otomatis...');

        const perangkatCollection = collection(db, 'perangkat');
        const snapshot = await getDocs(perangkatCollection);
        
        if (snapshot.empty) return { processed: 0, skipped: false };

        const batch = writeBatch(db);
        let processedCount = 0;

        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const jabatan = data.jabatan ? data.jabatan.toLowerCase() : '';
            
            // Cek apakah jabatan adalah Kepala Desa / Pj. Kepala Desa
            const isKades = jabatan.includes('kepala desa') || jabatan.includes('pj. kepala desa');

            let isPurna = false;

            // LOGIKA 1: Kepala Desa (Berdasarkan Akhir Masa Jabatan Eksplisit)
            if (isKades) {
                const akhirJabatan = parseDate(data.akhir_jabatan);
                if (akhirJabatan && akhirJabatan < now) {
                    isPurna = true;
                }
            } 
            // LOGIKA 2: Perangkat Desa Lainnya (Sekdes ke bawah) - Berdasarkan Usia & Tahun SK
            else {
                const tglLahir = parseDate(data.tgl_lahir);
                if (tglLahir) {
                    const usiaPensiun = getUsiaPurna(data.tgl_sk);
                    
                    // Hitung tanggal pensiun
                    const tglPensiun = new Date(tglLahir);
                    tglPensiun.setFullYear(tglLahir.getFullYear() + usiaPensiun);

                    // Cek apakah sudah lewat tanggal pensiun
                    if (tglPensiun < now) {
                        isPurna = true;
                    }
                }
            }

            if (isPurna) {
                processPurnaTugas(docSnap, batch);
                processedCount++;
            }
        });

        if (processedCount > 0) {
            // Commit batch jika ada perubahan
            await batch.commit();
            
            // Update waktu pengecekan terakhir
            await updateDoc(lastCheckRef, { timestamp: Timestamp.fromDate(now) }).catch(async () => {
                // Jika dokumen settings belum ada, buat baru
                const { setDoc } = await import('firebase/firestore');
                await setDoc(lastCheckRef, { timestamp: Timestamp.fromDate(now) });
            });

            console.log(`Sukses: ${processedCount} data perangkat dipindahkan ke history.`);
            return { processed: processedCount, skipped: false };
        } else {
            // Tetap update timestamp agar tidak cek terus menerus
            const { setDoc } = await import('firebase/firestore'); // Dynamic import untuk menghindari circular dep jika ada, atau sekadar safety
            await setDoc(lastCheckRef, { timestamp: Timestamp.fromDate(now) });
            
            return { processed: 0, skipped: false };
        }

    } catch (error) {
        console.error("Error pada checkAndProcessPurnaTugas:", error);
        return { processed: 0, error: error.message };
    }
};