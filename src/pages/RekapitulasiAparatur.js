import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Spinner from '../components/common/Spinner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiEdit, FiSave, FiDownload } from 'react-icons/fi';

// Daftar Desa sesuai urutan di dokumen
const DESA_LIST = [
    "SAMBONG", "TRIBUANA", "SAWANGAN", "SIDARATA", "BADAKARYA", "BONDOLHARJO", 
    "PUNGGELAN", "KARANGSARI", "KECEPIT", "DANAKERTA", "KLAPA", "JEMBANGAN", 
    "PURWASANA", "PETUGURAN", "TANJUNGTIRTA", "TLAGA", "MLAYA"
].map(name => name.toUpperCase());

// Jabatan yang akan direkap
const JABATAN_REKAP = {
    kades: "Kepala Desa",
    sekdes: "Sekretaris Desa",
    perangkatSiltap: ["Kaur", "Kasi", "Kadus", "Staf"], // Staf juga dianggap perangkat
};


const RekapitulasiAparatur = () => {
    const [allPerangkat, setAllPerangkat] = useState([]);
    const [loading, setLoading] = useState(true);
    // State untuk pengaturan tanda tangan
    const [exportConfig, setExportConfig] = useState({});
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Ambil data perangkat untuk tabel
        const q = query(collection(db, 'perangkat'));
        const unsubscribePerangkat = onSnapshot(q, (snapshot) => {
            setAllPerangkat(snapshot.docs.map(doc => doc.data()));
            setLoading(false);
        });

        // Ambil data konfigurasi untuk tanda tangan
        const fetchConfig = async () => {
            const docRef = doc(db, 'settings', 'exportConfig');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setExportConfig(docSnap.data());
            } else {
                // Set default jika belum ada
                setExportConfig({
                    namaPenandaTangan: 'MOH.JULIANTO, S.E, M.Si.',
                    jabatanPenandaTangan: 'Camat Punggelan',
                    pangkatPenandaTangan: 'Pembina Tk.I',
                    nipPenandaTangan: '19720714 199203 1 006'
                });
            }
        };

        fetchConfig();
        
        return () => unsubscribePerangkat();
    }, []);

    const rekapData = useMemo(() => {
        if (loading) return [];
        return DESA_LIST.map(desa => {
            const perangkatDesa = allPerangkat.filter(p => p.desa && p.desa.toUpperCase() === desa);
            
            // [PERBAIKAN] Perangkat aktif adalah yang punya nama, jabatan, dan belum purna tugas.
            const activePerangkat = perangkatDesa.filter(p => 
                p.nama &&
                p.jabatan && 
                (!p.akhir_jabatan || new Date(p.akhir_jabatan) >= new Date())
            );

            // Hitung jumlah Kades, Sekdes, dan Perangkat Lainnya dari daftar yang AKTIF
            const kades = activePerangkat.filter(p => p.jabatan.toLowerCase() === JABATAN_REKAP.kades.toLowerCase() || p.jabatan.toLowerCase() === 'pj. kepala desa').length;
            const sekdes = activePerangkat.filter(p => p.jabatan.toLowerCase() === JABATAN_REKAP.sekdes.toLowerCase()).length;
            const perangkatSiltap = activePerangkat.filter(p => 
                p.jabatan.toLowerCase() !== JABATAN_REKAP.kades.toLowerCase() && 
                p.jabatan.toLowerCase() !== 'pj. kepala desa' &&
                p.jabatan.toLowerCase() !== JABATAN_REKAP.sekdes.toLowerCase()
            ).length;

            // [PERBAIKAN] Jabatan Belum Diisi adalah selisih dari total entri dikurangi perangkat yang aktif.
            // Ini secara otomatis mencakup jabatan yang kosong, purna tugas, dan yang dikosongkan via aksi.
            const jabatanKosong = perangkatDesa.length - activePerangkat.length;
            
            return { 
                desa, 
                kades, 
                sekdes, 
                perangkatSiltap, 
                jabatanKosong,
                total: perangkatDesa.length 
            };
        });
    }, [allPerangkat, loading]);

    const totalKeseluruhan = useMemo(() => {
        return rekapData.reduce((acc, curr) => ({
            kades: acc.kades + curr.kades,
            sekdes: acc.sekdes + curr.sekdes,
            perangkatSiltap: acc.perangkatSiltap + curr.perangkatSiltap,
            jabatanKosong: acc.jabatanKosong + curr.jabatanKosong,
            total: acc.total + curr.total,
        }), { kades: 0, sekdes: 0, perangkatSiltap: 0, jabatanKosong: 0, total: 0 });
    }, [rekapData]);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, 'settings', 'exportConfig');
            await setDoc(docRef, exportConfig, { merge: true });
            alert('Pengaturan tanda tangan berhasil disimpan!');
            setIsEditingConfig(false);
        } catch (error) {
            alert('Gagal menyimpan pengaturan.');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const getFormattedDate = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("JUMLAH APARATUR PEMERINTAH DESA", doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.text("SE KECAMATAN PUNGGELAN KABUPATEN BANJARNEGARA", doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        const tableColumn = ["NO", "NAMA DESA", "Kades", "Sekdes", "Perangkat Lainnya", "Jabatan Belum Diisi", "JUMLAH TOTAL"];
        
        const tableRows = rekapData.map((item, index) => [index + 1, item.desa, item.kades, item.sekdes, item.perangkatSiltap, item.jabatanKosong, item.total]);
        
        const totalRow = ["", "JUMLAH", totalKeseluruhan.kades, totalKeseluruhan.sekdes, totalKeseluruhan.perangkatSiltap, totalKeseluruhan.jabatanKosong, totalKeseluruhan.total];
        
        tableRows.push(totalRow);
        autoTable(doc, { 
            head: [tableColumn], 
            body: tableRows, 
            startY: 30, 
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
            didDrawCell: (data) => {
                if (data.row.index === rekapData.length) {
                    doc.setFont('helvetica', 'bold');
                }
            }
        });
        const finalY = (doc).lastAutoTable.finalY + 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Punggelan, ${getFormattedDate()}`, doc.internal.pageSize.getWidth() - 20, finalY, { align: 'right' });
        doc.text(exportConfig.jabatanPenandaTangan, doc.internal.pageSize.getWidth() - 20, finalY + 7, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.text(exportConfig.namaPenandaTangan, doc.internal.pageSize.getWidth() - 20, finalY + 28, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(exportConfig.pangkatPenandaTangan, doc.internal.pageSize.getWidth() - 20, finalY + 35, { align: 'right' });
        doc.text(`NIP. ${exportConfig.nipPenandaTangan}`, doc.internal.pageSize.getWidth() - 20, finalY + 42, { align: 'right' });
        doc.save('rekapitulasi_aparatur_desa.pdf');
    };

    if (loading) return <Spinner size="lg" />;

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Rekapitulasi Jumlah Aparatur Desa</h2>
                    <button onClick={handleExportPDF} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                       <FiDownload/> Ekspor ke PDF
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <thead className="text-xs text-black dark:text-white uppercase bg-gray-200 dark:bg-gray-700 font-bold">
                            <tr>
                                <th rowSpan="2" className="border border-gray-300 dark:border-gray-600 p-2">NO</th>
                                <th rowSpan="2" className="border border-gray-300 dark:border-gray-600 p-2">NAMA DESA</th>
                                <th colSpan="4" className="border border-gray-300 dark:border-gray-600 p-2">Perangkat</th>
                                <th rowSpan="2" className="border border-gray-300 dark:border-gray-600 p-2">JUMLAH TOTAL</th>
                            </tr>
                            <tr>
                                <th className="border border-gray-300 dark:border-gray-600 p-2">Kades</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2">Sekdes</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2">Perangkat Lainnya</th>
                                <th className="border border-gray-300 dark:border-gray-600 p-2">Jabatan Belum Diisi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rekapData.map((item, index) => (
                                <tr key={item.desa} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="border border-gray-300 dark:border-gray-600 p-2">{index + 1}</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2 text-left">{item.desa}</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2">{item.kades}</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2">{item.sekdes}</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2">{item.perangkatSiltap}</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2">{item.jabatanKosong}</td>
                                    <td className="border border-gray-300 dark:border-gray-600 p-2 font-bold">{item.total}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="font-bold bg-gray-200 dark:bg-gray-700">
                            <tr>
                                <td colSpan="2" className="border border-gray-300 dark:border-gray-600 p-2 text-center">JUMLAH</td>
                                <td className="border border-gray-300 dark:border-gray-600 p-2">{totalKeseluruhan.kades}</td>
                                <td className="border border-gray-300 dark:border-gray-600 p-2">{totalKeseluruhan.sekdes}</td>
                                <td className="border border-gray-300 dark:border-gray-600 p-2">{totalKeseluruhan.perangkatSiltap}</td>
                                <td className="border border-gray-300 dark:border-gray-600 p-2">{totalKeseluruhan.jabatanKosong}</td>
                                <td className="border border-gray-300 dark:border-gray-600 p-2">{totalKeseluruhan.total}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md transition-colors duration-300">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pengaturan Tanda Tangan Laporan</h2>
                    <button onClick={() => setIsEditingConfig(!isEditingConfig)} className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <FiEdit /> {isEditingConfig ? 'Batal' : 'Ubah'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Penanda Tangan</label>
                        <input type="text" value={exportConfig.namaPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, namaPenandaTangan: e.target.value})} disabled={!isEditingConfig} className="mt-1 block w-full p-2 border rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-600 dark:border-gray-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Jabatan</label>
                        <input type="text" value={exportConfig.jabatanPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, jabatanPenandaTangan: e.target.value})} disabled={!isEditingConfig} className="mt-1 block w-full p-2 border rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-600 dark:border-gray-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pangkat / Golongan</label>
                        <input type="text" value={exportConfig.pangkatPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, pangkatPenandaTangan: e.target.value})} disabled={!isEditingConfig} className="mt-1 block w-full p-2 border rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-600 dark:border-gray-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NIP</label>
                        <input type="text" value={exportConfig.nipPenandaTangan || ''} onChange={(e) => setExportConfig({...exportConfig, nipPenandaTangan: e.target.value})} disabled={!isEditingConfig} className="mt-1 block w-full p-2 border rounded-md disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-600 dark:border-gray-500"/>
                    </div>
                </div>
                {isEditingConfig && (
                    <div className="flex justify-end mt-4">
                        <button onClick={handleSaveConfig} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                            <FiSave /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RekapitulasiAparatur;

