import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext'; 
import { db } from '../../firebase'; 
import { 
  doc, updateDoc, arrayUnion, arrayRemove, writeBatch 
} from 'firebase/firestore'; 
// [PERBAIKAN] Menambahkan FiXSquare ke import
import { 
  FiMenu, FiMoon, FiSun, FiLogOut, FiBell, FiUser, 
  FiTrash2, FiBookmark, FiEye, FiMap, FiCheckSquare, FiX, FiInfo, FiCheckCircle, FiXCircle, FiXSquare
} from 'react-icons/fi';
import ConfirmationModal from '../common/ConfirmationModal'; 
import Modal from '../common/Modal'; 
// [PERBAIKAN] Path import InputField diperbaiki (dari ../components/common menjadi ../common)
import InputField from '../common/InputField';
import { createNotificationForDesaAdmins } from '../../utils/notificationService';

/**
 * Komponen Item Notifikasi Individual
 */
const NotificationItem = ({ notif, onMarkRead, onDelete, onSave, onViewMap, onVerify, onApproveBudget, onRejectBudget, currentUser }) => {
  const isAsetNotif = notif.type === 'aset' || notif.category === 'aset';
  const isVerifikasiNotif = notif.type === 'verifikasi_sk'; 
  const isBudgetNotif = notif.type === 'pengesahan_anggaran';
  
  const isSaved = (notif.savedBy && notif.savedBy.includes(currentUser.uid)) || notif.isSaved === true;
  
  const isRead = notif.isRoleBased 
      ? (notif.readBy && notif.readBy.includes(currentUser.uid))
      : notif.readStatus;

  return (
    <li className={`relative p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200 ${!isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Icon Indikator Tipe */}
        <div className={`mt-1 p-2 rounded-full shrink-0 ${
          isAsetNotif ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300' : 
          isVerifikasiNotif || isBudgetNotif ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300' :
          'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300'
        }`}>
          {isAsetNotif ? <FiInfo size={18} /> : 
           isVerifikasiNotif ? <FiCheckCircle size={18} /> : 
           isBudgetNotif ? <FiCheckSquare size={18} /> : 
           <FiBell size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header Notifikasi */}
          <div className="flex justify-between items-start">
            <h4 className={`text-sm font-semibold truncate pr-2 ${!isRead ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
              {notif.title || 'Notifikasi Baru'}
            </h4>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(notif); }}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Hapus Notifikasi"
            >
              <FiX size={14} />
            </button>
          </div>

          {/* Pesan Body */}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
            {notif.message}
          </p>

          {/* Timestamp */}
          <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
             {notif.timestamp?.toDate ? notif.timestamp.toDate().toLocaleDateString('id-ID', { 
               day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
             }) : 'Baru saja'}
             {isSaved && <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[9px] font-bold">DISIMPAN</span>}
          </p>

          {/* Action Buttons Container */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            
            {/* Logic Khusus Verifikasi SK */}
            {isVerifikasiNotif && (
                <button
                    onClick={() => onVerify(notif)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm transition-all w-full justify-center md:w-auto"
                >
                    <FiCheckCircle size={12} /> Verifikasi Data
                </button>
            )}

            {/* Logic Khusus Pengesahan Anggaran */}
            {isBudgetNotif && (
                <div className="flex gap-2 w-full md:w-auto">
                    {/* Tombol Hijau: Sahkan (Memicu Modal di Header) */}
                    <button
                        onClick={() => onApproveBudget(notif)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm transition-all"
                        title="Sahkan Anggaran"
                    >
                        <FiCheckSquare size={14} className="mr-1" /> Sahkan
                    </button>
                    {/* Tombol Merah: Tolak (Memicu Navigasi ke Page) */}
                    <button
                        onClick={() => onRejectBudget(notif)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-all"
                        title="Tolak Anggaran"
                    >
                        <FiXSquare size={14} className="mr-1" /> Tolak
                    </button>
                </div>
            )}

            {isAsetNotif && (
              <>
                <button
                  onClick={() => onMarkRead(notif)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-all"
                >
                  <FiEye size={12} /> Lihat Detail
                </button>
                <button
                  onClick={() => onViewMap(notif)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm transition-all"
                >
                  <FiMap size={12} /> Lihat Peta
                </button>
              </>
            )} 
            
            {/* Logic Standar */}
            {!isVerifikasiNotif && !isAsetNotif && !isBudgetNotif && notif.link && (
                <button
                  onClick={() => onMarkRead(notif)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/50 rounded-md transition-all"
                >
                  <FiEye size={12} /> Lihat Data
                </button>
            )}

            {/* Tombol Aksi Umum (Simpan & Hapus) */}
            <div className="flex items-center gap-1 ml-auto">
              <button 
                onClick={() => onSave(notif)}
                className={`p-1.5 rounded-md transition-colors ${
                  isSaved 
                    ? 'text-yellow-600 bg-yellow-100 hover:bg-yellow-200' 
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
                title={isSaved ? "Lepas Simpanan" : "Simpan Notif"}
              >
                <FiBookmark size={14} className={isSaved ? "fill-current" : ""} />
              </button>
              
              <button 
                onClick={() => onDelete(notif)}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Hapus"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

const NotificationBell = () => {
    const { currentUser, notifications, markNotificationAsRead } = useAuth(); 
    const { showNotification } = useNotification(); 
    const [isOpen, setIsOpen] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);
    
    // State Modal
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [notifToVerify, setNotifToVerify] = useState(null);
    const [isApproveBudgetModalOpen, setIsApproveBudgetModalOpen] = useState(false);
    const [notifToApprove, setNotifToApprove] = useState(null);
    const [isRejectBudgetModalOpen, setIsRejectBudgetModalOpen] = useState(false);
    const [notifToReject, setNotifToReject] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const navigate = useNavigate();
    const bellRef = useRef(null);

    const processedNotifications = useMemo(() => {
        if (!currentUser || !notifications) return [];
        return notifications.filter(n => {
            const isDeleted = n.deletedBy && n.deletedBy.includes(currentUser.uid);
            if (isDeleted) return false;
            const isSaved = (n.savedBy && n.savedBy.includes(currentUser.uid)) || n.isSaved === true;
            const isRead = n.isRoleBased 
                ? (n.readBy && n.readBy.includes(currentUser.uid))
                : n.readStatus;
            if (isRead && !isSaved) return false; 
            return true;
        }).sort((a, b) => {
            const aSaved = (a.savedBy && a.savedBy.includes(currentUser.uid)) || a.isSaved === true;
            const bSaved = (b.savedBy && b.savedBy.includes(currentUser.uid)) || b.isSaved === true;
            if (aSaved !== bSaved) return bSaved ? 1 : -1;
            const timeA = a.timestamp?.toMillis() || 0;
            const timeB = b.timestamp?.toMillis() || 0;
            return timeB - timeA;
        });
    }, [notifications, currentUser]);

    const unreadCount = useMemo(() => {
        if (!currentUser || !notifications) return 0;
        return notifications.filter(n => {
             const isDeleted = n.deletedBy && n.deletedBy.includes(currentUser.uid);
             if (isDeleted) return false;
             const isRead = n.isRoleBased 
                ? (n.readBy && n.readBy.includes(currentUser.uid))
                : n.readStatus;
             return !isRead;
        }).length;
    }, [notifications, currentUser]);

    const handleDelete = async (notification) => {
        if (!currentUser) return;
        try {
            const notifRef = doc(db, 'notifications', notification.id);
            await updateDoc(notifRef, {
                deletedBy: arrayUnion(currentUser.uid)
            });
        } catch (error) {
            console.error("Gagal menghapus notifikasi:", error);
        }
    };

    const handleSave = async (notification) => {
        if (!currentUser) return;
        try {
            const notifRef = doc(db, 'notifications', notification.id);
            const isSavedNow = (notification.savedBy && notification.savedBy.includes(currentUser.uid)) || notification.isSaved === true;
            if (isSavedNow) {
                await updateDoc(notifRef, { savedBy: arrayRemove(currentUser.uid), isSaved: false });
            } else {
                await updateDoc(notifRef, { savedBy: arrayUnion(currentUser.uid), isSaved: true });
            }
        } catch (error) {
            console.error("Gagal menyimpan notifikasi:", error);
        }
    };

    const handleMarkAllRead = async () => {
        if (!currentUser || unreadCount === 0) return;
        setLocalLoading(true);
        try {
            const batch = writeBatch(db);
            let updateCount = 0;
            notifications.forEach(n => {
                const isRead = n.isRoleBased ? (n.readBy && n.readBy.includes(currentUser.uid)) : n.readStatus;
                if (!isRead) {
                    const notifRef = doc(db, 'notifications', n.id);
                    if (n.isRoleBased) {
                        batch.update(notifRef, { readBy: arrayUnion(currentUser.uid) });
                    } else {
                        batch.update(notifRef, { readStatus: true });
                    }
                    updateCount++;
                }
            });
            if (updateCount > 0) await batch.commit();
        } catch (error) {
            console.error("Gagal update semua notifikasi:", error);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleActionClick = async (notification) => {
        if (markNotificationAsRead) {
            markNotificationAsRead(notification.id);
        } else {
            const notifRef = doc(db, 'notifications', notification.id);
            if (notification.isRoleBased) {
                await updateDoc(notifRef, { readBy: arrayUnion(currentUser.uid) });
            } else {
                await updateDoc(notifRef, { readStatus: true });
            }
        }
        if (notification.link) navigate(notification.link);
        setIsOpen(false);
    };

    const handleViewMap = async (notification) => {
        if (markNotificationAsRead) markNotificationAsRead(notification.id);
        if (notification.data && notification.data.coordinates) {
            const { lat, lng } = notification.data.coordinates;
            window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
        } else {
            showNotification("Data koordinat tidak ditemukan pada notifikasi ini.", "warning");
        }
        setIsOpen(false);
    };

    // --- VERIFIKASI SK ---
    const handleVerifyClick = (notification) => {
        setNotifToVerify(notification);
        setIsVerifyModalOpen(true);
        setIsOpen(false);
    };

    const executeVerify = async () => {
        if (!currentUser || !notifToVerify) return;
        setLocalLoading(true);
        try {
            if (notifToVerify.data && notifToVerify.data.docId) {
                const docRef = doc(db, 'efile', notifToVerify.data.docId);
                await updateDoc(docRef, { status: 'terverifikasi', verifiedBy: currentUser.uid, verifiedAt: new Date() });
            } else {
                throw new Error("ID Dokumen tidak ditemukan dalam notifikasi.");
            }
            if (markNotificationAsRead) {
                markNotificationAsRead(notifToVerify.id);
            } else {
                const notifRef = doc(db, 'notifications', notifToVerify.id);
                if (notifToVerify.isRoleBased) {
                    await updateDoc(notifRef, { readBy: arrayUnion(currentUser.uid) });
                } else {
                    await updateDoc(notifRef, { readStatus: true });
                }
            }
            showNotification("Data Berhasil Diverifikasi!", "success");
            if (notifToVerify.link) navigate(notifToVerify.link);
        } catch (error) {
            showNotification(`Gagal memverifikasi: ${error.message}`, "error");
        } finally {
            setLocalLoading(false);
            setIsVerifyModalOpen(false); 
            setNotifToVerify(null);
        }
    };

    // --- PENGESAHAN ANGGARAN (HIJAU) ---
    const handleApproveBudgetClick = (notification) => {
        setNotifToApprove(notification);
        setIsApproveBudgetModalOpen(true);
        setIsOpen(false);
    }

    const executeApproveBudget = async () => {
        if (!currentUser || !notifToApprove) return;
        setLocalLoading(true);
        try {
            if (notifToApprove.data && notifToApprove.data.anggaranId) {
                const docRef = doc(db, 'anggaran_tahunan', notifToApprove.data.anggaranId);
                await updateDoc(docRef, { status: 'Disahkan', alasanPenolakan: null });
                const message = `Anggaran "${notifToApprove.data.uraian}" (${notifToApprove.data.tahun}) telah DISAHKAN.`;
                const link = `/app/keuangan/penganggaran`;
                await createNotificationForDesaAdmins(notifToApprove.data.desa, message, link);
            } else {
                throw new Error("ID Anggaran tidak ditemukan.");
            }
            if (markNotificationAsRead) {
                markNotificationAsRead(notifToApprove.id);
            } else {
                const notifRef = doc(db, 'notifications', notifToApprove.id);
                if (notifToApprove.isRoleBased) {
                    await updateDoc(notifRef, { readBy: arrayUnion(currentUser.uid) });
                } else {
                    await updateDoc(notifRef, { readStatus: true });
                }
            }
            showNotification("Anggaran Berhasil Disahkan!", "success");
            if (notifToApprove.data && notifToApprove.data.desa) {
                navigate(`/app/keuangan/penganggaran?desa=${notifToApprove.data.desa}&tahun=${notifToApprove.data.tahun || new Date().getFullYear()}`);
            } else if (notifToApprove.link) {
                navigate(notifToApprove.link);
            }
        } catch (error) {
            showNotification(`Gagal: ${error.message}`, "error");
        } finally {
            setLocalLoading(false);
            setIsApproveBudgetModalOpen(false);
            setNotifToApprove(null);
        }
    };

    // --- PENOLAKAN ANGGARAN (MERAH) ---
    const handleRejectBudgetClick = async (notification) => {
        if (markNotificationAsRead) {
            markNotificationAsRead(notification.id);
        } else {
            const notifRef = doc(db, 'notifications', notification.id);
            if (notification.isRoleBased) {
                await updateDoc(notifRef, { readBy: arrayUnion(currentUser.uid) });
            } else {
                await updateDoc(notifRef, { readStatus: true });
            }
        }
        if (notification.data && notification.data.anggaranId) {
            const desa = notification.data.desa || '';
            const tahun = notification.data.tahun || new Date().getFullYear();
            const rejectId = notification.data.anggaranId;
            navigate(`/app/keuangan/penganggaran?desa=${desa}&tahun=${tahun}&reject_id=${rejectId}`);
        } else {
            navigate(notification.link || '/app/keuangan/penganggaran');
        }
        setIsOpen(false);
    };

    // [PERBAIKAN] Definisi submitRejectBudget untuk modal penolakan di Header (jika digunakan langsung di header)
    // Namun dalam desain sebelumnya, logika penolakan langsung redirect ke halaman penganggaran.
    // Tetapi jika Anda ingin modal penolakan muncul DI HEADER juga, berikut kodenya:
    const submitRejectBudget = async () => {
        if (!currentUser || !notifToReject || !rejectReason.trim()) {
            showNotification("Alasan penolakan wajib diisi.", "error");
            return;
        }
        setLocalLoading(true);
        try {
            if (notifToReject.data && notifToReject.data.anggaranId) {
                const docRef = doc(db, 'anggaran_tahunan', notifToReject.data.anggaranId);
                await updateDoc(docRef, {
                    status: 'Ditolak',
                    alasanPenolakan: rejectReason
                });

                const message = `Anggaran "${notifToReject.data.uraian}" (${notifToReject.data.tahun}) DITOLAK: ${rejectReason}`;
                const link = `/app/keuangan/penganggaran`;
                await createNotificationForDesaAdmins(notifToReject.data.desa, message, link);
            } else {
                throw new Error("ID Anggaran tidak ditemukan.");
            }

            if (markNotificationAsRead) {
                markNotificationAsRead(notifToReject.id);
            } else {
                const notifRef = doc(db, 'notifications', notifToReject.id);
                if (notifToReject.isRoleBased) {
                    await updateDoc(notifRef, { readBy: arrayUnion(currentUser.uid) });
                } else {
                    await updateDoc(notifRef, { readStatus: true });
                }
            }

            showNotification("Anggaran Ditolak.", "success");
            if (notifToReject.link) navigate(notifToReject.link);

        } catch (error) {
            console.error("Gagal menolak:", error);
            showNotification(`Gagal: ${error.message}`, "error");
        } finally {
            setLocalLoading(false);
            setIsRejectBudgetModalOpen(false);
            setNotifToReject(null);
            setRejectReason('');
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (bellRef.current && !bellRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [bellRef]);

    return (
        <>
            <div className="relative" ref={bellRef}>
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="relative p-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                    <FiBell size={22} className={unreadCount > 0 ? "animate-swing" : ""} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-800">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden transform origin-top-right transition-all animation-fade-in-down">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800">
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Notifikasi</h3>
                            {unreadCount > 0 && (
                                <button 
                                    onClick={handleMarkAllRead}
                                    disabled={localLoading}
                                    className={`flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors ${localLoading ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    <FiCheckSquare size={12} /> 
                                    {localLoading ? 'Memproses...' : 'Tandai semua dibaca'}
                                </button>
                            )}
                        </div>

                        <ul className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                            {processedNotifications.length > 0 ? (
                                processedNotifications.map(notif => (
                                    <NotificationItem 
                                        key={notif.id} 
                                        notif={notif}
                                        currentUser={currentUser}
                                        onMarkRead={handleActionClick}
                                        onViewMap={handleViewMap}
                                        onVerify={handleVerifyClick} 
                                        onApproveBudget={handleApproveBudgetClick}
                                        onRejectBudget={handleRejectBudgetClick}
                                        onDelete={handleDelete}
                                        onSave={handleSave}
                                    />
                                ))
                            ) : (
                                <li className="py-12 px-6 flex flex-col items-center text-center text-gray-400">
                                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-3">
                                        <FiBell size={32} className="opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Tidak ada notifikasi aktif</p>
                                    <p className="text-xs mt-1">Pesan lama telah diarsipkan otomatis.</p>
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* --- MODAL KONFIRMASI VERIFIKASI SK (PORTAL) --- */}
            {createPortal(
                <ConfirmationModal
                    isOpen={isVerifyModalOpen}
                    onClose={() => setIsVerifyModalOpen(false)}
                    onConfirm={executeVerify}
                    isLoading={localLoading}
                    title="Verifikasi Dokumen SK"
                    message={`Apakah Anda yakin ingin memverifikasi dokumen SK untuk "${notifToVerify?.data?.entityName || 'entitas ini'}" secara otomatis? Status dokumen akan berubah menjadi Terverifikasi.`}
                    confirmText="Ya, Verifikasi"
                    cancelText="Batal"
                    variant="primary" 
                />,
                document.body
            )}

            {/* --- MODAL KONFIRMASI SAHKAN ANGGARAN (PORTAL) --- */}
            {createPortal(
                <ConfirmationModal
                    isOpen={isApproveBudgetModalOpen}
                    onClose={() => setIsApproveBudgetModalOpen(false)}
                    onConfirm={executeApproveBudget}
                    isLoading={localLoading}
                    title="Sahkan Anggaran"
                    message={`Apakah Anda yakin ingin MENGESAHKAN anggaran "${notifToApprove?.data?.uraian || 'ini'}"? Status akan berubah menjadi Disahkan.`}
                    confirmText="Ya, Sahkan"
                    cancelText="Batal"
                    variant="success" 
                />,
                document.body
            )}

            {/* --- MODAL PENOLAKAN ANGGARAN (PORTAL + INPUT) --- */}
            {createPortal(
                <Modal 
                    isOpen={isRejectBudgetModalOpen} 
                    onClose={() => setIsRejectBudgetModalOpen(false)} 
                    title="Tolak Pengajuan Anggaran"
                >
                    <div className="space-y-4">
                        <p className="text-gray-700 dark:text-gray-300">
                            Anda akan menolak pengajuan anggaran: <strong>{notifToReject?.data?.uraian}</strong>
                        </p>
                        <InputField
                            label="Alasan Penolakan"
                            type="textarea"
                            name="rejectReason"
                            placeholder="Jelaskan alasan penolakan..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            required
                        />
                        <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                            <button 
                                onClick={() => setIsRejectBudgetModalOpen(false)} 
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md text-gray-800 dark:text-white"
                                disabled={localLoading}
                            >
                                Batal
                            </button>
                            <button 
                                onClick={submitRejectBudget}
                                className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center"
                                disabled={localLoading}
                            >
                                {localLoading ? 'Memproses...' : 'Tolak Pengajuan'}
                            </button>
                        </div>
                    </div>
                </Modal>,
                document.body
            )}
        </>
    );
};

const Header = ({ pageTitle, onMenuClick, onProfileClick }) => {
    const { currentUser, logout, theme, toggleTheme } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileMenuRef = useRef(null);
    const navigate = useNavigate();

    const getInitials = (name) => {
        if (!name) return '...';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [profileMenuRef]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Gagal logout:", error);
        }
    };

    return (
        <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onMenuClick} 
                        className="p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none md:hidden transition-colors"
                    >
                        <FiMenu size={24} />
                    </button>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-white tracking-tight leading-tight">
                            {pageTitle || 'Dashboard'}
                        </h1>
                        <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Sistem Informasi Manajemen Pemerintahan Desa
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 md:gap-5">
                    <NotificationBell />

                    <div className="relative" ref={profileMenuRef}>
                       <button 
                           onClick={() => setIsProfileOpen(!isProfileOpen)} 
                           className="flex items-center gap-3 group focus:outline-none"
                       >
                           <div className="hidden md:block text-right">
                               <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition-colors">
                                   {currentUser?.nama || 'Pengguna'}
                               </p>
                               <span className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-blue-700 bg-blue-100 dark:text-blue-200 dark:bg-blue-900/40 rounded-full">
                                   {currentUser?.role === 'admin_kecamatan' ? 'Kecamatan' : (currentUser?.desa || 'Admin')}
                               </span>
                           </div>
                           
                           <div className="relative">
                               {currentUser?.foto_url ? (
                                   <img 
                                       src={currentUser.foto_url} 
                                       alt="Profil" 
                                       className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm group-hover:border-blue-200 transition-all" 
                                   />
                               ) : (
                                   <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center rounded-full font-bold text-sm shadow-md group-hover:shadow-lg transition-all">
                                       {getInitials(currentUser?.nama)}
                                   </div>
                               )}
                               <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                           </div>
                       </button>
                       
                       <div className={`absolute right-0 mt-3 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl ring-1 ring-black ring-opacity-5 z-50 transform transition-all duration-200 origin-top-right ${isProfileOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                           <div className="md:hidden px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">
                               <p className="font-semibold text-gray-900 dark:text-white">{currentUser?.nama}</p>
                               <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser?.email}</p>
                           </div>

                           <div className="p-2">
                               <button 
                                   onClick={() => {
                                       onProfileClick();
                                       setIsProfileOpen(false);
                                   }} 
                                   className="w-full text-left px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700/50 hover:text-blue-600 rounded-lg flex items-center gap-3 transition-colors"
                               >
                                   <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md">
                                        <FiUser size={16} />
                                   </div>
                                   Edit Profil
                               </button>

                               <div className="px-3 py-2.5 flex items-center justify-between">
                                   <div className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                                       <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-md">
                                            {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
                                       </div>
                                       <span>{theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}</span>
                                   </div>
                                   <button 
                                       onClick={(e) => {
                                           e.stopPropagation();
                                           toggleTheme();
                                       }}
                                       className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'}`}
                                   >
                                       <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                                   </button>
                               </div>
                           </div>

                           <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                               <button 
                                   onClick={handleLogout} 
                                   className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-3 transition-colors"
                               >
                                   <div className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-md">
                                        <FiLogOut size={16} />
                                   </div>
                                   Keluar Aplikasi
                               </button>
                           </div>
                       </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;