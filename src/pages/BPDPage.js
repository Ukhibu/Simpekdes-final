import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiPlus, FiDownload } from 'react-icons/fi';
import { generateBpdXLSX } from '../utils/generateBpdXLSX';
import InputField from '../components/common/InputField';

const DESA_LIST = [
    "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", 
    "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", 
    "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga"
];

const JABATAN_BPD = ["Ketua", "Wakil Ketua", "Sekretaris", "Anggota"];
const PENDIDIKAN_LIST = ["SD", "SLTP", "SLTA", "D1", "D2", "D3", "S1", "S2", "S3"];
const AGAMA_LIST = ["Islam", "Kristen", "Katolik", "Hindu", "Budha", "Konghucu"];
const JENIS_KELAMIN_LIST = ["Laki-laki", "Perempuan"];

const BPDPage = () => {
    const { currentUser } = useAuth();
    const [allBpd, setAllBpd] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBpd, setSelectedBpd] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDesa, setFilterDesa] = useState('all');
    const [filterPeriode, setFilterPeriode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);
        const bpdCollection = collection(db, 'bpd');
        const q = currentUser.role === 'admin_kecamatan' 
            ? query(bpdCollection)
            : query(bpdCollection, where("desa", "==", currentUser.desa));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllBpd(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching BPD data: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const filteredBpd = useMemo(() => {
        return allBpd
            .filter(p => currentUser.role === 'admin_kecamatan' ? (filterDesa === 'all' ? true : p.desa === filterDesa) : p.desa === currentUser.desa)
            .filter(p => {
                if (!searchTerm) return true;
                const search = searchTerm.toLowerCase();
                return (p.nama && p.nama.toLowerCase().includes(search)) || (p.jabatan && p.jabatan.toLowerCase().includes(search));
            })
            .filter(p => {
                if (!filterPeriode) return true;
                return p.periode && p.periode.includes(filterPeriode);
            });
    }, [allBpd, searchTerm, filterDesa, filterPeriode, currentUser]);

    const handleOpenModal = (bpd = null) => {
        setSelectedBpd(bpd);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : (bpd ? bpd.desa : '');
        setFormData(bpd ? { ...bpd } : { desa: initialDesa, rt: '', rw: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedBpd(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dataToSave = { ...formData };
        
        try {
            if (selectedBpd) {
                const docRef = doc(db, 'bpd', selectedBpd.id);
                await updateDoc(docRef, dataToSave);
                alert('Data berhasil diperbarui!');
            } else {
                await addDoc(collection(db, 'bpd'), dataToSave);
                alert('Data berhasil ditambahkan!');
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Gagal menyimpan data.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus data ini?")) {
            await deleteDoc(doc(db, 'bpd', id));
        }
    };

    const handleExportXLSX = () => {
        if (filteredBpd.length === 0) {
            alert("Tidak ada data untuk diekspor.");
            return;
        }

        const groupedByDesa = filteredBpd.reduce((acc, bpd) => {
            const desa = bpd.desa || 'Tanpa Desa';
            if (!acc[desa]) {
                acc[desa] = [];
            }
            acc[desa].push(bpd);
            return acc;
        }, {});
        
        generateBpdXLSX(groupedByDesa, filterPeriode);
    };

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Cari nama atau jabatan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                </div>
                <div className="relative">
                    <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Filter periode (cth: 2020-2025)" value={filterPeriode} onChange={(e) => setFilterPeriode(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                </div>
                {currentUser.role === 'admin_kecamatan' && (
                    <div className="relative">
                        <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg appearance-none bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </select>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                <button onClick={handleExportXLSX} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"><FiDownload/> Ekspor XLSX</button>
                <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><FiPlus/> Tambah Data</button>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Jabatan</th>
                            {currentUser.role === 'admin_kecamatan' && <th className="px-6 py-3">Desa</th>}
                            <th className="px-6 py-3">Periode</th>
                            <th className="px-6 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBpd.map((p) => (
                            <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{p.nama}</td>
                                <td className="px-6 py-4">{p.jabatan}</td>
                                {currentUser.role === 'admin_kecamatan' && <td className="px-6 py-4">{p.desa}</td>}
                                <td className="px-6 py-4">{p.periode}</td>
                                <td className="px-6 py-4 flex space-x-3">
                                    <button onClick={() => handleOpenModal(p)} className="text-blue-600 hover:text-blue-800"><FiEdit /></button>
                                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800"><FiTrash2 /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedBpd ? 'Edit Data BPD' : 'Tambah Data BPD'}>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Informasi Keanggotaan</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <InputField label="Nama Lengkap" name="nama" value={formData.nama} onChange={handleFormChange} required />
                            <InputField label="Jabatan" name="jabatan" value={formData.jabatan} onChange={handleFormChange} type="select" required>
                                <option value="">Pilih Jabatan</option>
                                {JABATAN_BPD.map(j => <option key={j} value={j}>{j}</option>)}
                            </InputField>
                            <InputField label="No. SK Bupati" name="no_sk_bupati" value={formData.no_sk_bupati} onChange={handleFormChange} />
                            <InputField label="Tgl. SK Bupati" name="tgl_sk_bupati" value={formData.tgl_sk_bupati} onChange={handleFormChange} type="date" />
                            <InputField label="Periode" name="periode" value={formData.periode} onChange={handleFormChange} placeholder="Contoh: 2019-2025" />
                            <InputField label="Tgl Pelantikan" name="tgl_pelantikan" value={formData.tgl_pelantikan} onChange={handleFormChange} type="date" />
                            <InputField label="Wilayah Pemilihan" name="wil_pmlhn" value={formData.wil_pmlhn} onChange={handleFormChange} />
                        </div>
                    </div>
                    
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Data Pribadi</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                             <InputField label="NIK" name="nik" value={formData.nik} onChange={handleFormChange} placeholder="330xxxxxxxxxxxxx" />
                             <InputField label="Jenis Kelamin" name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleFormChange} type="select">
                                <option value="">Pilih Jenis Kelamin</option>
                                {JENIS_KELAMIN_LIST.map(jk => <option key={jk} value={jk}>{jk}</option>)}
                             </InputField>
                             <InputField label="Tempat Lahir" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleFormChange} />
                             <InputField label="Tgl Lahir" name="tgl_lahir" value={formData.tgl_lahir} onChange={handleFormChange} type="date" />
                             <InputField label="Pekerjaan" name="pekerjaan" value={formData.pekerjaan} onChange={handleFormChange} />
                             <InputField label="Pendidikan" name="pendidikan" value={formData.pendidikan} onChange={handleFormChange} type="select">
                                <option value="">Pilih Pendidikan</option>
                                {PENDIDIKAN_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                             </InputField>
                             <InputField label="Agama" name="agama" value={formData.agama} onChange={handleFormChange} type="select">
                                <option value="">Pilih Agama</option>
                                {AGAMA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                             </InputField>
                             <InputField label="No. HP / WA" name="no_hp" value={formData.no_hp} onChange={handleFormChange} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Alamat</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                            <InputField label="Desa" name="desa" value={formData.desa} onChange={handleFormChange} type="select" required disabled={currentUser.role === 'admin_desa'}>
                                <option value="">Pilih Desa</option>
                                {DESA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                            </InputField>
                            <InputField label="RT" name="rt" value={formData.rt} onChange={handleFormChange} placeholder="001" />
                            <InputField label="RW" name="rw" value={formData.rw} onChange={handleFormChange} placeholder="001" />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md mr-2" disabled={isSubmitting}>Tutup</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center" disabled={isSubmitting}>
                            {isSubmitting && <Spinner size="sm" />}
                            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default BPDPage;

