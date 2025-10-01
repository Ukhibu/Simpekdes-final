/**
 * Mengunggah file (seperti PDF) ke Cloudinary.
 * @param {File} file - File yang akan diunggah.
 * @param {string} uploadPreset - Preset unggah Cloudinary Anda (harus 'unsigned').
 * @param {string} cloudName - Nama cloud Cloudinary Anda.
 * @returns {Promise<{secure_url: string, public_id: string}>} Promise yang resolve dengan URL aman dan public_id dari file.
 */
export const uploadFileToCloudinary = async (file, uploadPreset, cloudName) => {
    if (!file) {
        throw new Error('Tidak ada file yang dipilih untuk diunggah.');
    }
    if (!uploadPreset || !cloudName) {
        throw new Error('Nama cloud atau upload preset Cloudinary belum diatur.');
    }

    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', uploadPreset);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: data
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error?.message || 'Gagal terhubung ke Cloudinary.');
        }

        const result = await res.json();
        
        if (result.secure_url && result.public_id) {
            return {
                secure_url: result.secure_url,
                public_id: result.public_id
            };
        } else {
            throw new Error('Respon dari Cloudinary tidak valid.');
        }
    } catch (error) {
        console.error("Gagal mengunggah file ke Cloudinary:", error);
        throw error;
    }
};
