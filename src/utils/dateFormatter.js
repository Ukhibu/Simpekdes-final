export const formatDate = (dateString, format = 'default') => {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        // Tambahkan pengecekan jika tanggal tidak valid
        if (isNaN(date.getTime())) {
            // Coba parsing dengan format DD-MM-YYYY
            const parts = dateString.split('-');
            if (parts.length === 3) {
                 const newDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                 if (!isNaN(newDate.getTime())) {
                     return formatIndonesianDate(newDate, format);
                 }
            }
            return dateString; // Kembalikan string asli jika masih tidak valid
        }
        
        return formatIndonesianDate(date, format);

    } catch (error) {
        console.error("Invalid date string:", dateString);
        return dateString; // Kembalikan string asli jika ada error
    }
};

const formatIndonesianDate = (date, format) => {
    const optionsLong = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    
    const optionsDefault = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };

    if (format === 'long') {
        // Mengubah format menjadi "Senin, 02 September 2025"
        let formatted = new Intl.DateTimeFormat('id-ID', optionsLong).format(date);
        
        // Terjemahan manual untuk nama hari jika diperlukan
        const dayTranslations = {
            'Sunday': 'Minggu', 'Monday': 'Senin', 'Tuesday': 'Selasa', 'Wednesday': 'Rabu',
            'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu'
        };
        const dayOfWeekEn = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
        
        // Membuat tanggal menjadi dua digit
        const day = String(date.getDate()).padStart(2, '0');
        
        // Membangun kembali string dengan nama hari yang benar dan tanggal dua digit
        const monthYear = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
        
        return `${dayTranslations[dayOfWeekEn]}, ${day} ${monthYear}`;
    }
    
    // Format default: 02/09/2025
    return new Intl.DateTimeFormat('id-ID', optionsDefault).format(date);
};

