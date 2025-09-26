import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { FiInfo, FiCheckCircle, FiAlertTriangle, FiXCircle, FiX } from 'react-icons/fi';
import '../../styles/Notification.css';

const icons = {
  success: <FiCheckCircle />,
  error: <FiXCircle />,
  warning: <FiAlertTriangle />,
  info: <FiInfo />,
};

const Notification = ({ notification, onRemove }) => {
    const { id, message, type, duration } = notification;

    React.useEffect(() => {
        const timer = setTimeout(() => {
            onRemove(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onRemove]);

    return (
        <div className={`notification toast ${type}`}>
            <div className="notification-icon">
                {icons[type]}
            </div>
            <div className="notification-content">
                <p className="notification-message">{message}</p>
            </div>
            <button onClick={() => onRemove(id)} className="notification-close">
                <FiX />
            </button>
        </div>
    );
};

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
