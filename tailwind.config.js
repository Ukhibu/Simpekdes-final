/** @type {import('tailwindcss').Config} */
module.exports = {
  // --- PERBAIKAN 1: Mengaktifkan Dark Mode ---
  // Ini memberitahu Tailwind untuk mencari kelas 'dark' pada elemen html
  darkMode: 'class',

  // --- PERBAIKAN 2: Menentukan file mana yang akan dipindai ---
  // Ini adalah bagian terpenting. Tailwind akan memindai file-file ini
  // untuk menemukan kelas yang Anda gunakan dan menghasilkan CSS yang sesuai.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {},
  },
  plugins: [],
}
