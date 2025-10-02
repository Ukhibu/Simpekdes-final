import React from 'react';
import '../../styles/StrukturOrganisasi.css';
import { FiUsers } from 'react-icons/fi';

const StrukturOrganisasiChart = ({ data, hierarchy }) => {
    // Jika tidak ada data atau konfigurasi hierarki, tampilkan pesan
    if (!data || data.length === 0 || !hierarchy || hierarchy.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <FiUsers size={48} className="mb-4" />
                <h3 className="font-bold text-lg">Data Kepengurusan Kosong</h3>
                <p className="text-sm">Belum ada data atau struktur hierarki belum diatur.</p>
            </div>
        );
    }

    // Kelompokkan pengurus berdasarkan level hierarki yang didefinisikan di config
    const structure = hierarchy.map(level => {
        const members = data.filter(item => {
            if (!item.jabatan) return false;
            // Mencocokkan jabatan dengan kata kunci level (misal: "Seksi" akan cocok dengan "Seksi Olahraga")
            const jabatanLower = item.jabatan.toLowerCase();
            return level.keywords.some(keyword => jabatanLower.includes(keyword.toLowerCase()));
        });
        return { levelTitle: level.title, members };
    }).filter(level => level.members.length > 0); // Hanya tampilkan level yang memiliki anggota

    return (
        <div className="org-chart-container">
            {structure.map((level, levelIndex) => (
                <div key={levelIndex} className="org-level">
                    {level.members.map((member, memberIndex) => (
                        <div key={member.id || memberIndex} className="org-node">
                            <p className="name">{member.nama}</p>
                            <p className="jabatan">{member.jabatan}</p>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default StrukturOrganisasiChart;
