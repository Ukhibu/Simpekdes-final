import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import { FiDollarSign, FiPlus, FiBarChart2, FiEdit, FiTrash2, FiFilter, FiSearch } from 'react-icons/fi';

const DESA_LIST = [ "Punggelan", "Petuguran", "Karangsari", "Jembangan", "Tanjungtirta", "Sawangan", "Bondolharjo", "Danakerta", "Badakarya", "Tribuana", "Sambong", "Klapa", "Kecepit", "Mlaya", "Sidarata", "Purwasana", "Tlaga" ];
const KATEGORI_PENDAPATAN = ["Pendapatan Asli Desa (PAD)", "Dana Transfer", "Pendapatan Lain-lain"];
const KATEGORI_BELANJA = ["Penyelenggaraan Pemerintahan Desa", "Pelaksanaan Pembangunan Desa", "Pembinaan Kemasyarakatan Desa", "Pemberdayaan Masyarakat Desa", "Belanja Tak Terduga"];

const KeuanganDesa = () => {
    const { currentUser } = useAuth();
    const [transaksiList, setTransaksiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTransaksi, setSelectedTransaksi] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Filters
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());
    const [filterDesa, setFilterDesa] = useState(currentUser.role === 'admin_kecamatan' ? 'all' : currentUser.desa);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        let q = collection(db, 'keuangan');
        let constraints = [];
        
        if (currentUser.role === 'admin_desa') {
            constraints.push(where("desa", "==", currentUser.desa));
        } else if (filterDesa !== 'all') {
            constraints.push(where("desa", "==", filterDesa));
        }

        if (filterTahun) {
            constraints.push(where("tahunAnggaran", "==", Number(filterTahun)));
        }
        
        q = query(q, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransaksiList(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, filterDesa, filterTahun]);
    
    const filteredTransaksi = useMemo(() => {
        return transaksiList.filter(t => t.uraian.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [transaksiList, searchTerm]);

    const { totalPendapatan, totalBelanja } = useMemo(() => {
        const pendapatan = filteredTransaksi.filter(t => t.jenis === 'Pendapatan').reduce((sum, t) => sum + Number(t.jumlah), 0);
        const belanja = filteredTransaksi.filter(t => t.jenis === 'Belanja').reduce((sum, t) => sum + Number(t.jumlah), 0);
        return { totalPendapatan: pendapatan, totalBelanja: belanja };
    }, [filteredTransaksi]);

    const handleOpenModal = (transaksi = null) => {
        setSelectedTransaksi(transaksi);
        const initialDesa = currentUser.role === 'admin_desa' ? currentUser.desa : '';
        setFormData(transaksi ? {...transaksi} : { jenis: 'Belanja', desa: initialDesa, tahunAnggaran: filterTahun, tanggalTransaksi: new Date().toISOString().split('T')[0] });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedTransaksi(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = { ...formData, jumlah: Number(formData.jumlah), tahunAnggaran: Number(formData.tahunAnggaran) };
            if (selectedTransaksi) {
                const docRef = doc(db, 'keuangan', selectedTransaksi.id);
                await updateDoc(docRef, dataToSave);
                alert('Transaksi berhasil diperbarui!');
            } else {
                await addDoc(collection(db, 'keuangan'), dataToSave);
                alert('Transaksi berhasil ditambahkan!');
            }
            handleCloseModal();
        } catch (error) {
            console.error("Error saving transaction: ", error);
            alert("Gagal menyimpan transaksi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Yakin ingin menghapus transaksi ini?")) {
            await deleteDoc(doc(db, 'keuangan', id));
            alert("Transaksi berhasil dihapus.");
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Modul Keuangan Desa</h1>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <InputField label="Tahun" type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} />
                    {currentUser.role === 'admin_kecamatan' && (
                        <InputField label="Desa" type="select" value={filterDesa} onChange={(e) => setFilterDesa(e.target.value)}>
                            <option value="all">Semua Desa</option>
                            {DESA_LIST.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                        </InputField>
                    )}
                </div>
                {currentUser.role === 'admin_desa' && (
                    <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                        <FiPlus /> Tambah Transaksi
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                    <FiDollarSign className="mr-3 text-green-500" /> Ringkasan Realisasi Anggaran Tahun {filterTahun}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-bold text-lg text-green-600 dark:text-green-400">Total Pendapatan</h3>
                        <p className="text-3xl font-bold">Rp {totalPendapatan.toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-red-600 dark:text-red-400">Total Belanja</h3>
                        <p className="text-3xl font-bold">Rp {totalBelanja.toLocaleString('id-ID')}</p>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t dark:border-gray-700">
                     <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400">Sisa Anggaran</h3>
                     <p className="text-3xl font-bold">Rp {(totalPendapatan - totalBelanja).toLocaleString('id-ID')}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                        <FiBarChart2 className="mr-3 text-blue-500" /> Detail Transaksi
                    </h2>
                    <InputField type="text" placeholder="Cari uraian..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={<FiSearch />} />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3">Tanggal</th>
                                <th className="px-6 py-3">Uraian</th>
                                <th className="px-6 py-3">Kategori</th>
                                <th className="px-6 py-3">Jenis</th>
                                <th className="px-6 py-3">Jumlah (Rp)</th>
                                {currentUser.role === 'admin_desa' && <th className="px-6 py-3">Aksi</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan="6" className="text-center py-4"><Spinner /></td></tr> : 
                             filteredTransaksi.map(t => (
                                <tr key={t.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-6 py-4">{t.tanggalTransaksi}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{t.uraian}</td>
                                    <td className="px-6 py-4">{t.kategori}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.jenis === 'Pendapatan' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {t.jenis}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold">{Number(t.jumlah).toLocaleString('id-ID')}</td>
                                    {currentUser.role === 'admin_desa' && (
                                        <td className="px-6 py-4 flex items-center space-x-2">
                                            <button onClick={() => handleOpenModal(t)} className="text-blue-500 hover:text-blue-700"><FiEdit /></button>
                                            <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700"><FiTrash2 /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedTransaksi ? "Edit Transaksi" : "Tambah Transaksi"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Jenis Transaksi" name="jenis" type="select" value={formData.jenis} onChange={handleFormChange}>
                        <option value="Belanja">Belanja</option>
                        <option value="Pendapatan">Pendapatan</option>
                    </InputField>
                    <InputField label="Kategori" name="kategori" type="select" value={formData.kategori} onChange={handleFormChange}>
                        <option value="">Pilih Kategori</option>
                        {(formData.jenis === 'Pendapatan' ? KATEGORI_PENDAPATAN : KATEGORI_BELANJA).map(k => <option key={k} value={k}>{k}</option>)}
                    </InputField>
                    <InputField label="Uraian" name="uraian" type="text" value={formData.uraian} onChange={handleFormChange} required />
                    <InputField label="Jumlah (Rp)" name="jumlah" type="number" value={formData.jumlah} onChange={handleFormChange} required />
                    <InputField label="Tanggal Transaksi" name="tanggalTransaksi" type="date" value={formData.tanggalTransaksi} onChange={handleFormChange} required />
                    <InputField label="Tahun Anggaran" name="tahunAnggaran" type="number" value={formData.tahunAnggaran} onChange={handleFormChange} required />
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

export default KeuanganDesa;

