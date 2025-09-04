import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateBeritaAcaraBPD = (acara, anggotaBPD, desa) => {
    if (!acara || !anggotaBPD || anggotaBPD.length === 0) {
        alert("Data tidak lengkap untuk membuat Berita Acara.");
        return;
    }

    const doc = new jsPDF();

    // Judul Dokumen
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text("BERITA ACARA", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.text("MUSYAWARAH BADAN PERMUSYAWARATAN DESA (BPD)", doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    doc.text(`DESA ${desa.toUpperCase()}`, doc.internal.pageSize.getWidth() / 2, 36, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);

    // Informasi Acara
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text("Pada hari ini, telah dilaksanakan musyawarah Badan Permusyawaratan Desa (BPD) dengan rincian sebagai berikut:", 20, 50);

    const acaraDetails = [
        ["Perihal", `: ${acara.perihal || ''}`],
        ["Hari / Tanggal", `: ${acara.tanggal || ''}`],
        ["Waktu", `: ${acara.waktu || ''}`],
        ["Tempat", `: ${acara.tempat || ''}`],
    ];

    doc.autoTable({
        startY: 55,
        body: acaraDetails,
        theme: 'plain',
        styles: { cellPadding: 1, fontSize: 11 },
        columnStyles: { 0: { cellWidth: 40 } }
    });
    
    // Isi Berita Acara
    let finalY = doc.autoTable.previous.finalY + 10;
    doc.text("Adapun musyawarah ini telah dihadiri oleh anggota BPD sebagaimana daftar terlampir di bawah ini. Musyawarah telah membahas dan menyepakati hal-hal sebagai berikut:", 20, finalY, { maxWidth: 170 });
    
    finalY += 20; // spasi
    doc.setFont(undefined, 'bold');
    doc.text("Hasil Kesepakatan:", 20, finalY);
    doc.setFont(undefined, 'normal');
    finalY += 7;
    doc.text(acara.hasil || 'Belum ada hasil kesepakatan yang diisi.', 25, finalY, { maxWidth: 165 });
    
    finalY = doc.autoTable.previous.finalY > finalY ? doc.autoTable.previous.finalY : finalY;
    finalY += 30; // spasi

    // Daftar Hadir Anggota
    doc.addPage(); // Pindah ke halaman baru untuk daftar hadir
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("DAFTAR HADIR ANGGOTA BPD", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    const tableColumn = ["No", "Nama Lengkap", "Jabatan", "Tanda Tangan"];
    const tableRows = [];

    anggotaBPD.forEach((item, index) => {
        const row = [
            index + 1,
            item.nama,
            item.jabatan,
            "" // Kolom tanda tangan dikosongkan
        ];
        tableRows.push(row);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], halign: 'center' },
    });
    
    finalY = doc.autoTable.previous.finalY + 20;

    // Tanda Tangan Pimpinan Rapat
    doc.text(`Desa ${desa}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 130, finalY);
    doc.text("Pimpinan Rapat,", 130, finalY + 7);
    doc.text("(...........................)", 130, finalY + 30);


    // Simpan PDF
    doc.save(`Berita_Acara_BPD_${acara.perihal.replace(/\s+/g, '_')}_${desa}.pdf`);
};
