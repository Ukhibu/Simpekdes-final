import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Spinner from '../components/common/Spinner';
import { FiUpload, FiSearch, FiFilter, FiEye, FiDownload, FiTrash2, FiDatabase, FiCheckSquare } from 'react-icons/fi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createNotificationForAdmins } from '../utils/notificationService';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta",
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana",
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

const EFilePage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    const [activeTab, setActiveTab] = useState('manajemen');
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [selectedDesaForUpload, setSelectedDesaForUpload] = useState(currentUser?.role === 'admin_desa' ? currentUser.desa : '');
    const [selectedPerangkat, setSelectedPerangkat] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [skDocuments, setSkDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser?.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [skDocToDelete, setSkDocToDelete] = useState(null);
    const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
    const [highlightedRow, setHighlightedRow] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const highlightId = searchParams.get('highlight');
        if (highlightId) {
            setHighlightedRow(highlightId);
            const timer = setTimeout(() => {
                setHighlightedRow(null);
                // Clean up URL
                searchParams.delete('highlight');
                setSearchParams(searchParams, { replace: true });
            }, 3000); // Highlight for 3 seconds
            return () => clearTimeout(timer);
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const q = query(collection(db, "perangkat"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllPerangkat(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);
        const q = currentUser.role === 'admin_kecamatan'
            ? query(collection(db, "efile"))
            : query(collection(db, "efile"), where("desa", "==", currentUser.desa));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSkDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching SK documents: ", error);
            setLoading(false);
            showNotification('Gagal memuat data SK.', 'error');
        });
        return () => unsubscribe();
    }, [currentUser, showNotification]);
    
    const perangkatListForUpload = useMemo(() => {
        if (!selectedDesaForUpload) return [];
        return allPerangkat.filter(p => p.desa === selectedDesaForUpload);
    }, [allPerangkat, selectedDesaForUpload]);


    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
        } else {
            showNotification('Hanya file PDF yang diizinkan.', 'error');
            e.target.value = null;
        }
    };
    
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedPerangkat || !selectedFile) {
            showNotification('Harap pilih desa, perangkat, dan file SK.', 'error');
            return;
        }

        const GITHUB_USERNAME = process.env.REACT_APP_GITHUB_USERNAME;
        const GITHUB_REPO = process.env.REACT_APP_GITHUB_REPO;
        const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN;

        if (!GITHUB_USERNAME || !GITHUB_REPO || !GITHUB_TOKEN) {
            showNotification('Konfigurasi GitHub belum diatur di file .env Anda.', 'error');
            return;
        }

        setIsUploading(true);

        try {
            const perangkat = allPerangkat.find(p => p.id === selectedPerangkat);
            if (!perangkat) {
                throw new Error('Data perangkat tidak ditemukan.');
            }
            const fileName = `${perangkat.desa}_${perangkat.nama.replace(/\s/g, '_')}_${Date.now()}.pdf`;
            const filePath = `sk_documents/${fileName}`;

            const contentBase64 = await toBase64(selectedFile);

            const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify({
                    message: `Upload SK for ${perangkat.nama}`,
                    content: contentBase64,
                }),
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Gagal mengunggah file ke GitHub.');
            }

            const fileUrl = result.content.download_url;

            const newDocRef = await addDoc(collection(db, 'efile'), {
                perangkatId: perangkat.id,
                perangkatNama: perangkat.nama,
                desa: perangkat.desa,
                fileName: selectedFile.name,
                fileUrl: fileUrl,
                githubPath: filePath,
                status: 'menunggu_verifikasi',
                uploadedAt: new Date(),
            });
            
            if (currentUser.role === 'admin_desa') {
                await createNotificationForAdmins(`SK baru untuk ${perangkat.nama} dari Desa ${perangkat.desa} telah diunggah dan menunggu verifikasi.`, `/app/efile/manage?highlight=${newDocRef.id}`);
            }

            showNotification('Dokumen SK berhasil diunggah dan menunggu verifikasi.', 'success');
            setSelectedPerangkat('');
            setSelectedFile(null);
            if (currentUser.role === 'admin_kecamatan') {
                setSelectedDesaForUpload('');
            }
            document.getElementById('file-upload-form').reset();

        } catch (error) {
            console.error("Upload error:", error);
            showNotification(`Gagal mengunggah file: ${error.message}`, 'error');
        } finally {
            setIsUploading(false);
        }
    };
    
    const confirmDelete = (skDoc) => {
        setSkDocToDelete(skDoc);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!skDocToDelete) return;
        setIsSubmittingDelete(true);
        try {
            await deleteDoc(doc(db, 'efile', skDocToDelete.id));
            showNotification('Catatan dokumen SK berhasil dihapus.', 'success');
        } catch (error) {
            console.error("Error deleting document:", error);
            const errorMessage = error.message || "Terjadi galat yang tidak diketahui.";
            showNotification(`Gagal menghapus catatan: ${errorMessage}`, 'error');
        } finally {
            setIsSubmittingDelete(false);
            setIsDeleteConfirmOpen(false);
            setSkDocToDelete(null);
        }
    };

    const handleVerify = async (skDoc) => {
        const docRef = doc(db, 'efile', skDoc.id);
        try {
            await updateDoc(docRef, { status: 'terverifikasi' });

            const perangkatDoc = await getDoc(doc(db, 'perangkat', skDoc.perangkatId));
            if (perangkatDoc.exists()) {
                const userQuery = query(collection(db, "users"), where("desa", "==", perangkatDoc.data().desa), where("role", "==", "admin_desa"));
                const userSnapshot = await getDocs(userQuery);
                userSnapshot.forEach(async (userDoc) => {
                    await createNotificationForAdmins(`Dokumen SK untuk ${skDoc.perangkatNama} telah diverifikasi.`, `/app/efile/manage?highlight=${skDoc.id}`, userDoc.id);
                });
            }

            showNotification('Dokumen berhasil diverifikasi.', 'success');
        } catch (error) {
            console.error("Error verifying document: ", error);
            showNotification('Gagal memverifikasi dokumen.', 'error');
        }
    };


    const openPdfPreview = (url) => {
        const encodedUrl = encodeURIComponent(url);
        const googleViewerUrl = `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
        setPreviewUrl(googleViewerUrl);
        setIsModalOpen(true);
    };

    const filteredSkDocuments = useMemo(() => {
        return skDocuments
            .map(sk => {
                const perangkat = allPerangkat.find(p => p.id === sk.perangkatId);
                return {
                    ...sk,
                    foto_url: perangkat?.foto_url,
                    jabatan: perangkat?.jabatan || 'N/A'
                };
            })
            .filter(doc => {
                const filterByDesaCond = currentUser?.role === 'admin_kecamatan' && filterDesa !== 'all' ? doc.desa === filterDesa : true;
                const search = searchTerm.toLowerCase();
                const filterBySearchCond = !searchTerm ? true :
                    (String(doc.perangkatNama).toLowerCase().includes(search)) ||
                    (String(doc.fileName).toLowerCase().includes(search)) ||
                    (String(doc.jabatan).toLowerCase().includes(search));
                return filterByDesaCond && filterBySearchCond;
            });
    }, [skDocuments, allPerangkat, searchTerm, filterDesa, currentUser]);

    return (
        <div className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('manajemen')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'manajemen' ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                        <FiUpload className="inline-block mr-2" /> Manajemen SK
                    </button>
                    <button onClick={() => setActiveTab('data')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'data' ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                        <FiDatabase className="inline-block mr-2" /> Data SK Perangkat
                    </button>
                </nav>
            </div>

            {activeTab === 'manajemen' ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Unggah Dokumen SK Perangkat Desa</h2>
                     {currentUser.role === 'admin_desa' || currentUser.role === 'admin_kecamatan' ? (
                         <form id="file-upload-form" onSubmit={handleUpload} className="space-y-4 max-w-lg">
                              {currentUser.role === 'admin_kecamatan' && (
                                  <div>
                                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Desa</label>
                                     <select value={selectedDesaForUpload} onChange={(e) => {setSelectedDesaForUpload(e.target.value); setSelectedPerangkat('');}} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                                         <option value="">-- Pilih Desa --</option>
                                         {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                                     </select>
                                 </div>
                              )}
                              <div>
                                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pilih Perangkat</label>
                                 <select value={selectedPerangkat} onChange={(e) => setSelectedPerangkat(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" required disabled={!selectedDesaForUpload}>
                                     <option value="">-- Pilih Perangkat Desa --</option>
                                     {perangkatListForUpload.map(p => <option key={p.id} value={p.id}>{p.nama} - {p.jabatan}</option>)}
                                 </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pilih File SK (PDF)</label>
                                <input type="file" onChange={handleFileChange} accept="application/pdf" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800" required />
                             </div>
                             <div>
                                 <button type="submit" disabled={isUploading} className="w-full flex justify-center items-center px-4 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                                     {isUploading ? <Spinner size="sm" /> : <><FiUpload className="mr-2" /> Unggah File</>}
                                 </button>
                             </div>
                         </form>
                     ) : (
                          <p className="text-gray-500 dark:text-gray-400">Anda tidak memiliki izin untuk mengunggah dokumen.</p>
                     )}
                </div>
            ) : (
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <div className="relative lg:col-span-2">
                               <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                               <input type="text" placeholder="Cari nama, jabatan, atau file..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                            </div>
                            {currentUser.role === 'admin_kecamatan' && (
                                <div className="relative">
                                     <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                     <select value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                         <option value="all">Semua Desa</option>
                                         {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                                     </select>
                                </div>
                            )}
                       </div>
                     {loading ? <Spinner /> : (
                         <div className="overflow-x-auto">
                             <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                 <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                                     <tr>
                                         <th className="px-6 py-3">Nama Perangkat</th>
                                         <th className="px-6 py-3">Jabatan</th>
                                         {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                                         <th className="px-6 py-3">Nama File</th>
                                         <th className="px-6 py-3">Status</th>
                                         <th className="px-6 py-3">Aksi</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {filteredSkDocuments.length > 0 ? filteredSkDocuments.map((sk) => (
                                         <tr key={sk.id} className={`bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${highlightedRow === sk.id ? 'highlight-row' : ''}`}>
                                             <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-3">
                                                <img src={sk.foto_url || `https://ui-avatars.com/api/?name=${sk.perangkatNama}&background=E2E8F0&color=4A5568`} alt={sk.perangkatNama} className="w-10 h-10 rounded-full object-cover"/>
                                                {sk.perangkatNama}
                                             </td>
                                             <td className="px-6 py-4">{sk.jabatan}</td>
                                             {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{sk.desa}</td>}
                                             <td className="px-6 py-4">{sk.fileName}</td>
                                             <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                    sk.status === 'terverifikasi' 
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                                }`}>
                                                    {sk.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu'}
                                                </span>
                                             </td>
                                             <td className="px-6 py-4 flex items-center space-x-4">
                                                 <button onClick={() => openPdfPreview(sk.fileUrl)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Lihat"><FiEye /></button>
                                                 <a href={sk.fileUrl} download={sk.fileName} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" title="Unduh"><FiDownload /></a>
                                                 {currentUser.role === 'admin_kecamatan' && sk.status !== 'terverifikasi' && (
                                                    <button onClick={() => handleVerify(sk)} className="text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300" title="Verifikasi">
                                                        <FiCheckSquare />
                                                    </button>
                                                 )}
                                                 <button onClick={() => confirmDelete(sk)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus"><FiTrash2 /></button>
                                             </td>
                                         </tr>
                                     )) : (
                                         <tr>
                                             <td colSpan={currentUser.role === 'admin_kecamatan' ? 6 : 5} className="text-center py-10 text-gray-500 dark:text-gray-400">Tidak ada data SK yang ditemukan.</td>
                                         </tr>
                                     )}
                                 </tbody>
                             </table>
                         </div>
                     )}
                </div>
            )}
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Pratinjau Dokumen SK">
                <div className="w-full h-[75vh]">
                    {previewUrl ? (
                        <iframe src={previewUrl} width="100%" height="100%" title="Pratinjau PDF" frameBorder="0"></iframe>
                    ) : (
                        <div className="flex items-center justify-center h-full"><Spinner /></div>
                    )}
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmittingDelete}
                title="Konfirmasi Hapus Catatan SK"
                message={`Apakah Anda yakin ingin menghapus catatan SK untuk "${skDocToDelete?.fileName}"? Ini tidak akan menghapus file fisik.`}
            />
        </div>
    );
};

export default EFilePage;

