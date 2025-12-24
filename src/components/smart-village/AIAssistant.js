import React, { useState, Suspense, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X, Loader2 } from 'lucide-react';

// --- LAZY LOADING ---
const ChatWindow = React.lazy(() => import('./AIChatWindow'));

const getPageTitle = (path) => {
    if(path.includes('keuangan')) return 'Modul Keuangan';
    if(path.includes('aset')) return 'Modul Aset';
    if(path.includes('EFile') || path.includes('sk')) return 'Server File';
    if(path === '/app') return 'Dashboard Utama';
    return 'Menu Umum';
};

const AIAssistant = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [pageTitle, setPageTitle] = useState('');
    const [windowSize, setWindowSize] = useState('medium'); 
    const [hasUnread, setHasUnread] = useState(false); // State untuk Notifikasi Ping
    
    // State untuk memastikan komponen pernah dimuat (agar tidak berat di awal)
    const [isMounted, setIsMounted] = useState(false);

    // --- DRAGGABLE STATE ---
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);

    useEffect(() => {
        setPageTitle(getPageTitle(location.pathname));
    }, [location.pathname]);

    // Jika dibuka, reset notifikasi dan tandai sudah di-mount
    useEffect(() => {
        if (isOpen) {
            setHasUnread(false);
            setIsMounted(true);
        }
    }, [isOpen]);

    // --- LOGIKA UKURAN WINDOW ---
    const getSizeClasses = () => {
        switch (windowSize) {
            case 'small': return 'w-[300px] h-[400px]';
            case 'large': return 'w-[95vw] h-[85vh] sm:w-[800px] sm:h-[700px]'; 
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

    // Callback saat ada pesan baru dari AI
    const handleNewMessage = () => {
        // Hanya munculkan notifikasi jika window sedang tertutup
        if (!isOpen) {
            setHasUnread(true);
        }
    };

    return (
        <div 
            className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end transition-transform duration-75 ease-out"
            style={{ transform: `translate(${position.x}px, ${position.y}px)`, touchAction: 'none' }}
        >
            {/* WINDOW CHAT 
               PERBAIKAN: Menghapus 'display: none' agar animasi CSS (transition) berjalan mulus.
               Saat tertutup (isOpen=false), kita gunakan 'opacity-0', 'scale-95', dan 'pointer-events-none'
               serta memindahkannya ke 'absolute bottom-0 right-0' agar tidak menghalangi klik.
            */}
            {isMounted && (
                <div 
                    className={`mb-4 origin-bottom-right transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] 
                        ${isOpen 
                            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
                            : 'opacity-0 scale-95 translate-y-4 pointer-events-none absolute bottom-0 right-0'
                        }`}
                >
                    <div className={`${getSizeClasses()} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700 ring-1 ring-black/5`}>
                        <Suspense fallback={
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-50 dark:bg-slate-900 h-full min-h-[400px]">
                                <Loader2 size={32} className="animate-spin text-indigo-500" />
                                <span className="text-xs font-medium animate-pulse">Memuat Kecerdasan...</span>
                            </div>
                        }>
                            <ChatWindow 
                                onClose={() => setIsOpen(false)} 
                                pageContext={{ title: pageTitle }}
                                currentSize={windowSize}
                                onResize={setWindowSize}
                                onNewMessage={handleNewMessage} // Pass callback
                            />
                        </Suspense>
                    </div>
                </div>
            )}

            {/* TOMBOL PEMICU */}
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
                        {/* Animasi Ping dasar (jantung) selalu ada untuk menarik perhatian */}
                        <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-20 duration-1000 pointer-events-none"></span>
                        
                        {/* Ping Hijau Notifikasi: HANYA MUNCUL JIKA ADA PESAN BARU (hasUnread = true) */}
                        {hasUnread && (
                            <span className="absolute top-0 right-0 flex h-4 w-4 z-10">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white dark:border-slate-800 shadow-sm"></span>
                            </span>
                        )}
                        
                        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
                    </>
                )}
            </div>
        </div>
    );
};

export default AIAssistant;