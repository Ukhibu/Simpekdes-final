import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

/**
 * [REVISED] Membuat notifikasi yang ditargetkan untuk peran 'admin_kecamatan'.
 * Digunakan saat Admin Desa menambahkan aset atau mengirim laporan.
 * Mendukung tipe notifikasi khusus (seperti 'aset') dan data tambahan (koordinat).
 * * @param {string} message - Pesan notifikasi.
 * @param {string} link - Tautan tujuan saat notifikasi diklik.
 * @param {object} sender - Objek currentUser (harus ada sender.desa & sender.nama).
 * @param {string} [type='general'] - Tipe notifikasi ('general', 'aset', 'surat').
 * @param {object} [additionalData=null] - Data tambahan (misal: { assetId, coordinates }).
 */
export const createNotificationForAdmins = async (message, link, sender, type = 'general', additionalData = null) => {
  if (!sender) {
    console.error("Informasi pengirim diperlukan untuk membuat notifikasi berbasis peran.");
    return;
  }
  try {
    await addDoc(collection(db, "notifications"), {
      message: message,
      link: link || '#',
      title: 'Info Desa', // Default title
      targetRole: 'admin_kecamatan', // Target audience
      isRoleBased: true, // Flag penting untuk Header.js
      
      // Inisialisasi array untuk fitur Header.js
      readBy: [], 
      deletedBy: [], 
      savedBy: [],
      
      type: type, // 'aset' akan memicu tombol "Lihat Peta"
      data: additionalData, // Menyimpan koordinat atau ID aset
      
      timestamp: serverTimestamp(),
      sender: {
        desa: sender.desa || 'Desa',
        nama: sender.nama || 'Sistem',
        role: sender.role || 'user'
      }
    });
  } catch (error) {
    console.error("Gagal membuat notifikasi untuk admin:", error);
  }
};

/**
 * [BARU] Membuat notifikasi untuk semua admin dari desa tertentu.
 * Digunakan untuk umpan balik dari Admin Kecamatan ke Admin Desa.
 * * @param {string} targetDesa - Nama desa yang adminnya akan menerima notifikasi.
 * @param {string} message - Pesan notifikasi.
 * @param {string} link - Tautan tujuan.
 * @param {string} [type='general'] - Tipe notifikasi.
 */
export const createNotificationForDesaAdmins = async (targetDesa, message, link, type = 'general') => {
  if (!targetDesa) {
    console.error("Desa target harus ditentukan untuk notifikasi.");
    return;
  }
  try {
    // Cari semua pengguna yang merupakan admin dari desa target
    const q = query(collection(db, 'users'), where('role', '==', 'admin_desa'), where('desa', '==', targetDesa));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log(`Tidak ditemukan admin untuk desa ${targetDesa}.`);
      return;
    }

    // Menggunakan Batch Write agar lebih efisien dan atomik (semua terkirim atau gagal semua)
    // Namun untuk kesederhanaan loop async juga oke, tapi array promises lebih cepat
    const promises = querySnapshot.docs.map(doc => {
      return addDoc(collection(db, "notifications"), {
        userId: doc.id, // Target spesifik user
        message: message,
        link: link || '#',
        title: 'Info Kecamatan',
        
        readStatus: false, // Flag single user
        isRoleBased: false,
        
        // Inisialisasi array fitur
        deletedBy: [],
        savedBy: [],
        
        type: type,
        timestamp: serverTimestamp(),
      });
    });

    await Promise.all(promises);
    
  } catch (error) {
    console.error(`Gagal membuat notifikasi untuk admin desa ${targetDesa}:`, error);
  }
};

/**
 * Membuat notifikasi untuk satu pengguna spesifik berdasarkan UID.
 * * @param {string} targetUserId - UID pengguna penerima.
 * @param {string} message - Pesan.
 * @param {string} link - Tautan.
 * @param {string} [type='general'] - Tipe ('aset', dll).
 * @param {object} [additionalData=null] - Data tambahan.
 */
export const createNotificationForUser = async (targetUserId, message, link, type = 'general', additionalData = null) => {
  if (!targetUserId) {
    console.error("Tidak ada targetUserId yang diberikan untuk notifikasi.");
    return;
  }
  try {
    await addDoc(collection(db, "notifications"), {
      userId: targetUserId,
      message: message,
      link: link || '#',
      title: 'Pemberitahuan',
      
      readStatus: false,
      isRoleBased: false,
      
      deletedBy: [],
      savedBy: [],
      
      type: type,
      data: additionalData,
      
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Gagal membuat notifikasi untuk pengguna ${targetUserId}:`, error);
  }
};