import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { useAuth } from '../context/AuthContext'; // Import useAuth untuk mendapatkan current user
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import SkeletonLoader from '../components/common/SkeletonLoader';
import { 
    FiTrash2, FiKey, FiEye, FiEyeOff, FiPlus, FiSearch, 
    FiUser, FiMail, FiMapPin, FiShield, FiMoreVertical, FiActivity, FiClock 
} from 'react-icons/fi';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

// --- Styles & Animations ---
const customStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.4s ease-out forwards;
  }
  .glass-effect {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
  }
  .dark .glass-effect {
    background: rgba(31, 41, 55, 0.95);
  }
`;

const ManajemenAdmin = () => {
    const { currentUser } = useAuth(); // Mendapatkan user yang sedang login
    const [adminList, setAdminList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const { showNotification } = useNotification();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedRow, setHighlightedRow] = useState(null);

    // State untuk Modal Konfirmasi (Unified)
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        type: null, // 'delete' | 'reset'
        title: '',
        message: '',
        data: null
    });

    // --- 1. Heartbeat System (Presence) ---
    // Memperbarui status 'lastSeen' user saat ini setiap menit
    useEffect(() => {
        if (!currentUser) return;

        const updatePresence = async () => {
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    lastSeen: serverTimestamp(),
                    isOnline: true
                });
            } catch (error) {
                console.error("Gagal memperbarui status online:", error);
            }
        };

        // Update segera saat komponen di-mount
        updatePresence();

        // Setup interval untuk update setiap 60 detik
        const interval = setInterval(updatePresence, 60000);

        return () => clearInterval(interval);
    }, [currentUser]);

    // --- Fetch Data Admin ---
    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "admin_desa"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAdminList(list);
            // Artificial delay for smooth loading transition
            setTimeout(() => setLoading(false), 500);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => {
                setHighlightedRow(null);
                searchParams.delete('highlight');
                setSearchParams(searchParams, { replace: true });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, setSearchParams]);

    // --- Filtered List ---
    const filteredAdminList = useMemo(() => {
        return adminList.filter(admin => 
            admin.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
            admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            admin.desa.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [adminList, searchTerm]);

    // --- Handlers ---

    const handleOpenModal = () => {
        setFormData({ nama: '', email: '', password: '', desa: DESA_LIST[0] });
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.password || !formData.nama || !formData.desa) {
            showNotification('Semua field wajib diisi.', 'error');
            return;
        }
        setIsSubmitting(true);

        // Menggunakan secondary app untuk membuat user tanpa log out user yang sedang aktif
        const secondaryAppConfig = auth.app.options;
        const secondaryApp = initializeApp(secondaryAppConfig, `secondary-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
            const newUser = userCredential.user;

            await setDoc(doc(db, "users", newUser.uid), {
                nama: formData.nama,
                email: formData.email,
                desa: formData.desa,
                role: "admin_desa",
                foto_url: null,
                createdAt: new Date().toISOString(),
                lastSeen: serverTimestamp() // Inisialisasi lastSeen
            });
            
            showNotification(`Admin untuk Desa ${formData.desa} berhasil dibuat.`, 'success');
            handleCloseModal();
        } catch (error) {
            console.error("Error creating admin:", error);
            let errorMessage = "Terjadi kesalahan.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Email ini sudah terdaftar. Silakan gunakan email lain.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password terlalu lemah. Gunakan minimal 6 karakter.";
            }
            showNotification(`Gagal: ${errorMessage}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // --- Confirmation Handlers ---

    const openDeleteConfirm = (admin) => {
        setConfirmModal({
            isOpen: true,
            type: 'delete',
            title: 'Hapus Akses Admin?',
            message: `Anda akan menghapus akses admin untuk "${admin.nama}". Data user di database akan dihapus, namun akun autentikasi mungkin masih tersisa di Firebase Auth. Lanjutkan?`,
            data: admin
        });
    };

    const openResetConfirm = (email) => {
        setConfirmModal({
            isOpen: true,
            type: 'reset',
            title: 'Kirim Reset Password?',
            message: `Sistem akan mengirimkan tautan untuk mengatur ulang kata sandi ke email "${email}". Pastikan email tersebut aktif.`,
            data: email
        });
    };

    const handleConfirmAction = async () => {
        setIsSubmitting(true);
        try {
            if (confirmModal.type === 'delete') {
                await deleteDoc(doc(db, 'users', confirmModal.data.id));
                showNotification(`Akses admin ${confirmModal.data.nama} berhasil dicabut.`, 'success');
            } else if (confirmModal.type === 'reset') {
                await sendPasswordResetEmail(auth, confirmModal.data);
                showNotification(`Email reset password terkirim ke ${confirmModal.data}.`, 'success');
            }
        } catch (error) {
            showNotification(`Gagal: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setConfirmModal({ isOpen: false, type: null, title: '', message: '', data: null });
        }
    };

    // --- Helpers Visual ---

    const getGradient = (name) => {
        const colors = [
            'from-blue-400 to-indigo-500',
            'from-emerald-400 to-teal-500',
            'from-orange-400 to-red-500',
            'from-purple-400 to-pink-500',
            'from-cyan-400 to-blue-500'
        ];
        const index = name.length % colors.length;
        return colors[index];
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // --- Logic Status Online ---
    const getOnlineStatus = (lastSeenTimestamp) => {
        if (!lastSeenTimestamp) return { isOnline: false, text: 'Offline' };
        
        const now = new Date();
        // Konversi Firestore Timestamp ke JS Date
        const lastSeen = lastSeenTimestamp.toDate ? lastSeenTimestamp.toDate() : new Date(lastSeenTimestamp);
        const diffInMinutes = Math.floor((now - lastSeen) / 60000);

        // Anggap online jika aktivitas terakhir < 5 menit yang lalu
        if (diffInMinutes < 5) {
            return { isOnline: true, text: 'Sedang Aktif' };
        } else if (diffInMinutes < 60) {
            return { isOnline: false, text: `${diffInMinutes} menit lalu` };
        } else if (diffInMinutes < 1440) {
            const hours = Math.floor(diffInMinutes / 60);
            return { isOnline: false, text: `${hours} jam lalu` };
        } else {
            return { isOnline: false, text: `${Math.floor(diffInMinutes / 1440)} hari lalu` };
        }
    };

    // --- Render ---

    return (
        <div className="space-y-6 pb-20 animate-fade-in-up">
            <style>{customStyles}</style>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Manajemen Admin Desa
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Kelola akun administrator dan pantau aktivitas login secara real-time.
                    </p>
                </div>
                <button 
                    onClick={handleOpenModal} 
                    className="group flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 font-medium"
                >
                    <div className="bg-white/20 p-1 rounded-full group-hover:rotate-90 transition-transform">
                        <FiPlus size={18} />
                    </div>
                    <span>Tambah Admin</span>
                </button>
            </div>

            {/* Content Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[500px] flex flex-col">
                {/* Search Bar */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                    <div className="relative max-w-md w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiSearch className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari nama, email, atau desa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow sm:text-sm shadow-sm"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="p-8"><SkeletonLoader columns={4} count={5} /></div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kontak</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Wilayah</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredAdminList.length > 0 ? (
                                    filteredAdminList.map((admin, index) => {
                                        const { isOnline, text: statusText } = getOnlineStatus(admin.lastSeen);
                                        
                                        return (
                                            <tr 
                                                key={admin.id} 
                                                className={`
                                                    group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-200
                                                    ${highlightedRow === admin.id ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}
                                                    animate-fade-in-up
                                                `}
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="relative">
                                                            <div className={`flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br ${getGradient(admin.nama)} flex items-center justify-center text-white font-bold shadow-md`}>
                                                                {admin.foto_url ? (
                                                                    <img className="h-10 w-10 rounded-full object-cover border-2 border-white dark:border-gray-700" src={admin.foto_url} alt="" />
                                                                ) : (
                                                                    <span>{getInitials(admin.nama)}</span>
                                                                )}
                                                            </div>
                                                            {/* Indikator Online pada Avatar */}
                                                            {isOnline && (
                                                                <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-400 ring-2 ring-white dark:ring-gray-800 animate-pulse"></span>
                                                            )}
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                                                {admin.nama}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                                                <FiShield className="text-blue-400" size={10} /> Admin Desa
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Kolom Status Baru */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {isOnline ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                            <span className="relative flex h-2 w-2">
                                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                            </span>
                                                            Online
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                                                            <FiClock size={10} /> {statusText}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                        <FiMail className="mr-2 text-gray-400" />
                                                        {admin.email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                        <FiMapPin className="mr-1.5 text-gray-500" />
                                                        Desa {admin.desa}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => openResetConfirm(admin.email)} 
                                                            className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors tooltip-trigger"
                                                            title="Reset Password"
                                                        >
                                                            <FiKey size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => openDeleteConfirm(admin)} 
                                                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors tooltip-trigger"
                                                            title="Hapus Akun"
                                                        >
                                                            <FiTrash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-full mb-3">
                                                    <FiUser size={32} strokeWidth={1.5} />
                                                </div>
                                                <p className="text-lg font-medium">Tidak ada admin ditemukan</p>
                                                <p className="text-sm mt-1">Coba kata kunci lain atau tambahkan admin baru.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Footer Count */}
                <div className="bg-gray-50 dark:bg-gray-700/30 px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>Menampilkan {filteredAdminList.length} dari {adminList.length} admin</span>
                    <span>Status update otomatis setiap 60 detik</span>
                </div>
            </div>

            {/* Modal Tambah Admin */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Buat Akun Admin Baru">
                <form onSubmit={handleFormSubmit} className="space-y-5 mt-2">
                    <div className="space-y-4">
                        <div className="relative group">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Nama Lengkap</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <FiUser />
                                </div>
                                <input 
                                    type="text" 
                                    name="nama" 
                                    value={formData.nama || ''} 
                                    onChange={handleFormChange} 
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                                    placeholder="Contoh: Budi Santoso"
                                    required 
                                />
                            </div>
                        </div>

                        <div className="relative group">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Alamat Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <FiMail />
                                </div>
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email || ''} 
                                    onChange={handleFormChange} 
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                                    placeholder="admin.desa@example.com"
                                    required 
                                />
                            </div>
                        </div>

                        <div className="relative group">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <FiKey />
                                </div>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="password" 
                                    value={formData.password || ''} 
                                    onChange={handleFormChange} 
                                    className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none" 
                                    placeholder="Minimal 6 karakter"
                                    required 
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)} 
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    {showPassword ? <FiEyeOff /> : <FiEye />}
                                </button>
                            </div>
                        </div>

                        <div className="relative group">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">Asal Desa</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <FiMapPin />
                                </div>
                                <select 
                                    name="desa" 
                                    value={formData.desa || ''} 
                                    onChange={handleFormChange} 
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer" 
                                    required
                                >
                                    {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                                </select>
                                <div className="absolute inset-y-0 right-0 px-3 flex items-center pointer-events-none text-gray-400">
                                    <FiMoreVertical className="rotate-90" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-700 gap-3">
                        <button 
                            type="button" 
                            onClick={handleCloseModal} 
                            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
                            disabled={isSubmitting}
                        >
                            Batal
                        </button>
                        <button 
                            type="submit" 
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all flex items-center gap-2" 
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <Spinner size="sm" color="white" /> : <FiPlus size={18} />}
                            {isSubmitting ? 'Memproses...' : 'Buat Akun'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Custom Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={handleConfirmAction}
                isLoading={isSubmitting}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.type === 'delete' ? 'danger' : 'warning'}
                confirmText={confirmModal.type === 'delete' ? 'Hapus Admin' : 'Kirim Email'}
            />
        </div>
    );
};

export default ManajemenAdmin;