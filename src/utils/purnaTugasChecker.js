import { collection, getDocs, doc, setDoc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * [PERBAIKAN LOGIKA]
 * Fungsi ini sekarang akan MEMINDAHKAN data perangkat yang purna tugas, bukan hanya mengosongkannya.
 * 1. Salin data ke 'historyPerangkatDesa'.
 * 2. Hapus dokumen asli dari koleksi 'perangkat'.
 */
const processPurnaTugas = async (perangkatRef, batch) => {
    const perangkatSnap = await perangkatRef.get();
    if (!perangkatSnap.exists()) return;

    const purnaData = perangkatSnap.data();

    // 1. Salin data ke koleksi riwayat
    const historyRef = doc(db, 'historyPerangkatDesa', perangkatSnap.id);
    batch.set(historyRef, {
        ...purnaData,
        tanggalPurna: new Date(), // Tambahkan catatan kapan data ini diproses
    });

    // 2. [PERUBAHAN UTAMA] Hapus dokumen asli dari koleksi 'perangkat'
    //    Ini akan membuatnya hilang dari halaman utama dan hanya ada di riwayat.
    batch.delete(perangkatRef);
};

// Logika usia tetap sama
const getUsiaPurna = (tglSK) => {
    if (!tglSK) return 60; // Default jika tanggal SK tidak ada
    const tahunSK = tglSK.toDate ? tglSK.toDate().getFullYear() : new Date(tglSK).getFullYear();
    return tahunSK < 2000 ? 65 : 60;
};

// Fungsi pengecekan utama
export const checkAndProcessPurnaTugas = async () => {
    // Cek kapan terakhir kali proses ini dijalankan
    const lastCheckRef = doc(db, 'system', 'lastPurnaTugasCheck');
    const lastCheckSnap = await getDoc(lastCheckRef);
    const now = new Date();

    if (lastCheckSnap.exists()) {
        const lastCheckTime = lastCheckSnap.data().timestamp.toDate();
        const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);
        if (hoursSinceLastCheck < 24) {
            console.log('Pengecekan purna tugas sudah dilakukan dalam 24 jam terakhir. Melewati...');
            return { processed: 0, skipped: true };
        }
    }

    console.log('Memulai proses pengecekan purna tugas otomatis...');

    const perangkatCollection = collection(db, 'perangkat');
    const snapshot = await getDocs(perangkatCollection);
    let processedCount = 0;
    const batch = writeBatch(db);

    snapshot.forEach(doc => {
        const perangkat = doc.data();
        if (!perangkat.nama || !perangkat.tgl_lahir) return;

        // Cek berdasarkan tanggal akhir jabatan jika ada (untuk Kades)
        if (perangkat.akhir_jabatan && new Date(perangkat.akhir_jabatan) < now) {
            processPurnaTugas(doc.ref, batch);
            processedCount++;
            return;
        }

        // Cek berdasarkan usia
        const usiaPurna = getUsiaPurna(perangkat.tgl_sk);
        const tglLahir = perangkat.tgl_lahir.toDate ? perangkat.tgl_lahir.toDate() : new Date(perangkat.tgl_lahir);

        let tglPurna = new Date(tglLahir);
        tglPurna.setFullYear(tglPurna.getFullYear() + usiaPurna);

        if (tglPurna < now) {
            processPurnaTugas(doc.ref, batch);
            processedCount++;
        }
    });

    if (processedCount > 0) {
        // Simpan catatan waktu HANYA jika ada data yang diproses
        batch.set(lastCheckRef, { timestamp: now });
        await batch.commit();
        console.log(`${processedCount} perangkat telah dipindahkan ke riwayat purna tugas.`);
        return { processed: processedCount, skipped: false };
    } else {
        // Jika tidak ada yang diproses, tetap update timestamp agar tidak berjalan terus menerus
        await updateDoc(lastCheckRef, { timestamp: now });
        console.log('Tidak ada perangkat yang memasuki masa purna tugas saat ini.');
        return { processed: 0, skipped: false };
    }
};

