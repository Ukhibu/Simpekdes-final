/** @type {import('tailwindcss').Config} */
module.exports = {
  // --- PERBAIKAN: Mengaktifkan Dark Mode berdasarkan kelas di elemen HTML ---
  darkMode: 'class',

  // --- PERBAIKAN: Menambahkan path file sumber untuk dipindai oleh Tailwind ---
  // Ini penting agar semua kelas utility yang Anda gunakan disertakan dalam CSS final.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {},
  },
  plugins: [],
}
