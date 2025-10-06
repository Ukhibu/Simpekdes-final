import React, { useState, useEffect } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { FiInfo, FiCheckCircle, FiAlertTriangle, FiXCircle, FiX } from 'react-icons/fi';
import '../../styles/Notification.css'; // Pastikan CSS diimpor

const icons = {
  success: <FiCheckCircle />,
  error: <FiXCircle />,
  warning: <FiAlertTriangle />,
  info: <FiInfo />,
};

/**
 * Komponen Notifikasi Individual
 * Menampilkan pesan dengan ikon, warna, dan animasi yang sesuai.
 * Termasuk baris progres visual.
 */
const Notification = ({ notification, onRemove }) => {
    const { id, message, type, duration } = notification;
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        // Timer untuk memulai animasi keluar sebelum komponen dihapus
        const timer = setTimeout(() => {
            setIsClosing(true);
            // Timer untuk menghapus komponen dari DOM setelah animasi selesai
            const removeTimer = setTimeout(() => {
                onRemove(id);
            }, 400); // Durasi harus cocok dengan animasi 'slide-out-to-right' di CSS
            return () => clearTimeout(removeTimer);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onRemove]);

    const handleManualClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onRemove(id);
        }, 400);
    };

    return (
        <div className={`notification-toast ${type} ${isClosing ? 'closing' : ''}`}>
            <div className="notification-icon">
                {icons[type]}
            </div>
            <div className="notification-content">
                <p className="notification-message">{message}</p>
            </div>
            <button onClick={handleManualClose} className="notification-close">
                <FiX />
            </button>
            <div className="notification-progress-wrapper">
                <div 
                    className="notification-progress" 
                    style={{ animationDuration: `${duration}ms` }} 
                />
            </div>
        </div>
    );
};

/**
 * Kontainer untuk semua notifikasi
 * Mengatur posisi notifikasi di layar.
 */
const NotificationContainer = () => {
    const { notifications, removeNotification } = useNotification();

    return (
        <div className="notification-container">
            {notifications.map(notification => (
                <Notification
                    key={notification.id}
                    notification={notification}
                    onRemove={removeNotification}
                />
            ))}
        </div>
    );
};

export default NotificationContainer;

