import React, { useRef, useEffect, memo } from 'react';

// **PERBAIKAN**: Menggunakan React.memo dan useRef untuk mencegah konflik render React dengan contentEditable
const BeritaAcaraPreview = memo(({ config, bpd, content, onContentChange }) => {
    const contentRef = useRef(null);

    // Efek ini menyinkronkan state dari induk ke div yang dapat diedit.
    // Ini penting untuk memuat data awal atau ketika anggota BPD baru dipilih.
    useEffect(() => {
        if (contentRef.current && contentRef.current.innerText !== content) {
            contentRef.current.innerText = content;
        }
    }, [content]);

    // Handler ini memastikan bahwa teks biasa ditempel, bukan HTML yang diformat.
    const handlePaste = (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const namaLengkapBpd = `${bpd?.nama || '[Nama Anggota]'}${bpd?.gelar ? `, ${bpd.gelar}` : ''}`;
    const namaLengkapPejabat = `${config?.pejabatNama || '[Nama Pejabat]'}${config?.pejabatGelar ? `, ${config.pejabatGelar}` : ''}`;
    const namaLengkapSaksi1 = `${config?.saksi1Nama || '[Nama Saksi 1]'}${config?.saksi1Gelar ? `, ${config.saksi1Gelar}` : ''}`;
    const namaLengkapSaksi2 = `${config?.saksi2Nama || '[Nama Saksi 2]'}${config?.saksi2Gelar ? `, ${config.saksi2Gelar}` : ''}`;
    
    return (
        <div className="document-body">
            <div className="doc-header">
                <p className="font-bold">BERITA ACARA</p>
                <p className="font-bold">PENGAMBILAN SUMPAH JABATAN ANGGOTA BADAN PERMUSYAWARATAN DESA</p>
                <p className="font-bold">KANTOR KECAMATAN PUNGGELAN</p>
                <div className="header-line"></div>
                <p>NOMOR : {config?.nomor || '[Nomor Surat]'}</p>
            </div>

            <div 
                ref={contentRef}
                className="doc-content"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={onContentChange} 
                onPaste={handlePaste}
            />

            <table className="signature-table">
                <tbody>
                    <tr>
                        <td className="signature-cell">
                            <div contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste}>
                                <p>Anggota Badan Permusyawaratan Desa</p>
                                <p>Yang mengangkat sumpah,</p>
                            </div>
                            <div contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste} className="signature-space-editable" dangerouslySetInnerHTML={{ __html: '<br/><br/><br/>' }} />
                            <p className="font-bold underline">{namaLengkapBpd.toUpperCase()}</p>
                        </td>
                        <td className="signature-cell">
                             <div contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste}>
                                <p>Pejabat</p>
                                <p>Yang mengambil sumpah</p>
                                <p>{config?.pejabatJabatan || '[Jabatan Pejabat]'}</p>
                            </div>
                            <div contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste} className="signature-space-editable" dangerouslySetInnerHTML={{ __html: '<br/><br/><br/>' }} />
                            <p className="font-bold underline">{namaLengkapPejabat.toUpperCase()}</p>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <div className="witness-section" contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste}>
                <p className="font-bold">SAKSI - SAKSI</p>
            </div>
            <table className="signature-table">
                <tbody>
                    <tr>
                        <td className="signature-cell">
                            <div contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste} className="signature-space-editable" dangerouslySetInnerHTML={{ __html: '<br/><br/><br/>' }} />
                            <p className="font-bold underline">{namaLengkapSaksi2.toUpperCase()}</p>
                        </td>
                        <td className="signature-cell">
                            <div contentEditable={true} suppressContentEditableWarning={true} onPaste={handlePaste} className="signature-space-editable" dangerouslySetInnerHTML={{ __html: '<br/><br/><br/>' }} />
                            <p className="font-bold underline">{namaLengkapSaksi1.toUpperCase()}</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
});

export default BeritaAcaraPreview;

