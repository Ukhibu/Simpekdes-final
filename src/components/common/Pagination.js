import React, { useState, useEffect, useRef } from 'react';
import './Pagination.css'; // Impor file CSS baru

const Pagination = ({ desaList, currentDesa, onPageChange }) => {
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const containerRef = useRef(null);
  const buttonRefs = useRef([]);

  // Cari index desa saat ini di dalam list
  const currentIndex = desaList ? desaList.indexOf(currentDesa) : -1;

  useEffect(() => {
    // Pastikan elemen dan referensi ada sebelum menghitung posisi
    if (
      currentIndex !== -1 && 
      buttonRefs.current[currentIndex] && 
      containerRef.current
    ) {
      const activeButton = buttonRefs.current[currentIndex];
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        left: `${buttonRect.left - containerRect.left}px`,
        width: `${buttonRect.width}px`,
        height: `${buttonRect.height}px`,
      });
    }
  }, [currentIndex, desaList]); // Hitung ulang saat index atau list berubah

  // Jangan render jika list kosong atau hanya 1 (opsional, bisa dihapus jika ingin tetap tampil)
  if (!desaList || desaList.length <= 1) {
    return null;
  }

  return (
    <div className="pagination-wrapper overflow-x-auto">
      <div className="pagination-container" ref={containerRef}>
        {/* Indikator Animasi */}
        <div className="indicator shadow-md" style={indicatorStyle}></div>
        
        {desaList.map((desa, index) => (
          <button
            key={desa}
            ref={(el) => (buttonRefs.current[index] = el)}
            className={`pag-link ${index === currentIndex ? 'active' : ''}`}
            onClick={() => onPageChange(desa)}
            title={`Lihat Data Desa ${desa}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Pagination;