import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react'; // Pastikan install lucide-react atau ganti icon lain

const OfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000); // Hilang setelah 3 detik
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-500 transform ${
        !isOnline ? 'translate-y-0' : showReconnected ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className={`flex items-center justify-center p-2 text-sm font-medium text-white shadow-md ${
        !isOnline ? 'bg-red-500' : 'bg-green-500'
      }`}>
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 mr-2" />
            <span>Mode Offline: Anda menggunakan data tersimpan. Perubahan akan disinkronkan saat online.</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 mr-2" />
            <span>Koneksi Kembali Stabil. Sinkronisasi data...</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineStatus;