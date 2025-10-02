import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Spinner from '../components/common/Spinner';
import InputField from '../components/common/InputField';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import Button from '../components/common/Button';
import { FiPlus, FiEdit, FiTrash2, FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import { KATEGORI_PENDAPATAN, KATEGORI_BELANJA } from '../utils/constants';

// Komponen Kartu Statistik
const StatCard = ({ title, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md flex items-center gap-4">
        <div className={`p-3 rounded-full text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    </div>
);

const PenganggaranPage = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useNotification();
    
    // State untuk data dari Firestore
    const [anggaranList, setAnggaranList] = useState([]);
    const [transaksiList, setTransaksiList] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAnggaran, setSelectedAnggaran] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [filterTahun, setFilterTahun] = useState(new Date().getFullYear());

    // Mengambil data Anggaran dan Realisasi (Transaksi) dari Firestore
    useEffect(() => {
        if (!currentUser || !currentUser.desa) {
            setLoading(false);
            return;
        }

        const unsubAnggaran = onSnapshot(query(collection(db, 'penganggaran'), where("desa", "==", currentUser.desa)), (snapshot) => {
            setAnggaranList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        const unsubTransaksi = onSnapshot(query(collection(db, 'penatausahaan'), where("desa", "==", currentUser.desa)), (snapshot) => {
            setTransaksiList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const timer = setTimeout(() => setLoading(false), 500); // Memberi waktu data untuk sinkron

        return () => {
            unsubAnggaran();
            unsubTransaksi();
            clearTimeout(timer);
        };
    }, [currentUser]);

    // Mengolah data untuk ditampilkan di tabel dan kartu statistik
    const { pendapatan, belanja, totalAnggaran, totalRealisasi, sisaAnggaran } = useMemo(() => {
        
        const anggaranTahunIni = anggaranList.filter(a => a.tahun === Number(filterTahun));
        const transaksiTahunIni = transaksiList.filter(t => {
            const tDate = t.tanggal?.toDate ? t.tanggal.toDate() : new Date(t.tanggal);
            return !isNaN(tDate) && tDate.getFullYear() === Number(filterTahun);
        });

        const processData = (kategoriList, jenis) => {
            const groupedByBidang = {};
            
            kategoriList.forEach(kat => {
                const anggaranItems = anggaranTahunIni.filter(a => a.kategori === kat.nama && a.jenis === jenis);
                if (anggaranItems.length > 0) {
                    if (!groupedByBidang[kat.bidang]) groupedByBidang[kat.bidang] = [];
                    
                    anggaranItems.forEach(item => {
                        const realisasi = transaksiTahunIni
                            .filter(t => t.kategori === item.kategori && t.jenis === jenis)
                            .reduce((sum, t) => sum + t.jumlah, 0);
                        groupedByBidang[kat.bidang].push({ ...item, realisasi });
                    });
                }
            });
            return groupedByBidang;
        };
        
        const pendapatanData = processData(KATEGORI_PENDAPATAN, 'Pendapatan');
        const belanjaData = processData(KATEGORI_BELANJA, 'Belanja');

        const totalAnggaranPendapatan = anggaranTahunIni.filter(a => a.jenis === 'Pendapatan').reduce((sum, a) => sum + a.jumlah, 0);
        const totalRealisasiPendapatan = transaksiTahunIni.filter(t => t.jenis === 'Pendapatan').reduce((sum, t) => sum + t.jumlah, 0);
        const totalAnggaranBelanja = anggaranTahunIni.filter(a => a.jenis === 'Belanja').reduce((sum, a) => sum + a.jumlah, 0);
        const totalRealisasiBelanja = transaksiTahunIni.filter(t => t.jenis === 'Belanja').reduce((sum, t) => sum + t.jumlah, 0);

        return {
            pendapatan: pendapatanData,
            belanja: belanjaData,
            totalAnggaran: totalAnggaranPendapatan - totalAnggaranBelanja,
            totalRealisasi: totalRealisasiPendapatan - totalRealisasiBelanja,
            sisaAnggaran: (totalAnggaranPendapatan - totalAnggaranBelanja) - (totalRealisasiPendapatan - totalRealisasiBelanja)
        };
    }, [anggaranList, transaksiList, filterTahun]);
    
    const formatCurrency = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`;

    const handleOpenModal = (item = null) => {
        setSelectedAnggaran(item);
        if (item) {
            setFormData(item);
        } else {
            setFormData({
                jenis: 'Belanja',
                desa: currentUser.desa,
                tahun: filterTahun,
                jumlah: 0,
                kategori: '',
                bidang: '',
                kode_rekening: '',
                uraian: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        setSelectedAnggaran(null);
        setFormData({});
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        let updatedFormData = { ...formData, [name]: value };

        if (name === 'jenis') {
            updatedFormData.kategori = '';
            updatedFormData.bidang = '';
            updatedFormData.kode_rekening = '';
            updatedFormData.uraian = '';
        }
        
        if (name === 'kategori') {
            const allKategori = [...KATEGORI_PENDAPATAN, ...KATEGORI_BELANJA];
            const selectedKat = allKategori.find(k => k.nama === value);
            if (selectedKat) {
                updatedFormData.bidang = selectedKat.bidang;
                updatedFormData.kode_rekening = selectedKat.kode_rekening;
                updatedFormData.uraian = selectedKat.nama;
            } else {
                updatedFormData.bidang = '';
                updatedFormData.kode_rekening = '';
                updatedFormData.uraian = '';
            }
        }

        setFormData(updatedFormData);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const allKategori = [...KATEGORI_PENDAPATAN, ...KATEGORI_BELANJA];
            const selectedKat = allKategori.find(k => k.nama === formData.kategori);

            if (!formData.kategori || !selectedKat) {
                showNotification("Kategori wajib dipilih dan valid.", 'error');
                setIsSubmitting(false);
                return;
            }

            const dataToSave = {
                ...formData,
                jumlah: Number(formData.jumlah) || 0,
                tahun: Number(filterTahun),
                desa: currentUser.desa,
                bidang: selectedKat.bidang || '',
                kode_rekening: selectedKat.kode_rekening || '',
                uraian: selectedKat.nama || '',
            };

            if (selectedAnggaran) {
                await updateDoc(doc(db, 'penganggaran', selectedAnggaran.id), dataToSave);
                showNotification('Anggaran berhasil diperbarui', 'success');
            } else {
                await addDoc(collection(db, 'penganggaran'), dataToSave);
                showNotification('Anggaran berhasil ditambahkan', 'success');
            }
            handleCloseModal();
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const confirmDelete = (item) => {
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!itemToDelete) return;
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, 'penganggaran', itemToDelete.id));
            showNotification('Anggaran berhasil dihapus', 'success');
        } catch (error) {
            showNotification(`Gagal menghapus: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
            setIsDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    const kategoriOptions = formData.jenis === 'Pendapatan' ? KATEGORI_PENDAPATAN : KATEGORI_BELANJA;
    const tahunOptions = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
    
    const renderTableSection = (title, data, colorClass) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h3 className={`text-xl font-semibold ${colorClass} mb-4`}>{title}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-4 py-3">Uraian</th>
                            <th className="px-4 py-3 text-right">Anggaran (Rp)</th>
                            <th className="px-4 py-3 text-right">Realisasi (Rp)</th>
                            <th className="px-4 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(data).length > 0 ? Object.entries(data).map(([bidang, items]) => (
                            <React.Fragment key={bidang}>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <td colSpan="4" className="px-4 py-2 font-bold text-gray-800 dark:text-gray-200">{bidang}</td>
                                </tr>
                                {items.map(item => (
                                    <tr key={item.id} className="border-b dark:border-gray-700">
                                        <td className="px-4 py-3 pl-8">{item.uraian}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.jumlah)}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.realisasi)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-4">
                                                <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:text-blue-700" title="Edit"><FiEdit /></button>
                                                <button onClick={() => confirmDelete(item)} className="text-red-500 hover:text-red-700" title="Hapus"><FiTrash2 /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        )) : (
                            <tr><td colSpan="4" className="text-center py-6 italic text-gray-500">Belum ada data anggaran.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Penganggaran APBDes</h1>
                <div className="flex items-center gap-4">
                     <InputField label="Tahun Anggaran" name="tahun" type="select" value={filterTahun} onChange={(e) => setFilterTahun(Number(e.target.value))}>
                        {tahunOptions.map(tahun => <option key={tahun} value={tahun}>{tahun}</option>)}
                    </InputField>
                    <Button onClick={() => handleOpenModal()} variant="primary" className="self-end"><FiPlus/> Tambah Anggaran</Button>
                </div>
            </div>
            
            {loading ? <div className="flex justify-center p-8"><Spinner /></div> : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Total Anggaran" value={formatCurrency(totalAnggaran)} icon={<FiDollarSign size={24} />} colorClass="bg-blue-500" />
                        <StatCard title="Total Realisasi" value={formatCurrency(totalRealisasi)} icon={<FiTrendingUp size={24} />} colorClass="bg-yellow-500" />
                        <StatCard title="Sisa Anggaran" value={formatCurrency(sisaAnggaran)} icon={<FiTrendingDown size={24} />} colorClass={sisaAnggaran >= 0 ? "bg-green-500" : "bg-red-500"} />
                    </div>
                    <div className="space-y-6">
                        {renderTableSection("Anggaran Pendapatan", pendapatan, "text-green-600 dark:text-green-400")}
                        {renderTableSection("Anggaran Belanja", belanja, "text-red-600 dark:text-red-400")}
                    </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedAnggaran ? "Edit Anggaran" : "Tambah Anggaran"}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <InputField label="Jenis" name="jenis" type="select" value={formData.jenis || 'Belanja'} onChange={handleFormChange}>
                        <option value="Pendapatan">Pendapatan</option>
                        <option value="Belanja">Belanja</option>
                    </InputField>

                    <InputField label="Kategori" name="kategori" type="select" value={formData.kategori || ''} onChange={handleFormChange} required>
                        <option value="">-- Pilih Kategori --</option>
                        {kategoriOptions.map(k => <option key={k.nama} value={k.nama}>{k.nama}</option>)}
                    </InputField>
                    
                    <InputField label="Bidang" name="bidang" type="text" value={formData.bidang || ''} disabled placeholder="Akan terisi otomatis"/>
                    <InputField label="Kode Rekening" name="kode_rekening" type="text" value={formData.kode_rekening || ''} disabled placeholder="Akan terisi otomatis"/>
                    <InputField label="Jumlah (Rp)" name="jumlah" type="number" value={formData.jumlah || ''} onChange={handleFormChange} required />

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700 gap-2">
                        <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>{selectedAnggaran ? "Simpan Perubahan" : "Simpan"}</Button>
                    </div>
                </form>
            </Modal>
            
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                isLoading={isSubmitting}
                title="Konfirmasi Hapus Anggaran"
                message={`Anda yakin ingin menghapus anggaran "${itemToDelete?.kategori}"?`}
            />
        </div>
    );
};

export default PenganggaranPage;

