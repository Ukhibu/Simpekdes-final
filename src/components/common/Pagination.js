import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/**
 * Komponen Paginasi berbasis Desa.
 * @param {string[]} desaList - Daftar semua nama desa.
 * @param {string} currentDesa - Desa yang sedang aktif.
 * @param {function} onPageChange - Fungsi untuk mengubah desa yang aktif.
 */
const Pagination = ({ desaList, currentDesa, onPageChange }) => {
    // Jangan tampilkan paginasi jika hanya ada satu atau tidak ada desa
    if (!desaList || desaList.length <= 1) {
        return null;
    }

    const currentIndex = desaList.indexOf(currentDesa);

    const handlePrevious = () => {
        if (currentIndex > 0) {
            onPageChange(desaList[currentIndex - 1]);
        }
    };

    const handleNext = () => {
        if (currentIndex < desaList.length - 1) {
            onPageChange(desaList[currentIndex + 1]);
        }
    };

    return (
        <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sm:px-6 rounded-b-lg">
            {/* Navigasi untuk mobile */}
            <div className="flex-1 flex justify-between sm:hidden">
                <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Sebelumnya
                </button>
                <button
                    onClick={handleNext}
                    disabled={currentIndex === desaList.length - 1}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Berikutnya
                </button>
            </div>

            {/* Navigasi untuk desktop */}
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        Menampilkan data untuk Desa <span className="font-bold text-blue-600 dark:text-blue-400">{currentDesa}</span>
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <span className="sr-only">Sebelumnya</span>
                            <FiChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
                            Halaman {currentIndex + 1} dari {desaList.length}
                        </span>
                        <button
                            onClick={handleNext}
                            disabled={currentIndex === desaList.length - 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <span className="sr-only">Berikutnya</span>
                            <FiChevronRight className="h-5 w-5" />
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
};

export default Pagination;

