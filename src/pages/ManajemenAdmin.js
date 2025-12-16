import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import SkeletonLoader from '../components/common/SkeletonLoader';
import { 
    FiTrash2, FiKey, FiEye, FiEyeOff, FiPlus, FiSearch, 
    FiUser, FiMail, FiMapPin, FiShield, FiMoreVertical, FiCheckCircle
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
`;

const ManajemenAdmin = () => {
    const { currentUser } = useAuth(); 
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
    
    // State untuk Modal Konfirmasi
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        type: null,
        title: '',
        message: '',
        data: null
    });

    // --- 1. FETCH DATA (Hanya Baca, Tidak ada Update Tulis Otomatis) ---
    useEffect(() => {
        // Kita hanya membaca data siapa saja yg jadi admin
        const q = query(collection(db, "users"), where("role", "==", "admin_desa"));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const list = querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            setAdminList(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching admins:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // --- Highlight Row Logic ---
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

    // Sorting & Filtering
    const processedAdminList = useMemo(() => {
        let filtered = adminList.filter(admin => 
            admin.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
            admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            admin.desa.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Sort: Berdasarkan Nama (Alphabetical) agar rapi
        return filtered.sort((a, b) => a.nama.localeCompare(b.nama));
    }, [adminList, searchTerm]);

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

        // Menggunakan secondary app agar login current user tidak terputus
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
                status: 'active' // Menandakan akun ini aktif secara default
            });
            
            showNotification(`Admin untuk Desa ${formData.desa} berhasil dibuat.`, 'success');
            handleCloseModal();
        } catch (error) {
            console.error("Error creating admin:", error);
            let errorMessage = "Terjadi kesalahan.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Email ini sudah terdaftar.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password terlalu lemah.";
            }
            showNotification(`Gagal: ${errorMessage}`, 'error');
        } finally {
            setIsSubmitting(false);
            // Cleanup secondary app
            // (Optional: deleteApp(secondaryApp) jika perlu, tapi biasanya garbage collected)
        }
    };
    
    const openDeleteConfirm = (admin) => {
        setConfirmModal({
            isOpen: true,
            type: 'delete',
            title: 'Hapus Akses Admin?',
            message: `Hapus akses admin "${admin.nama}"? Data akan dihapus permanen.`,
            data: admin
        });
    };

    const openResetConfirm = (email) => {
        setConfirmModal({
            isOpen: true,
            type: 'reset',
            title: 'Kirim Reset Password?',
            message: `Kirim link reset password ke "${email}"?`,
            data: email
        });
    };

    const handleConfirmAction = async () => {
        setIsSubmitting(true);
        try {
            if (confirmModal.type === 'delete') {
                await deleteDoc(doc(db, 'users', confirmModal.data.id));
                showNotification(`Admin ${confirmModal.data.nama} berhasil dihapus.`, 'success');
            } else if (confirmModal.type === 'reset') {
                await sendPasswordResetEmail(auth, confirmModal.data);
                showNotification(`Email reset terkirim ke ${confirmModal.data}.`, 'success');
            }
        } catch (error) {
            showNotification(`Gagal: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setConfirmModal({ ...confirmModal, isOpen: false });
        }
    };

    const getGradient = (name) => {
        const colors = [
            'from-blue-400 to-indigo-500', 'from-emerald-400 to-teal-500',
            'from-orange-400 to-red-500', 'from-purple-400 to-pink-500',
            'from-cyan-400 to-blue-500'
        ];
        return colors[(name?.length || 0) % colors.length];
    };

    const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : '?';

    return (
        <div className="space-y-6 pb-20 animate-fade-in-up">
            <style>{customStyles}</style>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        Manajemen Admin Desa
                    </h1>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-bold">
                            <FiShield size={10} /> Panel Kontrol
                        </span>
                        <span>Kelola akun admin desa yang aktif.</span>
                    </div>
                </div>
                <button 
                    onClick={handleOpenModal} 
                    className="group flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all font-medium"
                >
                    <FiPlus size={18} className="group-hover:rotate-90 transition-transform"/>
                    <span>Tambah Admin</span>
                </button>
            </div>

            {/* Table Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden min-h-[500px] flex flex-col">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                    <div className="relative max-w-md w-full">
                        <FiSearch className="absolute left-3 top-3 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari admin..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 outline-none transition-shadow sm:text-sm shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="p-8"><SkeletonLoader columns={4} count={5} /></div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status Akun</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kontak</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Wilayah</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                {processedAdminList.length > 0 ? (
                                    processedAdminList.map((admin, index) => {
                                        const isCurrentUser = currentUser?.uid === admin.id;
                                        
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
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                                                    {admin.nama}
                                                                </span>
                                                                {isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold">ANDA</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                                                <FiShield className="text-blue-400" size={10} /> Admin Desa
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {/* STATUS DI-HARDCODE JADI AKTIF UNTUK MENGHEMAT KUOTA */}
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                                                        <FiCheckCircle size={12} className="text-green-600 dark:text-green-400" />
                                                        Akun Aktif
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                                    <div className="flex items-center gap-2"><FiMail className="text-gray-400"/> {admin.email}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                                        <FiMapPin className="mr-1.5 text-gray-500" />
                                                        {admin.desa}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => openResetConfirm(admin.email)} 
                                                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Reset Password"
                                                        >
                                                            <FiKey size={18} />
                                                        </button>
                                                        {!isCurrentUser && (
                                                            <button 
                                                                onClick={() => openDeleteConfirm(admin)} 
                                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Hapus Akun"
                                                            >
                                                                <FiTrash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-full mb-3 w-fit mx-auto"><FiUser size={32} /></div>
                                            <p className="font-medium">Tidak ada admin ditemukan</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/30 px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500">
                    <span>Total: {processedAdminList.length} admin</span>
                    {/* Hapus indikator Live Update yang membingungkan */}
                    <span>Data tersinkronisasi</span>
                </div>
            </div>

            {/* Modal Tambah Admin */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Buat Akun Admin Baru">
                <form onSubmit={handleFormSubmit} className="space-y-5 mt-2">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Nama Lengkap</label>
                            <div className="relative">
                                <FiUser className="absolute left-3 top-3 text-gray-400" />
                                <input type="text" name="nama" value={formData.nama || ''} onChange={handleFormChange} className="block w-full pl-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Contoh: Budi Santoso" required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Email</label>
                            <div className="relative">
                                <FiMail className="absolute left-3 top-3 text-gray-400" />
                                <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} className="block w-full pl-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="admin@desa.id" required />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Password</label>
                            <div className="relative">
                                <FiKey className="absolute left-3 top-3 text-gray-400" />
                                <input type={showPassword ? "text" : "password"} name="password" value={formData.password || ''} onChange={handleFormChange} className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Minimal 6 karakter" required />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                                    {showPassword ? <FiEyeOff /> : <FiEye />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Desa</label>
                            <div className="relative">
                                <FiMapPin className="absolute left-3 top-3 text-gray-400" />
                                <select name="desa" value={formData.desa || ''} onChange={handleFormChange} className="block w-full pl-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white appearance-none" required>
                                    {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                                </select>
                                <FiMoreVertical className="absolute right-3 top-3 text-gray-400 rotate-90 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-gray-700 gap-3">
                        <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors" disabled={isSubmitting}>Batal</button>
                        <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium shadow-lg hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all flex items-center gap-2" disabled={isSubmitting}>
                            {isSubmitting ? <Spinner size="sm" color="white" /> : <FiPlus size={18} />} {isSubmitting ? 'Memproses...' : 'Buat Akun'}
                        </button>
                    </div>
                </form>
            </Modal>

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