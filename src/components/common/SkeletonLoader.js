import React from 'react';

// Komponen untuk satu baris skeleton
const SkeletonRow = ({ columns }) => (
  <tr className="bg-white dark:bg-gray-800 animate-pulse">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </td>
    ))}
  </tr>
);

// Komponen utama Skeleton Loader untuk Tabel
const SkeletonLoader = ({ rows = 10, columns = 5 }) => {
  return (
    <div className="table-container-modern">
      <table className="table-modern">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-6 py-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SkeletonLoader;

