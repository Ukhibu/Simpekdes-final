import React, { useState, useEffect, useRef } from 'react';
import './Pagination.css'; // Impor file CSS baru

const Pagination = ({ desaList, currentDesa, onPageChange }) => {
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const containerRef = useRef(null);
  const buttonRefs = useRef([]);

  const currentIndex = desaList.indexOf(currentDesa);

  useEffect(() => {
    if (buttonRefs.current[currentIndex] && containerRef.current) {
      const activeButton = buttonRefs.current[currentIndex];
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorStyle({
        left: `${buttonRect.left - containerRect.left}px`,
        width: `${buttonRect.width}px`,
        height: `${buttonRect.height}px`,
      });
    }
  }, [currentIndex, desaList]); // Recalculate on index or list change

  if (!desaList || desaList.length <= 1) {
    return null;
  }

  return (
    <div className="pagination-wrapper">
      <div className="pagination-container" ref={containerRef}>
        <div className="indicator" style={indicatorStyle}></div>
        {desaList.map((desa, index) => (
          <button
            key={desa}
            ref={(el) => (buttonRefs.current[index] = el)}
            className={`pag-link ${index === currentIndex ? 'active' : ''}`}
            onClick={() => onPageChange(desa)}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Pagination;

