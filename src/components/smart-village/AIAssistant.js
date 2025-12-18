import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  MessageSquare, X, Send, Sparkles, User, Bot, Loader2, 
  Minimize2, Maximize2, AlertCircle, Key, Settings, ShieldCheck, 
  MapPin, Moon, Sun, ChevronRight, Navigation, RefreshCcw, Zap, Move
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- IMPORT ---
import { useAuth } from '../../context/AuthContext'; 
import { doc, getDoc } from 'firebase/firestore'; 
import { db } from '../../firebase'; 

// --- DAFTAR MODEL OPENROUTER (UPDATED & STABIL) ---
const CANDIDATE_MODELS = [
  "google/gemini-2.0-flash-exp:free",             
  "meta-llama/llama-3.2-11b-vision-instruct:free", 
  "mistralai/mistral-7b-instruct:free",           
  "microsoft/phi-3-mini-128k-instruct:free",      
  "openchat/openchat-7:free",                     
  "huggingfaceh4/zephyr-7b-beta:free"             
];

// --- PETA NAVIGASI (SITEMAP) UNTUK AI ---
const APP_SITEMAP = `
- Dashboard Utama: /app
- Data Perangkat Desa: /app/perangkat
- Keuangan Desa: /app/keuangan
- Aset Desa: /app/aset
- Surat Menyurat (SK): /app/manajemen-sk
- BPD: /app/bpd
- LPM: /app/lpm
- PKK: /app/pkk
- Karang Taruna: /app/karang-taruna
- RT/RW: /app/rt-rw
- Laporan: /app/laporan
- Pengaturan: /app/pengaturan
`;

