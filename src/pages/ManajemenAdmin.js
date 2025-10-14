import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import { FiTrash2, FiKey, FiEye, FiEyeOff, FiPlus } from 'react-icons/fi';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

const ManajemenAdmin = () => {
    const [adminList, setAdminList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({});
    const { showNotification } = useNotification();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [adminToDelete, setAdminToDelete] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [highlightedRow, setHighlightedRow] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "admin_desa"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAdminList(list);
            setLoading(false);
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
            }, 3000); // Highlight berlaku selama 3 detik
            return () => clearTimeout(timer);
        }
    }, [searchParams, setSearchParams]);


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
                foto_url: null
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
    
    const confirmDelete = (admin) => {
        setAdminToDelete(admin);
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!adminToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, 'users', adminToDelete.id));
            showNotification(`Data admin untuk ${adminToDelete.nama} telah dihapus.`, 'success');
        } catch(error) {
            showNotification(`Gagal menghapus data: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setAdminToDelete(null);
        }
    };

    const handleResetPassword = async (email) => {
        if (window.confirm(`Kirim email reset password ke ${email}?`)) {
            try {
                await sendPasswordResetEmail(auth, email);
                showNotification(`Email reset password telah dikirim ke ${email}.`);
            } catch (error) {
                showNotification(`Gagal mengirim email: ${error.message}`, 'error');
            }
        }
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    if (loading) return <Spinner />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Daftar Admin Desa</h2>
                <button onClick={handleOpenModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <FiPlus /> Tambah Admin Baru
                </button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Email</th>
                            <th className="px-6 py-3">Desa</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adminList.map((admin) => (
                            <tr key={admin.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === admin.id ? 'highlight-row' : ''}`}>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                    <div className="flex items-center gap-3">
                                        {admin.foto_url ? (
                                            <img src={admin.foto_url} alt={admin.nama} className="w-10 h-10 rounded-full object-cover"/>
                                        ) : (
                                            <div className="w-10 h-10 bg-blue-500 text-white flex items-center justify-center rounded-full font-bold">
                                                {getInitials(admin.nama)}
                                            </div>
                                        )}
                                        <span>{admin.nama}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">{admin.email}</td>
                                <td className="px-6 py-4">{admin.desa}</td>
                                <td className="px-6 py-4 flex space-x-3">
                                    <button onClick={() => handleResetPassword(admin.email)} className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300" title="Reset Password"><FiKey /></button>
                                    <button onClick={() => confirmDelete(admin)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus"><FiTrash2 /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Tambah Admin Desa Baru">
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                        <input type="text" name="nama" value={formData.nama || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input type="email" name="email" value={formData.email || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} name="password" value={formData.password || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" required />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 dark:text-gray-400">
                                {showPassword ? <FiEyeOff /> : <FiEye />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Asal Desa</label>
                        <select name="desa" value={formData.desa || ''} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm p-2" required>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end pt-4 border-t mt-6 dark:border-gray-700">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md mr-2" disabled={isSubmitting}>Batal</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center" disabled={isSubmitting}>
                            {isSubmitting && <Spinner size="sm"/>} {isSubmitting ? 'Membuat...' : 'Buat Akun'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                isLoading={isSubmitting}
                title="Konfirmasi Hapus Admin"
                message={`Peringatan: Ini akan menghapus data admin "${adminToDelete?.nama}" dari tabel, tetapi tidak akan menghapus loginnya dari sistem. Lanjutkan?`}
            />
        </div>
    );
};

export default ManajemenAdmin;
