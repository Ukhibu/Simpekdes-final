import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Spinner from '../common/Spinner';

const PerangkatDesaChart = ({ data, loading }) => {
    if (loading) {
        return <div className="h-80 flex justify-center items-center"><Spinner /></div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Jumlah Aparatur per Desa</h3>
            <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={data}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="desa" tick={{ fill: '#6b7280' }} />
                        <YAxis tick={{ fill: '#6b7280' }} />
                        <Tooltip
                            contentStyle={{ 
                                background: 'rgba(255, 255, 255, 0.8)', 
                                backdropFilter: 'blur(5px)',
                                border: '1px solid #e5e7eb',
                                color: '#1f2937',
                                borderRadius: '0.5rem'
                            }}
                        />
                        <Legend />
                        <Bar dataKey="jumlah" fill="#3b82f6" name="Jumlah Aparatur" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PerangkatDesaChart;
