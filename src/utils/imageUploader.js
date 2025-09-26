/**
 * Mengunggah file gambar ke Cloudinary.
 * @param {File} file - File gambar yang akan diunggah.
 * @returns {Promise<string|null>} URL gambar yang telah diunggah atau null jika gagal.
 */
export const uploadImageToCloudinary = async (file) => {
    if (!file) return null;

    // PENTING: Untuk optimasi gambar, Anda perlu mengatur "Eager Transformations"
    // di dalam Upload Preset Anda di situs web Cloudinary.
    // Contoh transformasi: w_800,h_800,c_limit,q_auto:good
    // Ini akan secara otomatis mengubah ukuran gambar saat diunggah.
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: data
        });
        const result = await res.json();
        if (result.secure_url) {
            return result.secure_url;
        } else {
            throw new Error(result.error ? result.error.message : 'Upload ke Cloudinary gagal.');
        }
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw error;
    }
};

