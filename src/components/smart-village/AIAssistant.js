import React, { useState, Suspense, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Loader2 } from 'lucide-react';

// --- LAZY LOADING ---
const ChatWindow = React.lazy(() => import('./AIChatWindow'));

const getPageTitle = (path) => {
    if(path.includes('keuangan')) return 'Modul Keuangan';
    if(path.includes('aset')) return 'Modul Aset';
    if(path.includes('surat') || path.includes('sk')) return 'Administrasi Surat';
    if(path === '/app') return 'Dashboard Utama';
    return 'Menu Umum';
};

const AIAssistant = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [pageTitle, setPageTitle] = useState('');
    
    // --- STATE SIZE (BARU) ---
    const [windowSize, setWindowSize] = useState('medium'); // small, medium, large

    // --- DRAGGABLE STATE ---
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);

    useEffect(() => {
        setPageTitle(getPageTitle(location.pathname));
    }, [location.pathname]);

    // --- LOGIKA UKURAN WINDOW ---
    const getSizeClasses = () => {
        switch (windowSize) {
            case 'small': return 'w-[300px] h-[400px]';
            case 'large': return 'w-[95vw] h-[85vh] sm:w-[800px] sm:h-[700px]'; // Mode Besar
            case 'medium': 
            default: return 'w-[85vw] sm:w-[400px] h-[500px] sm:h-[600px]';
        }
    };

    // --- HANDLER DRAG ---
    const handleDragStart = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;
        isDragging.current = true;
        hasMoved.current = false;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        dragStart.current = { x: clientX, y: clientY };
        startPos.current = { ...position };
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleDragging = (e) => {
            if (!isDragging.current) return;
            const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
            const dx = clientX - dragStart.current.x;
            const dy = clientY - dragStart.current.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;
            setPosition({ x: startPos.current.x + dx, y: startPos.current.y + dy });
        };
        const handleDragEnd = () => {
            if (isDragging.current) {
                isDragging.current = false;
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', handleDragging);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleDragging);
        window.addEventListener('touchend', handleDragEnd);
        return () => {
            window.removeEventListener('mousemove', handleDragging);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDragging);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, []);

    const handleToggle = () => {
        if (!hasMoved.current) setIsOpen(!isOpen);
    };

    return (
        <div 
            className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end transition-transform duration-75 ease-out"
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, touchAction: 'none' }}
        >
            {isOpen && (
                <div className="mb-4 origin-bottom-right animate-in zoom-in slide-in-from-bottom-4 duration-300">
                    <div className={`${getSizeClasses()} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700 ring-1 ring-black/5 transition-all duration-300`}>
                        <Suspense fallback={
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-50 dark:bg-slate-900">
                                <Loader2 size={32} className="animate-spin text-indigo-500" />
                                <span className="text-xs font-medium animate-pulse">Memuat Kecerdasan...</span>
                            </div>
                        }>
                            <ChatWindow 
                                onClose={() => setIsOpen(false)} 
                                pageContext={{ title: pageTitle }}
                                currentSize={windowSize}
                                onResize={setWindowSize}
                            />
                        </Suspense>
                    </div>
                </div>
            )}

            <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                onClick={handleToggle}
                className={`
                    cursor-grab active:cursor-grabbing w-14 h-14 sm:w-16 sm:h-16 
                    rounded-full shadow-2xl shadow-indigo-500/40 
                    flex items-center justify-center 
                    transition-all duration-300 hover:scale-105 active:scale-95
                    ${isOpen ? 'bg-slate-800 rotate-90 text-slate-300' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'}
                    relative select-none
                `}
                title="Geser atau Klik untuk Chat"
            >
                {isOpen ? <X className="w-6 h-6 sm:w-8 sm:h-8" /> : (
                    <>
                        <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-20 duration-1000 pointer-events-none"></span>
                        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
                        <span className="absolute top-0 right-0 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 border-2 border-white rounded-full shadow-sm"></span>
                    </>
                )}
            </div>
        </div>
    );
};

export default AIAssistant;