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
    let adminSnapshot;
    try {
      adminSnapshot = await getDocs(adminQuery);
    } catch (err) {
      // Likely permission-denied when listing users from client; fail gracefully
      if (err && err.code && err.code === 'permission-denied') {
        console.info('Tidak dapat mengambil daftar admin kecamatan (izin ditolak) — notifikasi dibatalkan.');
        return;
      }
      throw err; // rethrow other errors
    }

    if (!adminSnapshot || adminSnapshot.empty) {
      console.log("Tidak ditemukan admin kecamatan untuk dikirimi notifikasi.");
      return;
    }

    adminSnapshot.forEach(async (adminDoc) => {
      try {
        await addDoc(collection(db, "notifications"), {
          userId: adminDoc.id,
          message: message,
          link: link,
          readStatus: false,
          timestamp: new Date(),
        });
      } catch (err) {
        // Ignore notification write failures per-recipient but log at info level
        console.info(`Tidak dapat membuat notifikasi untuk ${adminDoc.id} (diabaikan):`, err && err.message ? err.message : err);
      }
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

/**
 * Generic helper used by pages: createNotification(message, link, target)
 * - if target === 'kecamatan' -> notify all admin_kecamatan
 * - if target is a desa string -> notify all users with role 'admin_desa' and matching desa
 */
export const createNotification = async (message, link, target) => {
  if (!target) return createNotificationForAdmins(message, link);
  try {
    if (target === 'kecamatan') {
      return createNotificationForAdmins(message, link);
    }
    // Otherwise assume target is a desa name -> notify admin_kecamatan OR notify admin_desa of that desa
    const adminQuery = query(collection(db, 'users'), where('desa', '==', target));
    let snapshot;
    try {
      snapshot = await getDocs(adminQuery);
    } catch (err) {
      if (err && err.code === 'permission-denied') {
        console.info('Tidak dapat mengambil daftar pengguna untuk notifikasi (izin ditolak) — notifikasi dibatalkan.');
        return;
      }
      throw err;
    }
    if (!snapshot || snapshot.empty) return;
    snapshot.forEach(async (u) => {
      try {
        await addDoc(collection(db, 'notifications'), { userId: u.id, message, link, readStatus: false, timestamp: new Date() });
      } catch (err) {
        console.info('Gagal membuat notifikasi untuk pengguna (diabaikan):', err && err.message ? err.message : err);
      }
    });
  } catch (err) {
    console.error('createNotification error:', err);
  }
};
