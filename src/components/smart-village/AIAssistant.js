import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';

// --- KONFIGURASI API KEY ---
// Pastikan tidak ada spasi tambahan di string API Key
const GEMINI_API_KEY = (process.env.REACT_APP_GEMINI_API_KEY || "AIzaSyANUh8J5KhiQooP4EjdQhgcWih11I0c_LE").trim();

// --- ICONS (Inline SVG) ---
const ChevronDownIcon = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const BotIcon = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="5" r="2"></circle>
    <path d="M12 7v4"></path>
    <line x1="8" y1="16" x2="8" y2="16"></line>
    <line x1="16" y1="16" x2="16" y2="16"></line>
  </svg>
);

const XIcon = ({ size = 24 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const Loader2Icon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
);

const SendIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const ExternalLinkIcon = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const HelpCircleIcon = ({ size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

// --- KNOWLEDGE BASE: PANDUAN PER HALAMAN (Context untuk AI) ---
const PAGE_KNOWLEDGE = {
  '/app/aset/peta': {
    title: 'Peta Aset Desa',
    description: 'Halaman ini menampilkan sebaran aset desa secara visual di atas peta.',
    tips: [
      'Gunakan mode "Satelit" untuk melihat kondisi geografis nyata.',
      'Klik marker aset untuk melihat foto dan detailnya.',
      'Admin Kecamatan dapat mengedit batas wilayah dengan mengklik tombol "Edit Batas" di sidebar.',
      'Geser titik-titik hijau pada peta untuk menyesuaikan area desa.'
    ]
  },
  '/app/aset': {
    title: 'Dashboard Aset',
    description: 'Pusat manajemen inventaris dan kekayaan desa.',
    tips: [
      'Anda bisa menambahkan aset baru dengan tombol "Tambah Aset".',
      'Gunakan fitur filter untuk memisahkan aset Tanah, Bangunan, atau Kendaraan.',
      'Pastikan mengisi koordinat (Latitude/Longitude) agar aset muncul di Peta.'
    ]
  },
  '/app/keuangan': {
    title: 'Keuangan Desa',
    description: 'Modul untuk mengelola APBDes, pemasukan, dan pengeluaran.',
    tips: [
      'Cek grafik realisasi untuk melihat penyerapan anggaran.',
      'Menu "Penganggaran" digunakan untuk merencanakan APBDes awal tahun.',
      'Menu "Penatausahaan" adalah buku kas umum harian.'
    ]
  },
  '/app/perangkat': {
    title: 'Manajemen Perangkat Desa',
    description: 'Data kepegawaian staf dan pejabat desa.',
    tips: [
      'Pastikan NIK perangkat sesuai dengan data kependudukan.',
      'Anda bisa mencetak SK langsung dari menu detail perangkat.'
    ]
  },
  '/app/laporan': {
    title: 'Pusat Laporan',
    description: 'Tempat mencetak berbagai dokumen resmi.',
    tips: [
      'Pilih jenis laporan yang dibutuhkan (PDF/Excel).',
      'Laporan Realisasi Anggaran tersedia dalam format resmi pemerintah.'
    ]
  }
};

// --- ROUTES UNTUK NAVIGASI OTOMATIS ---
const APP_ROUTES = [
  { keywords: ['dashboard', 'beranda', 'home', 'depan'], path: '/app', label: 'Dashboard Utama' },
  { keywords: ['peta', 'lokasi', 'gis', 'denah'], path: '/app/aset/peta', label: 'Peta Aset Desa' },
  { keywords: ['perangkat', 'staf', 'pegawai'], path: '/app/perangkat', label: 'Manajemen Perangkat' },
  { keywords: ['keuangan', 'anggaran', 'apbdes'], path: '/app/keuangan', label: 'Keuangan Desa' },
  { keywords: ['aset', 'barang', 'inventaris'], path: '/app/aset', label: 'Data Aset' },
  { keywords: ['bpd', 'badan permusyawaratan'], path: '/app/bpd', label: 'Dashboard BPD' },
  { keywords: ['lpm'], path: '/app/lpm', label: 'Dashboard LPM' },
  { keywords: ['surat', 'arsip', 'dokumen'], path: '/app/efile', label: 'Arsip Digital' },
];

const AIAssistant = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const [messages, setMessages] = useState([]);

  // --- Initial Greeting ---
  useEffect(() => {
    const currentPath = location.pathname;
    const pageInfo = PAGE_KNOWLEDGE[currentPath];
    
    let welcomeText = "Halo! Saya Asisten Pintar Simpekdes. Anda bisa bertanya apa saja, cari data, atau minta bantuan navigasi.";
    let suggestionAction = null;

    if (pageInfo) {
      welcomeText = `Selamat datang di **${pageInfo.title}**. Saya siap membantu Anda di halaman ini.`;
      suggestionAction = {
        type: 'suggestion',
        label: 'Panduan Halaman Ini',
        action: () => handleAskContext(currentPath)
      };
    }

    // Hanya reset pesan jika belum ada pesan (untuk mencegah reset saat re-render)
    if (messages.length === 0) {
        setMessages([{ 
          id: Date.now(), 
          text: welcomeText, 
          sender: 'bot',
          actions: suggestionAction ? [suggestionAction] : []
        }]);
    }
  }, [location.pathname, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // --- FUNGSI MENGHUBUNGI GOOGLE GEMINI API (DENGAN FALLBACK MODEL) ---
  const callGeminiAI = async (userQuery, pageContext) => {
    // Validasi API Key yang lebih ketat
    if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
        console.error("API Key Invalid:", GEMINI_API_KEY);
        return "⚠️ API Key AI belum terpasang dengan benar. Silakan periksa konfigurasi kode.";
    }

    // Strategi Fallback: Coba beberapa model jika satu gagal (misal karena 404 atau deprecation)
    // Urutan prioritas: Flash (Cepat) -> Latest -> Pro (Standar Stabil)
    const modelsToTry = [
        "gemini-1.5-flash", 
        "gemini-1.5-flash-latest",
        "gemini-pro"
    ];
    
    // Prompt Engineering: Memberi "Karakter" dan "Konteks" pada AI
    const systemPrompt = `
      Kamu adalah Asisten Cerdas untuk Aplikasi Pemerintahan Desa "Simpekdes".
      Karaktermu: Ramah, Sopan, Profesional, dan Informatif (selalu menjawab dalam Bahasa Indonesia yang baik).
      
      KONTEKS HALAMAN USER SAAT INI:
      - Judul Halaman: ${pageContext?.title || 'Tidak spesifik'}
      - Deskripsi Halaman: ${pageContext?.description || '-'}
      - Tips Penggunaan: ${pageContext?.tips?.join(', ') || '-'}

      INSTRUKSI:
      1. Jawablah pertanyaan user secara langsung dan ringkas.
      2. Jika pertanyaan relevan dengan KONTEKS HALAMAN di atas, jelaskan cara penggunaannya.
      3. Jika user bertanya hal umum (pendidikan, pertanian, teknologi, sapaan), jawablah layaknya asisten pribadi yang pintar.
      4. Hindari menjawab hal sensitif (SARA, Politik Praktis).
      5. Jika user meminta data spesifik yang tidak kamu tahu, sarankan untuk menggunakan fitur pencarian di aplikasi.
    `;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: `User bertanya: "${userQuery}"` }
          ]
        }
      ],
      generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
      }
    };

    // Loop untuk mencoba setiap model sampai berhasil
    for (const model of modelsToTry) {
        try {
            console.log(`Mencoba menghubungi AI dengan model: ${model}...`);
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // Jika error 404 (Model Not Found), lanjutkan ke model berikutnya di list
                if (response.status === 404) {
                    console.warn(`Model ${model} tidak ditemukan (404). Mencoba fallback...`);
                    continue; 
                }
                
                // Jika error 429 (Quota Exceeded), tidak perlu coba model lain karena limit per akun
                if (response.status === 429) {
                    return "Maaf, layanan AI sedang sibuk karena batas kuota penggunaan gratis tercapai. Silakan coba lagi nanti.";
                }

                // Error lain
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text;
            } else {
                // Respons sukses tapi kosong (mungkin terfilter safety), coba model lain
                console.warn(`Respon kosong dari model ${model}, mencoba fallback...`);
                continue;
            }
        } catch (error) {
            console.error(`Gagal dengan model ${model}:`, error.message);
            // Lanjut ke iterasi berikutnya (model selanjutnya)
        }
    }

    // Jika semua model gagal
    return "Maaf, saat ini saya tidak dapat terhubung ke server kecerdasan buatan (Semua model sibuk). Mohon periksa koneksi internet Anda atau coba lagi beberapa saat lagi.";
  };

  const handleAskContext = (path) => {
    const info = PAGE_KNOWLEDGE[path];
    if (info) {
      const tipsText = info.tips.map((tip, idx) => `• ${tip}`).join('\n');
      setMessages(prev => [
        ...prev, 
        { id: Date.now(), text: "Bisa jelaskan fitur di halaman ini?", sender: 'user' },
        { id: Date.now() + 1, text: `Tentu! Ini panduan untuk halaman ini:\n\n${tipsText}`, sender: 'bot' }
      ]);
    }
  };

  // --- LOGIC UTAMA: HYBRID (LOCAL + CLOUD) ---
  const processQuery = async (userText) => {
    const text = userText.toLowerCase();
    let responseText = '';
    let dataResults = [];
    let actionResults = [];
    let handledLocally = false;

    setIsTyping(true);

    try {
      // 1. PRIORITAS TERTINGGI: NAVIGASI LOKAL (Cepat & Akurat)
      if (APP_ROUTES.some(route => route.keywords.some(k => text.includes(k))) && (text.includes('buka') || text.includes('ke') || text.includes('lihat'))) {
         const routeMatch = APP_ROUTES.find(route => route.keywords.some(k => text.includes(k)));
         if (routeMatch) {
            responseText = `Siap! Saya siapkan jalan pintas ke ${routeMatch.label}.`;
            actionResults.push({
                type: 'navigation',
                label: `Buka ${routeMatch.label}`,
                path: routeMatch.path,
                action: () => { setIsOpen(false); navigate(routeMatch.path); }
            });
            handledLocally = true;
         }
      }

      // 2. PRIORITAS KEDUA: CARI DATA SPESIFIK (Privasi & Keamanan)
      else if (text.includes('cari warga') || text.includes('penduduk') || text.includes('siapa')) {
        const nameMatch = text.match(/bernama\s+(\w+)|cari\s+warga\s+(\w+)|siapa\s+(\w+)/);
        const searchName = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3]) : text.split(' ').pop();

        if (searchName && searchName.length > 2) {
            const q = query(
                collection(db, "penduduk"), 
                where("nama", ">=", searchName.toUpperCase()),
                where("nama", "<=", searchName.toUpperCase() + '\uf8ff'),
                limit(3)
            );
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                responseText = `Ditemukan ${querySnapshot.size} warga dengan nama "${searchName}":`;
                dataResults = querySnapshot.docs.map(doc => ({ type: 'warga', data: doc.data() }));
                handledLocally = true;
            } else {
                // Jika tidak ketemu di DB lokal, biarkan AI menjawab (mungkin user tanya tokoh publik)
                handledLocally = false; 
            }
        }
      } 
      else if (text.includes('aset') || text.includes('barang')) {
        const itemMatch = text.match(/aset\s+(\w+)|barang\s+(\w+)/);
        const searchItem = itemMatch ? (itemMatch[1] || itemMatch[2]) : text.split(' ').pop();

        if (searchItem && searchItem.length > 2) {
             const q = query(
                collection(db, "aset_desa"), 
                where("nama_barang", ">=", searchItem), 
                where("nama_barang", "<=", searchItem + '\uf8ff'),
                limit(3)
            );
            const querySnapshot = await getDocs(q);

             if (!querySnapshot.empty) {
                responseText = `Berikut data aset "${searchItem}" yang ditemukan:`;
                dataResults = querySnapshot.docs.map(doc => ({ type: 'aset', data: doc.data() }));
                handledLocally = true;
             }
        }
      }

      // 3. JIKA BELUM DITANGANI LOKAL -> TANYA AI (GEN-AI)
      if (!handledLocally) {
          const currentPageContext = PAGE_KNOWLEDGE[location.pathname];
          // Memastikan kita menunggu respon AI sebelum lanjut
          const aiResponse = await callGeminiAI(userText, currentPageContext);
          responseText = aiResponse;
      }

    } catch (error) {
        console.error("System Error:", error);
        responseText = "Maaf, sistem sedang mengalami gangguan.";
    }

    // Tampilkan Jawaban
    setMessages(prev => [
      ...prev, 
      { id: Date.now(), text: responseText, sender: 'bot', results: dataResults, actions: actionResults }
    ]);
    setIsTyping(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), text: input, sender: 'user' }]);
    const queryText = input;
    setInput('');
    processQuery(queryText);
  };

  return (
    <>
        {/* Toggle Button */}
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="fixed bottom-6 right-6 z-[1000] p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-2 group ring-4 ring-white/50"
        >
            {isOpen ? <ChevronDownIcon size={24} /> : <BotIcon size={28} />}
            <span className={`max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 whitespace-nowrap font-medium ${isOpen ? 'hidden' : 'block'}`}>
                Asisten Admin
            </span>
        </button>

        {/* Chat Window */}
        <div className={`fixed bottom-24 right-4 md:right-6 w-[90vw] md:w-96 max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[1000] flex flex-col transition-all duration-300 transform origin-bottom-right border border-gray-200 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}>
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl flex justify-between items-center text-white shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm border border-white/30">
                        <BotIcon size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm tracking-wide">Smart AI Assistant</h3>
                        <p className="text-[10px] text-blue-100 opacity-90 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Gemini Powered
                        </p>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-lg transition">
                    <XIcon size={18} />
                </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 h-96 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        {/* Bubble Chat */}
                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed whitespace-pre-line ${
                            msg.sender === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                        }`}>
                            {/* Render Markdown-like text sederhana */}
                            {msg.text.split('\n').map((line, i) => (
                                <span key={i} className="block min-h-[1em]">{line}</span>
                            ))}
                        </div>
                        
                        {/* Action Buttons (Navigasi / Saran) */}
                        {msg.actions && msg.actions.length > 0 && (
                            <div className="mt-2 w-[85%] space-y-2">
                                {msg.actions.map((action, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={action.action}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-semibold group ${
                                            action.type === 'suggestion' 
                                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {action.type === 'suggestion' ? <HelpCircleIcon size={14} /> : <ExternalLinkIcon size={14} />}
                                            <span>{action.label}</span>
                                        </div>
                                        <ChevronDownIcon size={14} className="transform -rotate-90 opacity-50 group-hover:translate-x-1 transition-transform"/>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Data Results (Warga/Aset) - Hanya jika pencarian lokal berhasil */}
                        {msg.results && msg.results.length > 0 && (
                            <div className="mt-3 w-full max-w-[95%] space-y-2">
                                {msg.results.map((res, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs hover:border-indigo-300 transition-all cursor-default relative overflow-hidden group">
                                        <div className={`absolute top-0 left-0 w-1 h-full ${res.type === 'warga' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                        {res.type === 'warga' && (
                                            <div className="pl-2 flex flex-col gap-1">
                                                <div className="font-bold text-indigo-700 text-sm">{res.data.nama}</div>
                                                <div className="text-slate-500 flex justify-between border-b border-slate-50 pb-1 mb-1">
                                                    <span>NIK: {res.data.nik}</span>
                                                </div>
                                                <div className="text-slate-500 truncate">{res.data.alamat}</div>
                                            </div>
                                        )}
                                        {res.type === 'aset' && (
                                            <div className="pl-2 flex flex-col gap-1">
                                                <div className="font-bold text-emerald-700 text-sm">{res.data.nama_barang}</div>
                                                <div className="text-slate-500 text-[10px]">Kode: {res.data.kode_barang}</div>
                                                <div className="flex justify-between mt-1 items-center pt-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${res.data.kondisi === 'Baik' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{res.data.kondisi}</span>
                                                    <span className="font-bold text-slate-700">{res.data.jumlah} Unit</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                
                {isTyping && (
                    <div className="flex items-start animate-pulse">
                         <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center gap-2">
                            <Loader2Icon className="w-4 h-4 animate-spin text-indigo-500" />
                            <span className="text-xs text-slate-400 font-medium">Sedang berpikir...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-100 bg-white rounded-b-2xl">
                <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl focus-within:ring-2 focus-within:ring-indigo-100 focus-within:bg-white transition-all border border-transparent focus-within:border-indigo-200 shadow-inner">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ketik pertanyaan apa saja..."
                        className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-slate-700 placeholder-slate-400"
                    />
                    <button 
                        type="submit" 
                        disabled={!input.trim()}
                        className={`p-2.5 rounded-lg transition-all duration-200 flex-shrink-0 ${
                            input.trim() 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transform hover:scale-105' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <SendIcon size={16} />
                    </button>
                </div>
            </form>
        </div>
    </>
  );
};

export default AIAssistant;