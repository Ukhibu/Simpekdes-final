import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const Pagination = ({ onNextPage, onPrevPage, hasNextPage, hasPrevPage, isLoading }) => {
    return (
        <div className="flex justify-end items-center mt-4 space-x-2">
            <button
                onClick={onPrevPage}
                disabled={!hasPrevPage || isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
                <FiChevronLeft className="mr-2" />
                Sebelumnya
            </button>
            <button
                onClick={onNextPage}
                disabled={!hasNextPage || isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
                Berikutnya
                <FiChevronRight className="ml-2" />
            </button>
        </div>
    );
};

export default Pagination;

