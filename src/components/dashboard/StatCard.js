import React from 'react';

const StatCard = ({ icon, title, value, color }) => {
    const colorClasses = {
        blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300',
        green: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300',
        yellow: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300',
        indigo: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300',
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-6 transition-transform hover:scale-105 duration-300">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${colorClasses[color] || colorClasses.blue}`}>
                {icon}
            </div>
            <div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">{title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
};

export default StatCard;