// --- HELPER: DETEKSI KONTEKS HALAMAN ---
const getPageContext = (pathname) => {
    // Modul Organisasi Desa
    if (
        pathname.startsWith('/app/bpd') ||
        pathname.startsWith('/app/lpm') ||
        pathname.startsWith('/app/pkk') ||
        pathname.startsWith('/app/karang-taruna') ||
        pathname.startsWith('/app/rt-rw')) {

        switch (true) {
            // BPD
            case pathname.startsWith('/app/bpd/data'): return { module: 'organisasi', subModule: 'bpd', title: 'Manajemen Data BPD' };
            case pathname.startsWith('/app/bpd/berita-acara'): return { module: 'organisasi', subModule: 'bpd', title: 'Berita Acara BPD' };
            case pathname.startsWith('/app/bpd/pengaturan'): return { module: 'organisasi', subModule: 'bpd', title: 'Setelan Modul BPD' };
            case pathname.startsWith('/app/bpd'): return { module: 'organisasi', subModule: 'bpd', title: 'Dashboard BPD' };
            
            // LPM
            case pathname.startsWith('/app/lpm/data'): return { module: 'organisasi', subModule: 'lpm', title: 'Manajemen Data LPM' };
            case pathname.startsWith('/app/lpm/program'): return { module: 'organisasi', subModule: 'lpm', title: 'Program Kerja LPM' };
            case pathname.startsWith('/app/lpm'): return { module: 'organisasi', subModule: 'lpm', title: 'Dashboard LPM' };

            // PKK
            case pathname.startsWith('/app/pkk/data'): return { module: 'organisasi', subModule: 'pkk', title: 'Manajemen Pengurus PKK' };
            case pathname.startsWith('/app/pkk/program'): return { module: 'organisasi', subModule: 'pkk', title: 'Program Kerja PKK' };
            case pathname.startsWith('/app/pkk'): return { module: 'organisasi', subModule: 'pkk', title: 'Dashboard PKK' };
            
            // Karang Taruna
            case pathname.startsWith('/app/karang-taruna/data'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Manajemen Pengurus Karang Taruna' };
            case pathname.startsWith('/app/karang-taruna/kegiatan'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Kegiatan Karang Taruna' };
            case pathname.startsWith('/app/karang-taruna'): return { module: 'organisasi', subModule: 'karang_taruna', title: 'Dashboard Karang Taruna' };
            
            // RT/RW
            case pathname.startsWith('/app/rt-rw/rt'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Manajemen Data RT' };
            case pathname.startsWith('/app/rt-rw/rw'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Manajemen Data RW' };
            case pathname.startsWith('/app/rt-rw/rekapitulasi'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Rekapitulasi RT/RW' };
            case pathname.startsWith('/app/rt-rw'): return { module: 'organisasi', subModule: 'rt_rw', title: 'Dashboard RT/RW' };
            
            default: return { module: 'organisasi', title: 'Organisasi Desa' };
        }
    }

    // Modul Keuangan
    if (pathname.startsWith('/app/keuangan')) {
        switch (pathname) {
            case '/app/keuangan': return { module: 'keuangan', title: 'Dashboard Keuangan Desa' };
            case '/app/keuangan/penganggaran': return { module: 'keuangan', title: 'Penganggaran (APBDes)' };
            case '/app/keuangan/penatausahaan': return { module: 'keuangan', title: 'Penatausahaan (Buku Kas Umum)' };
            case '/app/keuangan/laporan': return { module: 'keuangan', title: 'Laporan Realisasi Anggaran' };
            default: return { module: 'keuangan', title: 'Manajemen Keuangan Desa' };
        }
    }
    
    // Modul Aset
    if (pathname.startsWith('/app/aset')) {
        switch(pathname) {
            case '/app/aset': return { module: 'aset', title: 'Dashboard Aset Desa' };
            case '/app/aset/manajemen': return { module: 'aset', title: 'Manajemen Aset (KIB)' };
            case '/app/aset/peta': return { module: 'aset', title: 'Peta Aset Desa' };
            default: return { module: 'aset', title: 'Manajemen Aset Desa' };
        }
    }

    // Modul E-File / Arsip Digital
    if (pathname.startsWith('/app/efile') || pathname.startsWith('/app/manajemen-sk') || pathname.startsWith('/app/data-sk')) {
        const titleMap = {
            '/app/efile': 'Dashboard Arsip Digital',
            '/app/manajemen-sk': 'Manajemen Unggah SK',
            '/app/data-sk/perangkat': 'Data SK Perangkat Desa',
            '/app/data-sk/bpd': 'Data SK BPD',
            '/app/data-sk/lpm': 'Data SK LPM',
            '/app/data-sk/pkk': 'Data SK PKK',
            '/app/data-sk/karang_taruna': 'Data SK Karang Taruna',
            '/app/data-sk/rt_rw': 'Data SK RT/RW',
        };
        return { module: 'efile', title: titleMap[pathname] || 'Arsip Digital' };
    }
    
    // Modul Pemerintahan (Default)
    switch (pathname) {
        case '/app': return { module: 'perangkat', title: 'Dashboard Utama' };
        case '/app/perangkat': return { module: 'perangkat', title: 'Manajemen Data Perangkat' };
        case '/app/histori-perangkat': return { module: 'perangkat', title: 'Riwayat Purna Tugas' };
        case '/app/rekapitulasi-aparatur': return { module: 'perangkat', title: 'Rekapitulasi Aparatur' };
        case '/app/laporan': return { module: 'perangkat', title: 'Pusat Laporan' };
        case '/app/manajemen-admin': return { module: 'perangkat', title: 'Manajemen Admin Desa' };
        case '/app/pengaturan': return { module: 'perangkat', title: 'Pengaturan Aplikasi' };
        case '/app/kalender-kegiatan': return { module: 'perangkat', title: 'Kalender Kegiatan' };
        default: return { module: 'umum', title: 'Halaman Umum' };
    }
};


// --- SYSTEM INSTRUCTION UTAMA (Untuk Fallback API) ---
const BASE_SYSTEM_INSTRUCTION = `
Anda adalah "Asisten Cerdas Simpekdes".
Tugas: Memandu perangkat desa dan membantu navigasi aplikasi.

SITEMAP APLIKASI:
${APP_SITEMAP}

GAYA KOMUNIKASI:
- Profesional, sopan, modern.
- Gunakan format Markdown.
- Jawablah dengan ringkas dan jelas.
`;

const AIAssistant = () => {
  // Hooks
  const location = useLocation();
  const navigate = useNavigate();
  
  // --- KONFIGURASI USER (REAL) ---
  const { currentUser } = useAuth() || {}; 

  // State UI
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default Dark Mode
  
  // State untuk Role yang divalidasi
  const [verifiedRole, setVerifiedRole] = useState(null);

  // --- STATE UNTUK DRAGGABLE (FITUR BARU) ---
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Posisi Offset
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // State Logic Chat
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Selamat datang! 👋 Saya siap membantu navigasi dan administrasi desa Anda.",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(""); 
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLocalResponse, setIsLocalResponse] = useState(false); 
  
  // API Key Management
  const defaultEnvKey = process.env.REACT_APP_OpenRouter_API_KEY || "";
  const [currentApiKey, setCurrentApiKey] = useState(() => {
    return localStorage.getItem('simpekdes_openrouter_key') || defaultEnvKey;
  });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // --- LOGIKA FETCH ROLE ---
  useEffect(() => {
    const checkUserRole = async () => {
      if (currentUser?.uid) {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setVerifiedRole(userDocSnap.data().role);
            } else {
                setVerifiedRole(currentUser.role);
            }
        } catch (err) {
            console.error("Gagal verifikasi role:", err);
            setVerifiedRole(currentUser.role);
        }
      } else {
        setVerifiedRole(null);
      }
    };
    checkUserRole();
  }, [currentUser]);

  const canAccessSettings = !!currentUser;

  // Effects
  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, isOpen, isLoading]);
  useEffect(() => { if (isOpen && !isMinimized && !showSettings) inputRef.current?.focus(); }, [isOpen, isMinimized]);

  // --- LOGIKA DRAGGABLE HANDLERS ---
  const handleDragStart = (e) => {
    // Hanya bereaksi pada klik kiri atau touch
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDragging.current = true;
    hasMoved.current = false;
    
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    
    dragStart.current = { x: clientX, y: clientY };
    startPos.current = { ...position };

    // Mencegah seleksi teks saat dragging
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleDragging = (e) => {
        if (!isDragging.current) return;

        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        const dx = clientX - dragStart.current.x;
        const dy = clientY - dragStart.current.y;

        // Jika bergerak lebih dari 5px, anggap sebagai drag (bukan klik)
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved.current = true;
        }

        setPosition({
            x: startPos.current.x + dx,
            y: startPos.current.y + dy
        });
    };

    const handleDragEnd = () => {
        if (isDragging.current) {
            isDragging.current = false;
            document.body.style.userSelect = '';
        }
    };

    // Pasang listener di window agar drag tidak lepas saat mouse keluar elemen
    window.addEventListener('mousemove', handleDragging);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragging);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
        window.removeEventListener('mousemove', handleDragging);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragging);
        window.removeEventListener('touchend', handleDragEnd);
    };
  }, []);

  // Fungsi Toggle Tema
  const toggleTheme = (e) => {
    e.stopPropagation();
    setIsDarkMode(!isDarkMode);
  };

  // Fungsi Simpan Key
  const handleSaveKey = (newKey) => {
    const cleanKey = newKey.trim();
    if (!cleanKey) {
        localStorage.removeItem('simpekdes_openrouter_key');
        setCurrentApiKey(defaultEnvKey);
    } else {
        localStorage.setItem('simpekdes_openrouter_key', cleanKey);
        setCurrentApiKey(cleanKey);
    }
    setShowSettings(false);
    setErrorMsg(null);
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: "✅ **Konfigurasi Tersimpan!** Sistem siap digunakan.",
      sender: 'ai',
      timestamp: new Date()
    }]);
  };

  // --- LOGIKA CERDAS LOKAL (OFFLINE NAVIGATION) ---
  const checkLocalIntent = (text) => {
    const lower = text.toLowerCase().trim();
    const actionWords = ['buka', 'lihat', 'pergi', 'tuju', 'akses', 'menu', 'tampilkan', 'ke'];
    const words = lower.split(' ');
    const hasAction = actionWords.some(w => lower.includes(w));
    const isShortCommand = words.length <= 3 && !lower.includes('apa') && !lower.includes('bagaimana') && !lower.includes('kenapa');

    if (!hasAction && !isShortCommand) return null; 

    if (lower.includes('dashboard') || lower.includes('home') || lower.includes('beranda') || (lower.includes('halaman') && lower.includes('utama'))) {
        return "Siap, kembali ke Dashboard Utama. [NAVIGATE:/app]";
    }
    if (lower.includes('keuangan') || lower.includes('anggaran') || lower.includes('apbdes') || lower.includes('bku') || lower.includes('kas')) {
        return "Baik, saya bukakan modul **Keuangan Desa**. [NAVIGATE:/app/keuangan]";
    }
    if (lower.includes('aset') || lower.includes('inventaris') || lower.includes('barang') || lower.includes('kib')) {
        return "Siap, menuju menu **Aset & Inventaris**. [NAVIGATE:/app/aset]";
    }
    if (lower.includes('perangkat') || lower.includes('staf') || lower.includes('pegawai') || lower.includes('aparatur')) {
        return "Membuka data **Perangkat Desa**. [NAVIGATE:/app/perangkat]";
    }
    if (lower.includes('surat') || lower.includes('sk') || lower.includes('arsip') || lower.includes('dokumen')) {
        return "Membuka manajemen **Surat & SK**. [NAVIGATE:/app/manajemen-sk]";
    }
    if (lower.includes('bpd')) return "Membuka menu **BPD**. [NAVIGATE:/app/bpd]";
    if (lower.includes('lpm')) return "Membuka menu **LPM**. [NAVIGATE:/app/lpm]";
    if (lower.includes('pkk')) return "Membuka menu **PKK**. [NAVIGATE:/app/pkk]";
    if (lower.includes('karang taruna') || lower.includes('pemuda')) return "Membuka menu **Karang Taruna**. [NAVIGATE:/app/karang-taruna]";
    if (lower.includes('rt') || lower.includes('rw') || lower.includes('penduduk') || lower.includes('warga')) {
        return "Menuju data **RT/RW & Kependudukan**. [NAVIGATE:/app/rt-rw]";
    }
    if (lower.includes('laporan') || lower.includes('rekap')) {
        return "Membuka pusat **Laporan**. [NAVIGATE:/app/laporan]";
    }
    if (lower.includes('pengaturan') || lower.includes('setting') || lower.includes('konfigurasi')) {
        return "Membuka halaman **Pengaturan Aplikasi**. [NAVIGATE:/app/pengaturan]";
    }
    if (lower.includes('kalender') || lower.includes('agenda') || lower.includes('jadwal')) {
        return "Membuka **Kalender Kegiatan**. [NAVIGATE:/app/kalender-kegiatan]";
    }

    return null;
  };

  // Fungsi Navigasi Pintar
  const handleSmartAction = (text) => {
    const navRegex = /\[NAVIGATE:(.*?)\]/;
    const match = text.match(navRegex);

    if (match) {
        const targetPath = match[1];
        const cleanText = text.replace(navRegex, '').trim();
        setTimeout(() => { navigate(targetPath); }, 800); 
        return { cleanText, navigated: true, path: targetPath };
    }
    return { cleanText: text, navigated: false };
  };

  // Generate Response
  const generateResponse = async (userText) => {
    if (!currentApiKey) throw new Error("API_KEY_MISSING");

    const pageContext = getPageContext(location.pathname);
    const DYNAMIC_SYSTEM_PROMPT = `
${BASE_SYSTEM_INSTRUCTION}
[KONTEKS USER]
- Halaman Aktif: ${pageContext.title}
- Role User: ${verifiedRole || 'User'}
`;

    const conversationHistory = messages
      .filter(m => !m.isError && m.id !== 1 && !m.text.includes("Konfigurasi Tersimpan"))
      .map(msg => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.text }));

    const fullMessages = [
      { role: "system", content: DYNAMIC_SYSTEM_PROMPT },
      ...conversationHistory,
      { role: "user", content: userText }
    ];

    let lastError = null;
    for (const modelName of CANDIDATE_MODELS) {
      try {
        setLoadingStatus(`Menghubungi model: ${modelName.split(':')[0]}...`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin, 
            "X-Title": "Simpekdes AI",
          },
          body: JSON.stringify({ model: modelName, messages: fullMessages, temperature: 0.5, max_tokens: 800 })
        });

        if (!response.ok) {
            if (response.status === 429 || response.status === 404 || response.status === 503) { continue; }
            throw new Error(`HTTP Error ${response.status}`);
        }

        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content;
        if (!aiText) throw new Error("Empty Response");
        return aiText; 
      } catch (err) {
        lastError = err;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw lastError;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setErrorMsg(null);
    setIsLocalResponse(false); 
    
    const userMessage = { id: Date.now(), text: inputText, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    const localReply = checkLocalIntent(userMessage.text);
    if (localReply) {
        setLoadingStatus("Memproses perintah navigasi...");
        setIsLocalResponse(true);
        setTimeout(() => {
            const { cleanText, navigated, path } = handleSmartAction(localReply);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: cleanText,
                sender: 'ai',
                timestamp: new Date(),
                actionPath: navigated ? path : null,
                isLocal: true 
            }]);
            setIsLoading(false);
            setLoadingStatus("");
        }, 600); 
        return; 
    }

    try {
      const rawResponse = await generateResponse(userMessage.text);
      const { cleanText, navigated, path } = handleSmartAction(rawResponse);
      const aiResponseMsg = {
          id: Date.now() + 1,
          text: cleanText,
          sender: 'ai',
          timestamp: new Date(),
          actionPath: navigated ? path : null
      };
      setMessages(prev => [...prev, aiResponseMsg]);
    } catch (error) {
      console.error("AI Error Full:", error);
      let friendlyError = "Semua model AI sedang sibuk. Mohon coba lagi nanti.";
      let isKeyError = false;
      if (error.message === "API_KEY_MISSING") {
        friendlyError = "API Key belum disetting. Silakan atur di menu Pengaturan.";
        isKeyError = true;
      } else if (error.message.includes("401")) {
        friendlyError = "API Key tidak valid/kadaluarsa.";
        isKeyError = true;
      }
      setErrorMsg(friendlyError);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: `⚠️ **Gagal:** ${friendlyError}`, sender: 'ai', isError: true, timestamp: new Date() }]);
      if (isKeyError && canAccessSettings) { setTimeout(() => setShowSettings(true), 1500); }
    } finally {
      setIsLoading(false);
      setLoadingStatus("");
    }
  };

  // --- STYLING CLASSES ---
  const themeClasses = {
      container: isDarkMode 
        ? "bg-slate-900/95 border-slate-700 shadow-2xl shadow-black/50" 
        : "bg-white/95 border-white/50 shadow-2xl shadow-indigo-900/10",
      header: isDarkMode
        ? "bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800"
        : "bg-gradient-to-r from-indigo-600 to-purple-600",
      body: isDarkMode ? "bg-slate-950" : "bg-slate-50",
      textMain: isDarkMode ? "text-slate-100" : "text-slate-800",
      textSub: isDarkMode ? "text-slate-400" : "text-purple-100",
      inputBg: isDarkMode ? "bg-slate-900 text-white border-slate-700 focus:border-indigo-500" : "bg-white text-gray-800 border-gray-200 focus:border-indigo-500",
      userBubble: "bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-900/20",
      aiBubble: isDarkMode ? "bg-slate-800 border border-slate-700 text-slate-200 shadow-sm" : "bg-white border border-gray-100 text-gray-700 shadow-sm",
      localBadge: isDarkMode ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200"
  };

  // --- RENDER ---
  return (
    <div 
        className={`fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans transition-transform duration-75`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }} // Aplikasi Posisi Drag
    >
      
      {/* WINDOW UTAMA */}
      <div className={`
          backdrop-blur-md border rounded-2xl overflow-hidden flex flex-col
          transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom-right
          ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-75 translate-y-20 pointer-events-none'}
          ${isMinimized ? 'w-72 h-14 rounded-full' : 'w-[90vw] sm:w-[400px] h-[600px] max-h-[85vh]'}
          ${themeClasses.container}
        `}
      >
        {/* HEADER (DRAGGABLE AREA SAAT OPEN) */}
        <div 
          className={`relative p-4 flex items-center justify-between shrink-0 ${themeClasses.header} cursor-move select-none`}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative group">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                <Sparkles size={18} className="text-yellow-300 drop-shadow-md animate-pulse" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-2 border-transparent rounded-full shadow-sm ${errorMsg ? 'bg-red-500' : 'bg-green-400 animate-pulse'}`}></div>
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-white text-sm tracking-wide flex items-center gap-2">
                 Asisten Desa <Move size={10} className="opacity-50" />
              </h3>
              <div className="flex items-center gap-1.5 opacity-80">
                 <MapPin size={10} className="text-white" />
                 <p className="text-[10px] text-white truncate max-w-[150px]">
                    {getPageContext(location.pathname).title}
                 </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 relative z-10" onMouseDown={(e) => e.stopPropagation()}> 
            <button 
                onClick={toggleTheme} 
                className="p-1.5 hover:bg-white/10 rounded-full text-white transition-all" 
                title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
            >
                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {canAccessSettings && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} 
                  className={`p-1.5 rounded-full transition-all ${showSettings ? 'bg-white/20 rotate-90 text-white' : 'hover:bg-white/10 text-white'}`}
                  title="Pengaturan API Key"
                >
                  <Settings size={14} />
                </button>
            )}

            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1.5 hover:bg-white/10 rounded-full text-white">
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="p-1.5 hover:bg-red-500/80 rounded-full text-white">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* SETTINGS PANEL */}
        {showSettings && !isMinimized && canAccessSettings && (
           <div className={`flex-1 p-6 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in zoom-in duration-300 ${themeClasses.body}`}>
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-2 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                <Key size={28} />
             </div>
             <div>
                <h4 className={`font-bold text-lg ${themeClasses.textMain}`}>API Key Configuration</h4>
                <p className={`text-xs mt-1 ${themeClasses.textSub}`}>Konfigurasi API Key OpenRouter.</p>
             </div>
             
             <div className="w-full text-left bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex gap-3">
                <ShieldCheck size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-blue-400/90 leading-relaxed">
                    API Key Default telah tertanam. Gunakan key pribadi hanya jika limit harian habis.
                </div>
             </div>

             <form onSubmit={(e) => { e.preventDefault(); handleSaveKey(e.target.keyInput.value); }} className="w-full space-y-3">
               <input 
                 name="keyInput"
                 defaultValue={currentApiKey === defaultEnvKey ? "" : currentApiKey}
                 placeholder="Kosongkan untuk reset ke Default"
                 className={`w-full px-4 py-3 rounded-xl text-sm font-mono outline-none border transition-all ${themeClasses.inputBg}`}
                 type="password"
               />
               <div className="flex gap-2">
                 <button type="button" onClick={() => setShowSettings(false)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Batal</button>
                 <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/20 transition-all">Simpan</button>
               </div>
             </form>
           </div>
        )}

        {/* CHAT AREA */}
        {!isMinimized && !showSettings && (
          <>
            <div className={`flex-1 overflow-y-auto p-4 space-y-5 scroll-smooth ${themeClasses.body}`}>
              
              {errorMsg && (
                 <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex gap-2 text-xs text-red-500 items-start animate-in slide-in-from-top-2">
                   <AlertCircle size={16} className="shrink-0 mt-0.5" />
                   <span>{errorMsg}</span>
                 </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-end gap-2 group ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`
                    w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:-translate-y-1
                    ${msg.sender === 'user' ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-slate-800 text-indigo-400 border border-slate-700' : 'bg-white text-indigo-600 border border-gray-100')}
                  `}>
                    {msg.sender === 'user' ? <User size={14} /> : (msg.isLocal ? <Zap size={16} className="text-yellow-400" /> : <Bot size={16} />)}
                  </div>

                  <div className={`
                    max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative group-hover:shadow-md transition-shadow
                    ${msg.sender === 'user' ? `${themeClasses.userBubble} rounded-br-none` : `${themeClasses.aiBubble} rounded-bl-none`}
                  `}>
                      <ReactMarkdown components={{
                        strong: ({node, ...props}) => <span className="font-bold text-indigo-400" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 my-2 opacity-90" {...props} />,
                        a: ({node, ...props}) => <a className="text-blue-400 hover:underline cursor-pointer" {...props} />
                      }}>
                        {msg.text}
                      </ReactMarkdown>
                      
                      {msg.actionPath && (
                          <button 
                            onClick={() => navigate(msg.actionPath)}
                            className="mt-3 flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-xs font-medium text-indigo-400 transition-colors w-full group/btn"
                          >
                             <Navigation size={12} />
                             <span>Buka Halaman Ini</span>
                             <ChevronRight size={12} className="ml-auto group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                      )}

                      <div className={`text-[9px] mt-1.5 opacity-50 flex items-center gap-1 ${msg.sender === 'user' ? 'justify-end text-white' : (isDarkMode ? 'text-slate-400' : 'text-gray-400')}`}>
                        {msg.isLocal && <span className="flex items-center gap-0.5 mr-2 text-emerald-500"><Zap size={8} /> Offline Mode</span>}
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex flex-col gap-1 ml-1">
                    <div className={`px-3 py-2 rounded-2xl rounded-bl-none shadow-sm w-fit ${themeClasses.aiBubble}`}>
                        <div className="flex gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${isLocalResponse ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                            <span className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${isLocalResponse ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                            <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isLocalResponse ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                        </div>
                    </div>
                    {loadingStatus && (
                        <span className="text-[9px] text-gray-400 ml-1 flex items-center gap-1 animate-pulse">
                            {isLocalResponse ? <Zap size={8} className="text-emerald-500" /> : <RefreshCcw size={8} />} {loadingStatus}
                        </span>
                    )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className={`p-3 border-t shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
              <form onSubmit={handleSendMessage} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ketik perintah... (Contoh: 'Keuangan', 'Buka Aset')"
                  className={`w-full pl-4 pr-12 py-3.5 rounded-xl text-sm outline-none border transition-all ${themeClasses.inputBg} ${isDarkMode ? 'placeholder-slate-500' : 'placeholder-gray-400'}`}
                  disabled={isLoading}
                />
                <button 
                    type="submit" 
                    disabled={!inputText.trim() || isLoading} 
                    className={`absolute right-2 top-2 p-1.5 rounded-lg transition-all ${!inputText.trim() ? 'opacity-50 cursor-not-allowed text-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
                </button>
              </form>
              <div className={`text-[9px] text-center mt-2 flex justify-center items-center gap-1 ${themeClasses.textSub}`}>
                 <Sparkles size={8} /> AI Simpekdes • {isDarkMode ? 'Mode Malam' : 'Mode Terang'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* FLOATING TRIGGER BUTTON (DRAGGABLE AREA SAAT CLOSED) */}
      <button 
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={() => { 
            if (hasMoved.current) return; // JANGAN BUKA JIKA HABIS DIGESER
            setIsOpen(!isOpen); 
            setIsMinimized(false); 
        }} 
        className={`
            pointer-events-auto mt-6 relative group cursor-move
            w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transform transition-all duration-300 active:scale-95 z-50
            ${isOpen 
                ? (isDarkMode ? 'bg-slate-700 text-slate-300 rotate-90' : 'bg-gray-800 text-gray-300 rotate-90') 
                : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'}
        `}
      >
        {!isOpen && (
            <>
                <span className="absolute inset-0 rounded-full bg-indigo-500 opacity-75 animate-ping pointer-events-none"></span>
                <span className="absolute -inset-1 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 opacity-30 blur-md animate-pulse pointer-events-none"></span>
            </>
        )}
        <div className="relative z-10">
            {isOpen ? <X size={28} /> : <MessageSquare size={28} className="fill-current" />}
        </div>
      </button>
    </div>
  );
};

export default AIAssistant;