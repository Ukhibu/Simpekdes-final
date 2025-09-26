import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FiUsers } from 'react-icons/fi';
import '../../styles/Charts.css'; // Impor file CSS baru

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4242'];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        return (
            <div className="custom-tooltip">
                <p className="label">{`${data.name} : ${data.value}`}</p>
            </div>
        );
    }
    return null;
};

const JabatanChart = ({ data }) => {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        
        const jabatanMap = new Map();
        data.forEach(p => {
            const jabatan = p.jabatan || 'Belum Diisi';
            jabatanMap.set(jabatan, (jabatanMap.get(jabatan) || 0) + 1);
        });

        return Array.from(jabatanMap, ([name, value]) => ({ name, value }));
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FiUsers size={48} className="mb-4" />
                <h3 className="font-bold text-lg">Data Jabatan Kosong</h3>
                <p className="text-sm">Tidak ada data aparatur yang tersedia untuk ditampilkan.</p>
            </div>
        );
    }
    
    return (
        <>
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                Komposisi Jabatan Aparatur
            </h2>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </>
    );
};

export default JabatanChart;

