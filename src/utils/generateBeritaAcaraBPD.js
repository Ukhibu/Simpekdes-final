import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Generator PDF Berita Acara Sumpah BPD
 * Dioptimalkan untuk 1 Halaman & Pas Bingkai
 */
export const generateBeritaAcaraBPD = (bpd, config, frameUrl = null) => {
    if (!bpd || !config) {
        alert("Data tidak lengkap.");
        return;
    }

    const doc = new jsPDF('p', 'mm', 'a4'); // Portrait, Millimeters, A4
    const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

    // --- 1. PENGATURAN MARGIN & AREA AMAN (Agar pas di dalam bingkai) ---
    const marginTop = 45;     // Margin atas aman dari bingkai
    const marginBottom = 40;  // Margin bawah aman dari bingkai
    const marginLeft = 30;    // Margin kiri aman
    const marginRight = 30;   // Margin kanan aman
    const contentWidth = pageWidth - marginLeft - marginRight;

    // --- 2. SISIPKAN BINGKAI (FULL PAGE) ---
    if (frameUrl) {
        try {
            doc.addImage(frameUrl, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch (e) {
            console.warn("Gagal memuat bingkai:", e);
        }
    }

    // Helper untuk teks tengah
    const centerText = (text, y) => {
        doc.text(text, pageWidth / 2, y, { align: 'center' });
    };

    // Helper untuk Justify Text (Rata Kanan Kiri)
    const justifiedText = (text, y) => {
        const splitText = doc.splitTextToSize(text, contentWidth);
        doc.text(splitText, marginLeft, y, { align: 'justify', maxWidth: contentWidth });
        return splitText.length * 5; // Mengembalikan tinggi teks yang ditulis (asumsi line height 5mm)
    };

    // --- 3. HEADER DOKUMEN ---
    let yPos = marginTop;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    centerText("BERITA ACARA", yPos);
    yPos += 6;
    centerText("PENGAMBILAN SUMPAH JABATAN ANGGOTA BPD", yPos);
    yPos += 6;
    centerText(`DESA ${bpd.desa.toUpperCase()}`, yPos);
    
    // Garis bawah header
    doc.setLineWidth(0.5);
    doc.line(marginLeft, yPos + 2, pageWidth - marginRight, yPos + 2);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    centerText(`NOMOR : ${config.nomor || '...'}`, yPos);

    // --- 4. ISI KONTEN ---
    yPos += 10;
    
    const pelantikanDate = bpd.tgl_pelantikan 
        ? format(new Date(bpd.tgl_pelantikan), 'dd MMMM yyyy', { locale: id }) 
        : '...';
    
    const paragrafPembuka = `Pada hari ini, ${pelantikanDate}, bertempat di Kecamatan Punggelan, saya ${config.pejabatNama} jabatan ${config.pejabatJabatan}, telah mengambil sumpah jabatan Anggota BPD Desa ${bpd.desa} berdasarkan Surat Keputusan Bupati Banjarnegara.`;

    doc.setFontSize(11); // Font isi sedikit diperkecil agar muat
    doc.setFont('times', 'normal');
    
    // Paragraf 1
    const lines1 = doc.splitTextToSize(paragrafPembuka, contentWidth);
    doc.text(lines1, marginLeft, yPos, { align: "justify", maxWidth: contentWidth });
    yPos += (lines1.length * 5) + 4;

    // Data Anggota
    doc.text("Pejabat yang mengangkat sumpah:", marginLeft, yPos); yPos += 5;
    doc.text(`Nama      : ${bpd.nama}`, marginLeft + 10, yPos); yPos += 5;
    doc.text(`Jabatan   : Anggota BPD`, marginLeft + 10, yPos); yPos += 5;
    doc.text(`Periode   : ${bpd.periode || '-'}`, marginLeft + 10, yPos); yPos += 8;

    // Saksi-saksi
    doc.text("Dengan disaksikan oleh:", marginLeft, yPos); yPos += 5;
    doc.text(`1. ${config.saksi1Nama} (${config.saksi1Jabatan})`, marginLeft + 10, yPos); yPos += 5;
    doc.text(`2. ${config.saksi2Nama} (${config.saksi2Jabatan})`, marginLeft + 10, yPos); yPos += 5;
    
    // Rohaniawan (Opsional, jika ada di config)
    if (config.rohaniawanNama) {
        doc.text(`3. ${config.rohaniawanNama} (Rohaniawan)`, marginLeft + 10, yPos); yPos += 5;
    }

    yPos += 4;
    const paragrafPenutup = "Demikian Berita Acara Pengambilan Sumpah Jabatan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.";
    const linesEnd = doc.splitTextToSize(paragrafPenutup, contentWidth);
    doc.text(linesEnd, marginLeft, yPos, { align: "justify", maxWidth: contentWidth });

    // --- 5. TANDA TANGAN (Posisi Absolut di Bawah) ---
    // Kita set posisi Y tanda tangan secara manual agar pas di bawah halaman
    // Area tanda tangan dimulai sekitar 90mm dari bawah kertas
    const signStartY = pageHeight - 95; 

    // Pastikan konten tidak menabrak area tanda tangan
    if (yPos > signStartY) {
        console.warn("Konten terlalu panjang, mungkin menabrak tanda tangan.");
        // Opsional: doc.addPage(); signStartY = 40; // Jika ingin multi-page, tapi request 1 halaman.
    }

    let currentSignY = signStartY;

    // Layout Kolom Tanda Tangan
    const leftColX = marginLeft + 10;
    const rightColX = pageWidth - marginRight - 50;
    
    doc.setFontSize(10);

    // Baris 1: Yang Mengangkat & Mengambil Sumpah
    doc.text("Yang Mengangkat Sumpah,", leftColX, currentSignY, { align: 'center' });
    doc.text("Yang Mengambil Sumpah,", rightColX, currentSignY, { align: 'center' });
    
    currentSignY += 20;
    doc.setFont('times', 'bold');
    doc.text(`(${bpd.nama})`, leftColX, currentSignY, { align: 'center' });
    doc.text(`(${config.pejabatNama})`, rightColX, currentSignY, { align: 'center' });
    
    // Baris 2: Saksi-Saksi
    currentSignY += 10;
    doc.setFont('times', 'normal');
    centerText("SAKSI - SAKSI", currentSignY);
    
    currentSignY += 8;
    doc.text("Saksi I", leftColX, currentSignY, { align: 'center' });
    doc.text("Saksi II", rightColX, currentSignY, { align: 'center' });

    currentSignY += 20;
    doc.setFont('times', 'bold');
    doc.text(`(${config.saksi1Nama})`, leftColX, currentSignY, { align: 'center' });
    doc.text(`(${config.saksi2Nama})`, rightColX, currentSignY, { align: 'center' });


    // Simpan File
    doc.save(`BA_Sumpah_${bpd.nama.replace(/\s/g, '_')}.pdf`);
};