import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FiArchive, FiSearch, FiFileText } from 'react-icons/fi';
import SkeletonLoader from '../components/common/SkeletonLoader';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const HistoriPerangkat = () => {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (!searchTerm) {
      return historyList;
    }
    return historyList.filter(perangkat =>
      perangkat.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perangkat.jabatan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perangkat.nip?.includes(searchTerm)
    );
  }, [historyList, searchTerm]);

  const formatDate = (timestamp) => {
    if (timestamp && timestamp.toDate) {
      return format(timestamp.toDate(), 'd MMMM yyyy', { locale: id });
    }
    return 'Tanggal tidak valid';
  };

  if (loading) {
    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
             <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Riwayat Perangkat Desa</h1>
            <SkeletonLoader type="table" />
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 flex items-center gap-4">
            <FiArchive className="text-3xl text-blue-600 dark:text-blue-400" />
            <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Riwayat Perangkat Desa Purna Tugas</h1>
                <p className="text-gray-500 dark:text-gray-400">Arsip data perangkat desa yang telah menyelesaikan masa baktinya.</p>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Cari berdasarkan nama, jabatan, atau NIP..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nama Lengkap</th>
                            <th scope="col" className="px-6 py-3">Jabatan Terakhir</th>
                            <th scope="col" className="px-6 py-3">Tanggal Purna</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredHistory.length > 0 ? filteredHistory.map(perangkat => (
                            <tr key={perangkat.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{perangkat.nama}</td>
                                <td className="px-6 py-4">{perangkat.jabatan}</td>
                                <td className="px-6 py-4">{formatDate(perangkat.tanggalPurna)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="3" className="text-center py-10">
                                    <FiFileText className="mx-auto text-4xl text-gray-400 mb-2" />
                                    Tidak ada data riwayat yang ditemukan.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default HistoriPerangkat;
