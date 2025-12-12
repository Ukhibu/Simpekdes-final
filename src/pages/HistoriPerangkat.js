import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FiArchive, FiSearch, FiFileText, FiRefreshCw, FiUserCheck, FiCalendar, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi';
import SkeletonLoader from '../components/common/SkeletonLoader';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { restorePerangkatFromHistory } from '../utils/restoreService';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';

const HistoriPerangkat = () => {
  const navigate = useNavigate();
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State untuk Modal Konfirmasi
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedPerangkat, setSelectedPerangkat] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Hook notifikasi dengan fallback aman
  let showNotification;
  try {
    const notifyContext = useNotification();
    showNotification = notifyContext.showNotification;
  } catch (e) {
    showNotification = (msg) => alert(msg);
  }

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, 'historyPerangkatDesa'), orderBy('tanggalPurna', 'desc'));
        const querySnapshot = await getDocs(q);
        const historyData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHistoryList(historyData);
      } catch (error) {
        console.error("Error fetching history data: ", error);
        if(showNotification) showNotification("Gagal memuat data riwayat", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Membuka modal konfirmasi
  const openRestoreConfirmation = (perangkat) => {
    setSelectedPerangkat(perangkat);
    setIsRestoreModalOpen(true);
  };

  // Menutup modal
  const closeRestoreModal = () => {
    setIsRestoreModalOpen(false);
    setSelectedPerangkat(null);
  };

  // Eksekusi pemulihan data
  const handleExecuteRestore = async () => {
    if (!selectedPerangkat) return;

    setIsRestoring(true);
    try {
        await restorePerangkatFromHistory(selectedPerangkat.id);
        
        // Hapus item dari list lokal agar tidak perlu refresh halaman
        setHistoryList(prev => prev.filter(item => item.id !== selectedPerangkat.id));
        
        if(showNotification) {
            showNotification("Data berhasil dikembalikan ke menu Perangkat Aktif.", "success");
        }
        closeRestoreModal();
    } catch (error) {
        console.error(error);
        if(showNotification) {
            showNotification("Gagal mengembalikan data: " + error.message, "error");
        }
    } finally {
        setIsRestoring(false);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!searchTerm) {
      return historyList;
    }
    return historyList.filter(perangkat =>
      perangkat.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perangkat.jabatan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perangkat.nip?.includes(searchTerm) ||
      perangkat.desa?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [historyList, searchTerm]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // Handle Firestore Timestamp
    if (timestamp.toDate) {
      return format(timestamp.toDate(), 'd MMMM yyyy', { locale: id });
    }
    // Handle String or Date object
    try {
        return format(new Date(timestamp), 'd MMMM yyyy', { locale: id });
    } catch (e) {
        return 'Tanggal tidak valid';
    }
  };

  if (loading) {
    return <SkeletonLoader columns={4} />;
  }

  return (
    <div className="space-y-6 pb-20">
        {/* --- Header Section --- */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button 
                        onClick={() => navigate(-1)} 
                        className="flex items-center text-sm text-gray-500 hover:text-blue-600 mb-2 transition-colors"
                    >
                        <FiArrowLeft className="mr-1" /> Kembali
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                            <FiArchive size={24} />
                        </div>
                        Riwayat Purna Tugas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 ml-12">
                        Arsip data perangkat desa yang telah menyelesaikan masa baktinya.
                    </p>
                </div>
                
                {/* Stats Card Mini */}
                <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Total Arsip</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{historyList.length}</p>
                    </div>
                    <div className="h-10 w-1 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm text-gray-400">
                        <FiFileText size={20} />
                    </div>
                </div>
            </div>
        </div>

        {/* --- Alert Info --- */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-xl flex items-start gap-3">
            <FiAlertTriangle className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={18} />
            <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-bold">Salah masuk riwayat?</p>
                <p className="opacity-90 mt-1">
                    Gunakan tombol <strong>"Kembalikan"</strong> untuk memulihkan perangkat. 
                    Setelah dipulihkan, segera perbarui <strong>Tanggal Akhir Jabatan</strong> di menu Data Perangkat agar tidak masuk kembali ke sini.
                </p>
            </div>
        </div>

        {/* --- Search & Filter --- */}
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <FiSearch size={20} />
            </div>
            <input
                type="text"
                placeholder="Cari berdasarkan nama, jabatan, NIP, atau desa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
        </div>

        {/* --- Data List --- */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            
            {/* Tampilan Desktop (Table) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Perangkat Desa</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Jabatan Terakhir</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Desa</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider">Tanggal Purna</th>
                            <th scope="col" className="px-6 py-4 font-bold tracking-wider text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {filteredHistory.length > 0 ? filteredHistory.map(perangkat => (
                            <tr key={perangkat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold text-xs uppercase">
                                            {perangkat.nama ? perangkat.nama.substring(0,2) : '??'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{perangkat.nama}</p>
                                            <p className="text-xs text-gray-500">{perangkat.nip ? `NIP: ${perangkat.nip}` : 'NIP: -'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs font-medium border border-gray-200 dark:border-gray-600">
                                        {perangkat.jabatan}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{perangkat.desa || '-'}</td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <FiCalendar className="text-gray-400" />
                                    {formatDate(perangkat.tanggalPurna)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => openRestoreConfirmation(perangkat)}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300 rounded-lg text-xs font-medium transition-all shadow-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-green-900/20"
                                        title="Kembalikan ke data aktif"
                                    >
                                        <FiRefreshCw />
                                        Kembalikan
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="text-center py-12">
                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-3">
                                            <FiFileText size={32} className="opacity-50" />
                                        </div>
                                        <p>Tidak ada data riwayat yang ditemukan.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Tampilan Mobile (Card Grid) */}
            <div className="md:hidden p-4 space-y-4">
                {filteredHistory.length > 0 ? filteredHistory.map(perangkat => (
                    <div key={perangkat.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <FiArchive size={60} />
                        </div>
                        
                        <div className="flex items-start justify-between relative z-10">
                            <div className="flex gap-3">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold shrink-0">
                                    {perangkat.nama ? perangkat.nama.substring(0,1) : '?'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{perangkat.nama}</h3>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{perangkat.jabatan}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{perangkat.desa}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                                <span className="block text-[10px] uppercase font-bold text-gray-400">Tanggal Purna</span>
                                <span className="flex items-center gap-1 mt-0.5">
                                    <FiCalendar /> {formatDate(perangkat.tanggalPurna)}
                                </span>
                            </div>
                            
                            <button 
                                onClick={() => openRestoreConfirmation(perangkat)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors dark:bg-green-900/30 dark:text-green-300"
                            >
                                <FiUserCheck />
                                <span>Kembalikan</span>
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10 text-gray-500">
                        <FiFileText className="mx-auto text-4xl text-gray-300 mb-2" />
                        <p>Tidak ada data.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Modal Konfirmasi */}
        <ConfirmationModal 
            isOpen={isRestoreModalOpen} 
            onClose={closeRestoreModal} 
            onConfirm={handleExecuteRestore} 
            isLoading={isRestoring} 
            title="Kembalikan Data?" 
            message={
                <span>
                    Apakah Anda yakin ingin mengembalikan <strong>{selectedPerangkat?.nama}</strong> ke data aktif?
                    <br/><br/>
                    <span className="text-amber-600 text-sm italic">
                        PENTING: Segera perbarui Tanggal Akhir Jabatan di menu Data Perangkat setelah dikembalikan agar data tidak otomatis masuk ke riwayat lagi.
                    </span>
                </span>
            }
            variant="success"
            confirmLabel="Ya, Kembalikan"
        />
    </div>
  );
};

export default HistoriPerangkat;