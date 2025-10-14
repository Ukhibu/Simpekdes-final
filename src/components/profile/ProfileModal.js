import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { FiCamera, FiSave, FiUser } from 'react-icons/fi';
import { uploadImageToCloudinary } from '../../utils/imageUploader';
import { createNotificationForAdmins } from '../../utils/notificationService';

const ProfileModal = ({ isOpen, onClose }) => {
    const { currentUser, updateUserProfile } = useAuth();
    const { showNotification } = useNotification();
    
    const [formData, setFormData] = useState({ nama: '' });
    const [profileImageFile, setProfileImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (currentUser) {
            setFormData({ nama: currentUser.nama || '' });
            setImagePreview(currentUser.foto_url || null);
        }
    }, [currentUser, isOpen]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setProfileImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            showNotification('Hanya file gambar yang diizinkan.', 'error');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.nama.trim()) {
            showNotification('Nama tidak boleh kosong.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const dataToUpdate = {
                nama: formData.nama,
            };

            if (profileImageFile) {
                const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
                const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;

                if (!uploadPreset || !cloudName) {
                    throw new Error('Konfigurasi Cloudinary (upload preset/cloud name) tidak ditemukan. Harap periksa file .env Anda.');
                }

                const photoURL = await uploadImageToCloudinary(profileImageFile, uploadPreset, cloudName);
                if (photoURL) {
                    dataToUpdate.foto_url = photoURL;
                }
            }

            await updateUserProfile(currentUser.uid, dataToUpdate);

            if (currentUser.role === 'admin_desa') {
                const message = `Admin Desa ${currentUser.desa} (${formData.nama}) telah memperbarui profilnya.`;
                // [PERBAIKAN] Membuat link notifikasi dengan parameter 'highlight' yang berisi ID pengguna.
                // Ini akan digunakan oleh halaman ManajemenAdmin untuk menyorot baris yang benar.
                const link = `/app/manajemen-admin?highlight=${currentUser.uid}`; 
                await createNotificationForAdmins(message, link, currentUser);
            }

            showNotification('Profil berhasil diperbarui!', 'success');
            onClose();

        } catch (error) {
            console.error("Gagal memperbarui profil:", error);
            showNotification(`Gagal memperbarui profil: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
            setProfileImageFile(null);
        }
    };
    
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Profil Anda">
            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center">
                    <div className="relative">
                        {imagePreview ? (
                             <img src={imagePreview} alt="Pratinjau Profil" className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"/>
                        ) : (
                            <div className="w-32 h-32 bg-blue-500 text-white flex items-center justify-center rounded-full font-bold text-4xl border-4 border-gray-200 dark:border-gray-600">
                                {getInitials(formData.nama)}
                            </div>
                        )}
                        <label htmlFor="profile-upload" className="absolute -bottom-2 -right-2 bg-gray-700 text-white p-2 rounded-full cursor-pointer hover:bg-gray-600 transition-colors">
                            <FiCamera />
                            <input id="profile-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </label>
                    </div>
                </div>
                <div>
                    <label htmlFor="nama" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                    <div className="relative mt-1">
                         <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            name="nama"
                            id="nama"
                            value={formData.nama}
                            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            required
                        />
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Batal</Button>
                    <Button type="submit" variant="primary" isLoading={isSaving}>
                        <FiSave className="mr-2"/> Simpan Perubahan
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default ProfileModal;

