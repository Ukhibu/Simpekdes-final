import React from 'react';

const OrganisasiDetailView = ({ data, config }) => {
    if (!data || !config) return null;

    const DetailItem = ({ label, value }) => (
        <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-gray-800 dark:text-gray-200">{value || '-'}</p>
        </div>
    );
    
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{data.nama}</h3>
                <p className="text-gray-600 dark:text-gray-300">{data.jabatan} - Desa {data.desa}</p>
                 <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1">Periode {data.periode || 'N/A'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.formFields.map(field => {
                    if (!data[field.name]) return null;
                    const value = field.type === 'date' ? formatDate(data[field.name]) : data[field.name];
                    return <DetailItem key={field.name} label={field.label} value={value} />
                })}
            </div>
        </div>
    );
};

export default OrganisasiDetailView;
