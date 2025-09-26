import { compressImage } from './imageCompressor';

/**
 * Mengompres gambar (jika ada) lalu mengunggahnya ke Cloudinary.
 * @param {File | null} file - File gambar yang akan diunggah.
 * @param {string} uploadPreset - Preset unggah Cloudinary Anda.
 * @param {string} cloudName - Nama cloud Cloudinary Anda.
 * @returns {Promise<string|null>} Promise yang resolve dengan URL gambar yang aman, atau null jika tidak ada file.
 */
export const uploadImageToCloudinary = async (file, uploadPreset, cloudName) => {
    // Jika tidak ada file yang diberikan, langsung kembalikan null.
    if (!file) {
        return null;
    }

    try {
        // Langkah 1: Kompres gambar terlebih dahulu.
        // Opsi default akan digunakan (maxWidth/maxHeight: 1024, quality: 0.8).
        const compressedFile = await compressImage(file);

        // Langkah 2: Buat FormData dengan file yang sudah dikompres.
        const data = new FormData();
        data.append('file', compressedFile);
        data.append('upload_preset', uploadPreset);

        // Langkah 3: Kirim file yang sudah dikompres ke Cloudinary.
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: data
        });

        const result = await res.json();
        
        if (result.secure_url) {
            return result.secure_url;
        } else {
            throw new Error(result.error?.message || 'Unggah ke Cloudinary gagal.');
        }
    } catch (error) {
        console.error("Gagal mengompres atau mengunggah gambar:", error);
        // Lempar kembali error agar bisa ditangani oleh komponen yang memanggil.
        throw error;
    }
};

