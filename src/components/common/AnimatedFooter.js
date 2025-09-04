import React from 'react';
import { FiPhone } from 'react-icons/fi'; // Impor ikon telepon
import '../../styles/AnimatedFooter.css';

const AnimatedFooter = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="animated-footer">
            <div className="footer-content">
                <span>&copy; {currentYear} SIMPEKDES By Bangki. All rights reserved.</span>
                <span className="contact-info">
                    <FiPhone size={14} className="contact-icon" />
                    Kontak: 0838-4664-4286
                </span>
            </div>
        </footer>
    );
};

export default AnimatedFooter;

