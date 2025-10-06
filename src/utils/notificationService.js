import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

/**
 * [REVISED] Membuat notifikasi yang ditargetkan untuk peran 'admin_kecamatan'.
 * Ini adalah cara yang benar bagi Admin Desa untuk memberitahu semua Admin Kecamatan.
 * @param {string} message - Pesan notifikasi.
 * @param {string} link - Tautan tujuan saat notifikasi diklik.
 * @param {object} sender - Objek currentUser dari AuthContext.
 */
export const createNotificationForAdmins = async (message, link, sender) => {
  if (!sender) {
    console.error("Informasi pengirim diperlukan untuk membuat notifikasi berbasis peran.");
    return;
  }
  try {
    await addDoc(collection(db, "notifications"), {
      message: message,
      link: link,
      targetRole: 'admin_kecamatan', // Secara spesifik menargetkan peran ini
      readBy: [], // Array untuk menyimpan UID admin yang telah membacanya
      timestamp: new Date(),
      sender: {
        desa: sender.desa || 'Kecamatan',
        nama: sender.nama || 'Sistem'
      }
    });
  } catch (error) {
    console.error("Gagal membuat notifikasi untuk admin:", error);
  }
};

/**
 * [BARU] Membuat notifikasi untuk semua admin dari desa tertentu.
 * Ini digunakan untuk umpan balik dari Admin Kecamatan ke Admin Desa.
 * @param {string} targetDesa - Nama desa yang adminnya akan menerima notifikasi.
 * @param {string} message - Pesan notifikasi.
 * @param {string} link - Tautan tujuan saat notifikasi diklik.
 */
export const createNotificationForDesaAdmins = async (targetDesa, message, link) => {
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

    // Kirim notifikasi ke setiap admin yang ditemukan
    querySnapshot.forEach(async (userDoc) => {
      await addDoc(collection(db, "notifications"), {
        userId: userDoc.id,
        message: message,
        link: link,
        readStatus: false,
        timestamp: new Date(),
      });
    });
  } catch (error) {
    console.error(`Gagal membuat notifikasi untuk admin desa ${targetDesa}:`, error);
  }
};

/**
 * Membuat notifikasi untuk satu pengguna spesifik berdasarkan UID mereka.
 * @param {string} targetUserId - UID pengguna yang akan menerima notifikasi.
 * @param {string} message - Pesan notifikasi.
 * @param {string} link - Tautan tujuan saat notifikasi diklik.
 */
export const createNotificationForUser = async (targetUserId, message, link) => {
  if (!targetUserId) {
    console.error("Tidak ada targetUserId yang diberikan untuk notifikasi.");
    return;
  }
  try {
    await addDoc(collection(db, "notifications"), {
      userId: targetUserId,
      message: message,
      link: link,
      readStatus: false,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error(`Gagal membuat notifikasi untuk pengguna ${targetUserId}:`, error);
  }
};

