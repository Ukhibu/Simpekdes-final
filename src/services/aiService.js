import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AI_PROVIDERS } from './aiModels';

// --- 1. CONTEXT AWARENESS (DATA DESA) ---
// Mengambil data real-time dari Firestore untuk memberi konteks pada AI
export const fetchVillageContext = async () => {
  try {
    const contextData = { penduduk: 0, surat: 0, aset: 0, suratTerbaru: '-' };

    // Coba ambil snapshot data (Safe Mode - Try Catch per item agar satu error tidak menghentikan semua)
    
    // A. Data Perangkat Desa
    try {
        const staffSnap = await getDocs(collection(db, 'perangkat_desa'));
        contextData.penduduk = staffSnap.size;
    } catch (e) {
        console.warn("AI Context: Gagal ambil data perangkat", e);
    }

    // B. Data Aset
    try {
        const asetSnap = await getDocs(collection(db, 'aset_desa'));
        contextData.aset = asetSnap.size;
    } catch (e) {
        console.warn("AI Context: Gagal ambil data aset", e);
    }

    // C. Surat Terakhir
    try {
        const suratSnap = await getDocs(query(collection(db, 'surat_keluar'), orderBy('tanggal_surat', 'desc'), limit(1)));
        if (!suratSnap.empty) {
            const data = suratSnap.docs[0].data();
            contextData.suratTerbaru = data.nomor_surat || 'Tanpa Nomor';
        }
    } catch (e) {
        console.warn("AI Context: Gagal ambil data surat", e);
    }

    return `
[DATA DESA LIVE]
- Jumlah Perangkat Desa: ${contextData.penduduk} orang
- Jumlah Aset Terdata: ${contextData.aset} item
- Surat Keluar Terakhir: ${contextData.suratTerbaru}
`;
  } catch (error) {
    console.error("Context Error:", error);
    return ""; 
  }
};

// --- 2. CORE AI ENGINE ---
export const callAIModel = async (messages, config, systemPromptPlusData) => {
  const finalMessages = [
    { role: "system", content: systemPromptPlusData },
    ...messages
  ];

  // LOGIKA KUNCI DEFAULT:
  // Jika config.apiKey kosong/tidak diatur user, gunakan dari .env
  const activeApiKey = config.apiKey && config.apiKey.trim() !== '' 
    ? config.apiKey 
    : process.env.REACT_APP_DEFAULT_OPENROUTER_KEY;

  // Validasi: Kecuali provider 'custom' (mungkin localhost/ollama), API Key wajib ada
  if (!activeApiKey && config.provider !== 'custom') {
      throw new Error("API Key tidak ditemukan. Mohon atur di pengaturan atau hubungi developer untuk Default Key.");
  }

  // Helper Fetch
  const executeFetch = async (url, key, modelName) => {
    let endpoint = url;
    // Normalisasi URL endpoint (tambah /chat/completions jika belum ada)
    if (!endpoint.endsWith('/chat/completions') && !endpoint.includes('generateContent')) {
       endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    };

    if (url.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "Simpekdes AI";
    }

    const payload = {
      model: modelName,
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 1000
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Error ${response.status}`);
    }
    
    if (!data.choices || data.choices.length === 0) {
        throw new Error("Model tidak memberikan respon (Empty Response).");
    }

    return data.choices[0].message?.content || "Tidak ada respon.";
  };

  // --- EKSEKUSI ---
  if (config.provider === 'openrouter') {
    // Auto-Switch Logic untuk OpenRouter: Cari model gratis yang aktif dari daftar aiModels.js
    const models = AI_PROVIDERS.openrouter?.models || [];
    let lastError = null;

    // Loop mencoba model satu per satu
    for (const model of models) {
      try {
        // console.log(`Mencoba model: ${model}...`);
        return await executeFetch(config.baseUrl, activeApiKey, model);
      } catch (err) {
        console.warn(`Model ${model} gagal, mencoba berikutnya... (${err.message})`);
        lastError = err;
        // Delay sedikit agar tidak spam request
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error(`Semua model AI sedang sibuk/down. Error terakhir: ${lastError?.message}`);
  } else {
    // Provider Lain (Google, Groq, dll) - Langsung panggil tanpa fallback
    const providerInfo = AI_PROVIDERS[config.provider] || AI_PROVIDERS.custom;
    const url = config.provider === 'custom' ? config.baseUrl : providerInfo.baseUrl;
    return await executeFetch(url, activeApiKey, config.model);
  }
};