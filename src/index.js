import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/AnimatedFooter.css'; 
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { NotificationProvider } from './context/NotificationContext'; // Import NotificationProvider

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <BrandingProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </BrandingProvider>
    </AuthProvider>
  </React.StrictMode>
);
