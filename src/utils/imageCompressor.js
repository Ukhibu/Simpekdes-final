/**
 * Mengompres file gambar di sisi klien sebelum diunggah.
 * Mendukung PNG (Transparan) dan JPEG.
 * * @param {File} file - File gambar yang akan dikompres.
 * @param {object} options - Opsi untuk kompresi.
 * @param {number} [options.maxWidth=1024] - Lebar maksimum gambar setelah kompresi.
 * @param {number} [options.maxHeight=1024] - Tinggi maksimum gambar setelah kompresi.
 * @param {number} [options.quality=0.8] - Kualitas gambar (antara 0 dan 1).
 * @returns {Promise<File>} Promise yang akan resolve dengan file gambar yang sudah terkompres.
 */
export const compressImage = (file, options = {}) => {
    const { maxWidth = 1024, maxHeight = 1024, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
        // Pastikan file yang diberikan adalah gambar
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('File yang diberikan bukan gambar atau corrupt.'));
        }

        // PENTING: Deteksi apakah file asli adalah PNG
        // Jika PNG, kita harus mempertahankan format 'image/png' agar transparansi tidak hilang.
        // Jika bukan PNG (misal JPG), gunakan 'image/jpeg'.
        const isPng = file.type === 'image/png';
        const outputType = isPng ? 'image/png' : 'image/jpeg';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Hitung rasio untuk mengubah ukuran gambar (Resize Logic)
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // PENTING: Gunakan { alpha: true } untuk mendukung transparansi
                const ctx = canvas.getContext('2d', { alpha: true });

                // PENTING: Bersihkan canvas sebelum menggambar untuk menghindari artefak background
                ctx.clearRect(0, 0, width, height);
                
                // Gambar image ke canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Konversi canvas ke blob, lalu ke file
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return reject(new Error('Gagal membuat blob dari canvas.'));
                        }
                        
                        // Buat file baru dari blob dengan nama dan tipe yang sesuai
                        // Gunakan outputType yang sudah ditentukan di awal (PNG atau JPEG)
                        const compressedFile = new File([blob], file.name, {
                            type: outputType, 
                            lastModified: Date.now(),
                        });
                        
                        resolve(compressedFile);
                    },
                    outputType, // Gunakan tipe dinamis (PNG/JPEG)
                    quality
                );
            };
            
            img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
        };
        
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
    });
};