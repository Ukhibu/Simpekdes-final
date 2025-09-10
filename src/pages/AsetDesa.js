import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiArchive, FiPlus, FiSearch, FiFilter, FiEdit, FiTrash2 } from 'react-icons/fi';

const DESA_LIST = [ "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga" ];
const KATEGORI_ASET = ["Tanah", "Peralatan dan Mesin", "Gedung dan Bangunan", "Jalan, Jaringan, dan Irigasi", "Aset Tetap Lainnya", "Konstruksi Dalam Pengerjaan"];
const KONDISI_ASET = ["Baik", "Rusak Ringan", "Rusak Berat"];

const AsetDesa = () => {
    const { currentUser } = useAuth();
    const [asetList, setAsetList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAset, setSelectedAset] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    const [filterKategori, setFilterKategori] = useState('all');

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        let q = collection(db, 'aset');
        let constraints = [];
        
        if (currentUser.role === 'admin_desa') {
            constraints.push(where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            constraints.push(where("desa", "==", filterDesa));
        }
        
        if (filterKategori !== 'all') {
            constraints.push(where("kategori", "==", filterKategori));
        }
        
        q = query(q, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAsetList(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, filterDesa, filterKategori]);

    const filteredAset = useMemo(() => {
        return asetList.filter(aset => 
            (aset.namaAset || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [asetList, searchTerm]);

    const handleOpenModal = (aset = null) => {
        setSelectedAset(aset);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
        setFormData(aset ? {...aset} : { desa: initialDesa, tanggalPerolehan: new Date().toISOString().split('T')[0], kondisi: 'Baik' });
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        if(isSubmitting) return;
        setIsModalOpen(false);
        setSelectedAset(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData, nilaiPerolehan: Number(formData.nilaiPerolehan) };
            if (selectedAset) {
                const docRef = doc(db, 'aset', selectedAset.id);
                await updateDoc(docRef, dataToSave);
                alert('Aset berhasil diperbarui!');
            } else {
                await addDoc(collection(db, 'aset'), dataToSave);
                alert('Aset berhasil ditambahkan!');
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving asset: ", error);
            alert("Gagal menyimpan aset.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm("Yakin ingin menghapus aset ini?")) {
            await deleteDoc(doc(db, 'aset', id));
            alert('Aset berhasil dihapus.');
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Modul Manajemen Aset Desa</h1>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <InputField type="text" placeholder="Cari nama aset..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                    <InputField type="select" value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} icon={<FiFilter />}>
                        <option value="all">Semua Kategori</option>
                        {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                    </InputField>
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} icon={<FiFilter />}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                </div>
                {currentUser.role === 'admin_desa' && (
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <FiPlus /> Tambah Aset
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Nama Aset</th>
                                <th className="px-6 py-3">Kategori</th>
                                <th className="px-6 py-3">Tanggal Perolehan</th>
                                <th className="px-6 py-3">Nilai (Rp)</th>
                                <th className="px-6 py-3">Kondisi</th>
                                {currentUser.role === 'admin_desa' && <th className="px-6 py-3">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="6" className="text-center py-4"><Spinner /></td></tr> :
                             filteredAset.map(aset => (
                                <tr key={aset.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{aset.namaAset}</td>
                                    <td className="px-6 py-4">{aset.kategori}</td>
                                    <td className="px-6 py-4">{aset.tanggalPerolehan}</td>
                                    <td className="px-6 py-4">{Number(aset.nilaiPerolehan).toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${aset.kondisi === 'Baik' ? 'bg-green-100 text-green-800' : (aset.kondisi === 'Rusak Ringan' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}`}>
                                            {aset.kondisi}
                                        </span>
                                    </td>
                                    {currentUser.role === 'admin_desa' && (
                                        <td className="px-6 py-4 flex items-center space-x-2">
                                            <button onClick={() => handleOpenModal(aset)} className="text-blue-500 hover:text-blue-700"><FiEdit /></button>
                                            <button onClick={() => handleDelete(aset.id)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                                        </td>
                                    )}
                                </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAset ? "Edit Aset Desa" : "Tambah Aset Desa"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Nama Aset" name="namaAset" value={formData.namaAset} onChange={handleFormChange} required />
                    <InputField label="Kategori Aset" name="kategori" type="select" value={formData.kategori} onChange={handleFormChange}>
                        <option value="">Pilih Kategori</option>
                        {KATEGORI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                    </InputField>
                    <InputField label="Kode Barang" name="kodeBarang" value={formData.kodeBarang} onChange={handleFormChange} />
                    <InputField label="Tanggal Perolehan" name="tanggalPerolehan" type="date" value={formData.tanggalPerolehan} onChange={handleFormChange} required />
                    <InputField label="Nilai Perolehan (Rp)" name="nilaiPerolehan" type="number" value={formData.nilaiPerolehan} onChange={handleFormChange} required />
                    <InputField label="Kondisi" name="kondisi" type="select" value={formData.kondisi} onChange={handleFormChange}>
                        {KONDISI_ASET.map(k => <option key={k} value={k}>{k}</option>)}
                    </InputField>
                    <InputField label="Lokasi" name="lokasi" value={formData.lokasi} onChange={handleFormChange} />
                    <InputField label="Keterangan" name="keterangan" type="textarea" value={formData.keterangan} onChange={handleFormChange} />
                    {currentUser.role === 'admin_kecamatan' && (
                         <InputField label="Desa" name="desa" type="select" value={formData.desa} onChange={handleFormChange} required>
                            <option value="">Pilih Desa</option>
                            {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                         </InputField>
                    )}
                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 mr-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Batal</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg" disabled={isSubmitting}>{isSubmitting ? <Spinner size="sm"/> : "Simpan"}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AsetDesa;

