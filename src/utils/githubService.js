/**
 * @file githubService.js
 * @description Modul ini menangani semua interaksi dengan GitHub API untuk unggah dan hapus file.
 * @important PENTING: File ini menggunakan token GitHub langsung dari client-side.
 * Ini adalah RISIKO KEAMANAN. Pastikan repositori Anda bersifat PRIBADI dan token Anda
 * memiliki izin seminimal mungkin (hanya 'repo'). Untuk produksi skala besar,
 * sangat disarankan untuk memindahkan logika ini ke backend (seperti Firebase Cloud Function).
 */

/**
 * Mengubah file menjadi format Base64 yang dibutuhkan oleh GitHub API.
 * @param {File} file - File yang akan diubah.
 * @returns {Promise<string>} String Base64 dari konten file.
 */
const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

/**
 * Mengunggah file ke repositori GitHub yang ditentukan.
 * @param {File} file - File PDF yang akan diunggah.
 * @param {string} fileName - Nama file yang akan dibuat di GitHub.
 * @param {string} folder - Nama folder di dalam repositori (misal: 'sk_perangkat').
 * @returns {Promise<object>} Objek respons dari GitHub API yang berisi detail file.
 */
export const uploadFileToGithub = async (file, fileName, folder) => {
    const GITHUB_USERNAME = process.env.REACT_APP_GITHUB_USERNAME;
    const GITHUB_REPO = process.env.REACT_APP_GITHUB_REPO;
    const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN;

    if (!GITHUB_USERNAME || !GITHUB_REPO || !GITHUB_TOKEN) {
        throw new Error('Konfigurasi kredensial GitHub tidak ditemukan di .env');
    }

    const filePath = `${folder}/${fileName}`;
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;

    const contentBase64 = await toBase64(file);

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
            message: `Upload file: ${fileName}`,
            content: contentBase64,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || 'Gagal mengunggah file ke GitHub.');
    }

    return result.content; // Mengembalikan objek content yang berisi path, sha, download_url, dll.
};

/**
 * Menghapus file dari repositori GitHub berdasarkan path dan SHA-nya.
 * @param {string} path - Path lengkap file di repositori (misal: 'sk_perangkat/namafile.pdf').
 * @param {string} sha - SHA hash dari file yang akan dihapus.
 * @returns {Promise<object>} Objek respons dari GitHub API.
 */
export const deleteFileFromGithub = async (path, sha) => {
    const GITHUB_USERNAME = process.env.REACT_APP_GITHUB_USERNAME;
    const GITHUB_REPO = process.env.REACT_APP_GITHUB_REPO;
    const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN;

    if (!GITHUB_USERNAME || !GITHUB_REPO || !GITHUB_TOKEN) {
        throw new Error('Konfigurasi kredensial GitHub tidak ditemukan di .env');
    }

    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${path}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
            message: `Hapus file: ${path}`,
            sha: sha,
        }),
    });

    const result = await response.json();

    if (!response.ok) {
        // Jika file sudah tidak ada (error 404), anggap berhasil.
        if (response.status !== 404) {
            throw new Error(result.message || 'Gagal menghapus file dari GitHub.');
        }
    }
    
    return result;
};
