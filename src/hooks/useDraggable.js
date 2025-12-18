import { useState, useEffect, useRef } from 'react';

export const useDraggable = (initialPosition = { x: 0, y: 0 }) => {
  const [position, setPosition] = useState(initialPosition);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Menggunakan requestAnimationFrame untuk performa 60fps di mobile
  const requestRef = useRef();

  const handleDragStart = (e) => {
    // Hanya bereaksi pada klik kiri atau touch
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging.current = true;
    hasMoved.current = false;
    
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    
    dragStart.current = { x: clientX, y: clientY };
    startPos.current = { ...position };

    // Mencegah scroll saat drag di mobile & seleksi teks
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
  };

  const handleDragging = (e) => {
    if (!isDragging.current) return;

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;

    // Threshold movement untuk membedakan klik dan drag
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMoved.current = true;
    }

    // Update posisi menggunakan requestAnimationFrame agar tidak lag
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    requestRef.current = requestAnimationFrame(() => {
        setPosition({
            x: startPos.current.x + dx,
            y: startPos.current.y + dy
        });
    });
  };

  const handleDragEnd = () => {
    if (isDragging.current) {
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  };

  useEffect(() => {
    const options = { passive: false }; // Penting untuk mobile preventDefault
    window.addEventListener('mousemove', handleDragging, options);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragging, options);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragging);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragging);
      window.removeEventListener('touchend', handleDragEnd);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []); // Empty dependency array agar event listener hanya dipasang sekali

  return { position, handleDragStart, hasMoved };
};