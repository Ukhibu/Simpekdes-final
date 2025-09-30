// Pustaka jsPDF dan autoTable akan diambil dari window object
// Tidak perlu import di sini

// --- Fungsi Bantuan Internal ---
const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if(isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const safeFormatDate = (dateField) => {
    if (!dateField) return '-';
    if (typeof dateField.toDate === 'function') {
        return formatDate(dateField.toDate());
    }
    return formatDate(dateField);
};

const formatCurrency = (number) => {
    if (typeof number !== 'number') return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// Parse numeric amount from various possible input formats:
// - numeric types (Number)
// - strings with thousand separators like '1.000.000' or '1,000,000'
// - strings with currency prefix like 'Rp 1.000.000'
// - fallback to 0 for unparsable values
const parseNumeric = (val) => {
    if (val == null) return 0;
    if (typeof val === 'number' && !isNaN(val)) return val;
    // If it's an object with toNumber or toDate etc, try valueOf
    if (typeof val === 'object' && typeof val.valueOf === 'function') {
        const v = val.valueOf();
        if (typeof v === 'number' && !isNaN(v)) return v;
        if (typeof v === 'string') val = v;
    }
    const s = String(val);
    // Remove currency letters and whitespace, keep digits and minus
    const digits = s.replace(/[^0-9\-]/g, '');
    if (!digits) return 0;
    const n = Number(digits);
    return isNaN(n) ? 0 : n;
};

const getAge = (item) => {
    const dateString = item.tgl_lahir;
    if (!dateString) return '-';
    const birthDate = typeof dateString.toDate === 'function' ? dateString.toDate() : new Date(dateString);
    if (isNaN(birthDate.getTime())) return '-';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
};

// --- Fungsi Generator PDF Utama (Dasar) ---
const generatePDF = (title, headers, body, desa, config, orientation = 'landscape') => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert("Pustaka PDF tidak berhasil dimuat. Mohon refresh halaman.");
        return;
    }
    const doc = new jsPDF({ orientation });

    const pageContent = () => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const subTitle = desa === 'all' ? 'KECAMATAN PUNGGELAN' : `DESA ${desa.toUpperCase()}`;
        doc.text(subTitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        if (typeof doc.autoTable !== 'function') {
            console.error("jspdf-autotable is not loaded correctly!");
            alert("Gagal membuat tabel PDF. Plugin tidak termuat.");
            return;
        }
        doc.autoTable({
            head: [headers],
            body: body,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
        });

        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(10);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    };

    pageContent();
    
    // --- PERBAIKAN: Logika Penempatan Tanda Tangan (dinamis) ---
    // Gunakan perhitungan tinggi berdasarkan jumlah baris dan ukuran font agar
    // tanda tangan tidak muncul terlalu tinggi untuk tabel pendek (mis. filter per-desa).
    const prevFinalY = doc.autoTable && doc.autoTable.previous ? doc.autoTable.previous.finalY : 30;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    const signer = desa === 'all' ?
        {
            jabatan: config?.jabatanPenandaTangan || 'CAMAT PUNGGELAN',
            nama: config?.namaPenandaTangan || '(..................)',
            nip: config?.nipPenandaTangan ? `NIP. ${config.nipPenandaTangan}` : ''
        } :
        {
            jabatan: `KEPALA DESA ${desa.toUpperCase()}`,
            nama: '(..................)',
            nip: ''
        };

    // Siapkan baris yang akan dicetak; kosongkan yang tidak ada
    const dateLine = `${desa === 'all' ? 'Punggelan' : desa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const lines = [dateLine, signer.jabatan, signer.nama];
    if (signer.nip) lines.push(signer.nip);

    // Hitung ukuran baris berdasarkan font saat ini
    const currentFontSize = (typeof doc.getFontSize === 'function') ? doc.getFontSize() : 10;
    // Gunakan gap yang proporsional namun tidak terlalu besar
    const lineGap = Math.max(6, Math.round(currentFontSize * 0.9));

    // Total tinggi blok tanda tangan
    const signatureBlockHeight = lines.length * lineGap + 4; // padding kecil
    const minBottomPadding = 10;

    // Lihat sisa ruang di halaman setelah tabel
    const spaceBelow = pageHeight - (prevFinalY + 15);

    let startY;
    if (spaceBelow >= signatureBlockHeight + minBottomPadding) {
        // Tempatkan langsung di bawah tabel
        startY = prevFinalY + 15;
    } else {
        // Tambah halaman baru dan tempatkan blok di dekat bottom margin
        doc.addPage();
        startY = pageHeight - signatureBlockHeight - 20; // bottom margin 20
    }

    // Tentukan X untuk area tanda tangan (kanan bawah); masih gunakan center align terhadap X
    const signatureX = orientation === 'landscape' ? pageWidth - 70 : pageWidth - 60;
    doc.setFontSize(Math.max(9, currentFontSize));

    // Cetak setiap baris dengan gap yang konsisten
    for (let i = 0; i < lines.length; i++) {
        const y = startY + i * lineGap;
        doc.text(lines[i], signatureX, y, { align: 'center' });
    }


    doc.save(`${title.replace(/ /g, '_')}_${desa}.pdf`);
};

// --- Fungsi Ekspor Spesifik per Jenis Laporan ---

export const generateDemografiPDF = (data, desaFilter, exportConfig, title) => {
    const headers = ['No', 'Nama', 'Jabatan', 'Pendidikan', 'Usia'];
    if (desaFilter === 'all') headers.splice(2, 0, 'Desa');

    const body = data.map((p, index) => {
        const row = [
            index + 1,
            p.nama || '-',
            p.jabatan || '-',
            p.pendidikan || '-',
            getAge(p),
        ];
        if (desaFilter === 'all') row.splice(2, 0, p.desa || '-');
        return row;
    });

    generatePDF(title, headers, body, desaFilter, exportConfig);
};

export const generateKeuanganPDF = (data, desaFilter, exportConfig) => {
    const headers = ['No', 'Tanggal', 'Uraian', 'Jenis', 'Pemasukan (Rp)', 'Pengeluaran (Rp)'];
    if (desaFilter === 'all') headers.splice(1, 0, 'Desa');

    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    const body = data.map((t, index) => {
        // Normalize jenis and coerce jumlah to Number so formatting works
        const jenisRaw = (t.jenis || '').toString();
        const jenis = jenisRaw.toLowerCase().trim();
        const nilai = Number(t.jumlah) || 0;

        const isPemasukan = jenis.includes('pemasukan') || jenis.includes('pendapatan');
        const isPengeluaran = jenis.includes('pengeluaran') || jenis.includes('belanja');

        const pemasukan = isPemasukan ? nilai : 0;
        const pengeluaran = isPengeluaran ? nilai : 0;

        totalPemasukan += pemasukan;
        totalPengeluaran += pengeluaran;

        const row = [
            index + 1,
            safeFormatDate(t.tanggal),
            t.uraian || '-',
            t.jenis || '-',
            formatCurrency(pemasukan),
            formatCurrency(pengeluaran),
        ];
        if (desaFilter === 'all') row.splice(1, 0, t.desa || '-');
        return row;
    });
    
    const totalRow = ['', 'TOTAL', '', '', formatCurrency(totalPemasukan), formatCurrency(totalPengeluaran)];
    if(desaFilter === 'all') totalRow.splice(1, 0, '');
    body.push(totalRow.map(cell => ({ content: cell, styles: { fontStyle: 'bold' } })));

    generatePDF('Laporan Rekapitulasi Keuangan', headers, body, desaFilter, exportConfig);
};

export const generateAsetPDF = (data, desaFilter, exportConfig) => {
    const headers = ['No', 'Nama Aset', 'Kategori', 'Tgl Perolehan', 'Kondisi', 'Nilai Aset (Rp)'];
    if (desaFilter === 'all') headers.splice(1, 0, 'Desa');

    let totalNilai = 0;

    const body = data.map((a, index) => {
        totalNilai += Number(a.nilaiAset) || 0;
        const row = [
            index + 1,
            a.namaAset,
            a.kategori || '-',
            safeFormatDate(a.tanggalPerolehan),
            a.kondisi || '-',
            formatCurrency(a.nilaiAset),
        ];
        if (desaFilter === 'all') row.splice(1, 0, a.desa || '-');
        return row;
    });
    
    const totalRow = ['', 'TOTAL NILAI ASET', '', '', '', formatCurrency(totalNilai)];
    if(desaFilter === 'all') totalRow.splice(1, 0, '');
    body.push(totalRow.map(cell => ({ content: cell, styles: { fontStyle: 'bold' } })));

    generatePDF('Laporan Inventaris Aset Desa', headers, body, desaFilter, exportConfig);
};

export const generateRekapRtRwPDF = (data, exportConfig) => {
    const headers = ['No', 'Desa', 'Jabatan', 'Nomor', 'Nama Ketua', 'Dusun/Dukuh'];
    
    const body = data.map((item, index) => [
        index + 1,
        item.desa || '-',
        item.jabatan || '-',
        item.nomor || '-',
        item.nama || '-',
        item.dusun || '-',
    ]);

    generatePDF('Laporan Data RT/RW', headers, body, 'all', exportConfig, 'portrait');
};

export const generateRekapLembagaPDF = (data, exportConfig) => {
    const headers = ['No', 'Nama Desa', 'Perangkat', 'BPD', 'LPM', 'PKK', 'Karang Taruna', 'RT/RW'];

    const body = data.map((item, index) => [
        index + 1,
        item.desa,
        item.perangkat || 0,
        item.bpd || 0,
        item.lpm || 0,
        item.pkk || 0,
        item.karang_taruna || 0,
        item.rt_rw || 0,
    ]);
    
    generatePDF('Laporan Rekapitulasi Jumlah Kelembagaan', headers, body, 'all', exportConfig);
};

