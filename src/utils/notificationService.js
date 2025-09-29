import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

/**
 * Membuat notifikasi untuk semua pengguna dengan peran 'admin_kecamatan'.
 * @param {string} message - Pesan notifikasi.
 * @param {string} link - Tautan tujuan saat notifikasi diklik.
 */
export const createNotificationForAdmins = async (message, link) => {
  try {
    const adminQuery = query(collection(db, "users"), where("role", "==", "admin_kecamatan"));
    const adminSnapshot = await getDocs(adminQuery);
    
    if (adminSnapshot.empty) {
      console.log("Tidak ditemukan admin kecamatan untuk dikirimi notifikasi.");
      return;
    }

    adminSnapshot.forEach(async (adminDoc) => {
      await addDoc(collection(db, "notifications"), {
        userId: adminDoc.id,
        message: message,
        link: link,
        readStatus: false,
        timestamp: new Date(),
      });
    });
  } catch (error) {
    console.error("Gagal membuat notifikasi untuk admin:", error);
  }
};

/**
 * Membuat notifikasi untuk satu pengguna spesifik.
 * @param {string} targetUserId - UID dari pengguna yang akan menerima notifikasi.
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
