import React, { useRef, useEffect } from 'react';

/**
 * Komponen Latar Belakang Partikel yang Ringan dan Responsif.
 * Dibuat menggunakan HTML Canvas untuk performa maksimal.
 */
const ParticleBackground = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let particlesArray = [];
        let mouse = { x: null, y: null, radius: (canvas.height / 80) * (canvas.width / 80) };
        
        // [PERBAIKAN] Deklarasi class Particle dipindahkan ke atas sebelum digunakan.
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

                // Cek interaksi dengan mouse
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius + this.size) {
                    if (mouse.x < this.x && this.x < canvas.width - this.size * 10) { this.x += 2; }
                    if (mouse.x > this.x && this.x > this.size * 10) { this.x -= 2; }
                    if (mouse.y < this.y && this.y < canvas.height - this.size * 10) { this.y += 2; }
                    if (mouse.y > this.y && this.y > this.size * 10) { this.y -= 2; }
                }

                this.x += this.directionX;
                this.y += this.directionY;
                this.draw();
            }
        }
        
        function init() {
            particlesArray = [];
            // Jumlah partikel disesuaikan dengan ukuran layar untuk responsivitas
            let numberOfParticles = (canvas.height * canvas.width) / 12000;
            for (let i = 0; i < numberOfParticles; i++) {
                let size = (Math.random() * 2) + 1;
                let x = Math.random() * (window.innerWidth - size * 2) + size * 2;
                let y = Math.random() * (window.innerHeight - size * 2) + size * 2;
                let directionX = (Math.random() * 0.4) - 0.2;
                let directionY = (Math.random() * 0.4) - 0.2;
                let color = 'rgba(255, 255, 255, 0.5)';
                particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
            }
        }

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            mouse.radius = (canvas.height / 80) * (canvas.width / 80);
            init();
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Panggil sekali untuk inisialisasi ukuran

        const handleMouseMove = (event) => {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        };

        const handleMouseOut = () => {
            mouse.x = null;
            mouse.y = null;
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseOut);

        function connect() {
            let opacityValue = 1;
            for (let a = 0; a < particlesArray.length; a++) {
                for (let b = a; b < particlesArray.length; b++) {
                    let distance = ((particlesArray[a].x - particlesArray[b].x) ** 2) + ((particlesArray[a].y - particlesArray[b].y) ** 2);
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

        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            for (let i = 0; i < particlesArray.length; i++) {
                particlesArray[i].update();
            }
            connect();
        }

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseOut);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Gunakan class `.particle-canvas` untuk styling
    return <canvas ref={canvasRef} className="particle-canvas"></canvas>;
};

export default ParticleBackground;

