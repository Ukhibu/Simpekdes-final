import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import AnimatedFooter from '../components/common/AnimatedFooter';
import { FiArrowLeft, FiBriefcase, FiHeart, FiUsers, FiHome, FiAward } from 'react-icons/fi';
import '../styles/OrganisasiDesaHub.css';

// Komponen untuk Latar Belakang Partikel
const ParticleBackground = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let mouse = { x: null, y: null, radius: 120 };
        let particlesArray = [];

        const handleMouseMove = (event) => {
            mouse.x = event.x;
            mouse.y = event.y;
        };

        const handleTouchMove = (event) => {
            mouse.x = event.touches[0].clientX;
            mouse.y = event.touches[0].clientY;
        };

        const handleMouseOut = () => {
            mouse.x = null;
            mouse.y = null;
        };
        
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('mouseout', handleMouseOut);
        window.addEventListener('touchend', handleMouseOut);
        window.addEventListener('resize', handleResize);

        class Particle {
             constructor(x, y, directionX, directionY, size, color) {
                this.x = x;
                this.y = y;
                this.directionX = directionX;
                this.directionY = directionY;
                this.size = size;
                this.color = color;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
            update() {
                if (this.x > canvas.width || this.x < 0) {
                    this.directionX = -this.directionX;
                }
                if (this.y > canvas.height || this.y < 0) {
                    this.directionY = -this.directionY;
                }
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius + this.size) {
                    if (mouse.x < this.x && this.x < canvas.width - this.size * 5) { this.x += 3; }
                    if (mouse.x > this.x && this.x > this.size * 5) { this.x -= 3; }
                    if (mouse.y < this.y && this.y < canvas.height - this.size * 5) { this.y += 3; }
                    if (mouse.y > this.y && this.y > this.size * 5) { this.y -= 3; }
                }
                this.x += this.directionX;
                this.y += this.directionY;
                this.draw();
            }
        }

        function init() {
            particlesArray = [];
            let numberOfParticles = (canvas.height * canvas.width) / 9000;
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = (Math.random() * ((window.innerWidth - size * 2) - (size * 2)) + size * 2);
                let y = (Math.random() * ((window.innerHeight - size * 2) - (size * 2)) + size * 2);
                let directionX = (Math.random() * .4) - .2;
                let directionY = (Math.random() * .4) - .2;
                let color = 'rgba(255, 255, 255, 0.7)';
                particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
            }
        }

        function connect() {
            let opacityValue = 1;
            for (let a = 0; a < particlesArray.length; a++) {
                for (let b = a; b < particlesArray.length; b++) {
                    let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) +
                                 ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
                    if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                        opacityValue = 1 - (distance / 20000);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                        ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                        ctx.stroke();
                    }
                }
            }
        }

        let animationFrameId;
        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
            }
            connect();
        }

        init();
        animate();
        
        // Fungsi cleanup untuk menghapus event listeners saat komponen dilepas
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('mouseout', handleMouseOut);
            window.removeEventListener('touchend', handleMouseOut);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} id="particle-canvas"></canvas>;
};


const OrganisasiDesaHub = () => {
    const { branding } = useBranding();
    const navigate = useNavigate();

    const menuItems = [
        { to: "/app/bpd", label: "BPD", icon: <FiBriefcase size={32} /> },
        { to: "/app/lpm", label: "LPM", icon: <FiAward size={32} /> },
        { to: "/app/pkk", label: "PKK", icon: <FiHeart size={32} /> },
        { to: "/app/karang-taruna", label: "Karang Taruna", icon: <FiUsers size={32} /> },
        { to: "/app/rt-rw", label: "RT / RW", icon: <FiHome size={32} /> },
    ];

    return (
        <div className="org-hub-container">
            <ParticleBackground />
            
            <div className="hub-content-wrapper">
                <header className="org-hub-header">
                    <div className="org-hub-branding">
                        <img src={branding.loginLogoUrl} alt="Logo" className="org-hub-logo" />
                        <div>
                            <h1 className="org-hub-title">{branding.appName}</h1>
                            <p className="org-hub-subtitle">Pusat Organisasi & Lembaga Desa</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="org-hub-back-button">
                        <FiArrowLeft className="mr-2" />
                        <span>Kembali ke Menu Utama</span>
                    </button>
                </header>

                <main className="org-hub-main">
                    <div className="menu-grid">
                        {menuItems.map((item, index) => (
                            <Link to={item.to} key={item.label} className="menu-item-circle" style={{ animationDelay: `${index * 100}ms` }}>
                                <div className="menu-item-icon">{item.icon}</div>
                                <span className="menu-item-label">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </main>

                <footer className="org-hub-footer">
                    <p className="instruction-text">Pilih salah satu lembaga di atas untuk memulai pengelolaan data.</p>
                    <AnimatedFooter />
                </footer>
            </div>
        </div>
    );
};

export default OrganisasiDesaHub;

