import React, { memo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const MiniChart = ({ type, data, config }) => {
  if (!data || data.length === 0) return null;

  // --- RENDER BAR CHART (Keuangan) ---
  if (type === 'chart_bar') {
    return (
      <div className="w-full h-48 mt-3 bg-white/5 rounded-lg p-2 border border-gray-100/10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey={config.x} tick={{fontSize: 10}} stroke="#888888" />
            <YAxis hide />
            <Tooltip 
                contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', fontSize: '12px', color: '#fff'}} 
                itemStyle={{color: '#fff'}}
            />
            <Bar dataKey={config.bar1} name="Pendapatan" fill="#4ade80" radius={[4, 4, 0, 0]} />
            <Bar dataKey={config.bar2} name="Pengeluaran" fill="#f87171" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // --- RENDER PIE CHART (Penduduk) ---
  if (type === 'chart_pie') {
    return (
      <div className="w-full h-48 mt-3 bg-white/5 rounded-lg p-2 border border-gray-100/10 flex justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={{backgroundColor: '#1f2937', borderRadius: '8px', border: 'none', color: '#fff'}} />
            <Legend iconSize={8} wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
};

// Menggunakan memo agar tidak re-render saat user mengetik atau drag window
export default memo(MiniChart);