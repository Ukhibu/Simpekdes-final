import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AI_PROVIDERS } from './aiModels';

// --- 1. CONTEXT AWARENESS (DATA DESA) ---
export const fetchVillageContext = async () => {
  try {
    const contextData = {
      penduduk: { total: 0 },
      surat: { total: 0, terbaru: [] },
      aset: { total: 0 }
    };

    // Data Surat
    try {
      const suratSnap = await getDocs(query(collection(db, 'surat_keluar'), orderBy('tanggal_surat', 'desc'), limit(3)));
      contextData.surat.total = suratSnap.size;
      contextData.surat.terbaru = suratSnap.docs.map(d => d.data().nomor_surat);
    } catch (e) {}

    // Data Perangkat
    try {
      const staffSnap = await getDocs(collection(db, 'perangkat_desa'));
      contextData.penduduk.total = staffSnap.size;
    } catch (e) {}

    // Data Aset
    try {
      const asetSnap = await getDocs(collection(db, 'aset_desa'));
      contextData.aset.total = asetSnap.size;
    } catch (e) {}

    return `
[DATA DESA REAL-TIME]
- Perangkat Desa: ${contextData.penduduk.total || 0} orang.
- Aset Terdata: ${contextData.aset.total || 0} item.
- Surat Terbaru: ${contextData.surat.terbaru.join(', ') || '-'}.
`;
  } catch (error) {
    return ""; 
  }
};

// --- 2. CORE AI ENGINE ---
export const callAIModel = async (messages, config, systemPromptPlusData) => {
  const finalMessages = [
    { role: "system", content: systemPromptPlusData },
    ...messages
  ];

  // Helper function untuk fetch API standar (OpenAI compatible)
  const executeFetch = async (url, key, modelName) => {
    // Normalisasi URL endpoint (tambah /chat/completions jika belum ada)
    let endpoint = url;
    if (!endpoint.endsWith('/chat/completions')) {
       endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    };

    // Header khusus OpenRouter agar masuk statistik 'Simpekdes AI'
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
      throw new Error(data.error?.message || `Error ${response.status}: ${response.statusText}`);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("Model merespons kosong.");
    }

    return data.choices[0].message.content;
  };

  // --- LOGIKA UTAMA: AUTO-SWITCHING ATAU DIRECT CALL ---
  
  // A. Jika Provider = OpenRouter, gunakan logika "Cari Model Hidup"
  if (config.provider === 'openrouter') {
    const candidateModels = AI_PROVIDERS.openrouter.models;
    let lastError = null;

    // Coba model satu per satu dari daftar prioritas
    for (const modelName of candidateModels) {
      try {
        console.log(`🤖 Mencoba model: ${modelName}...`);
        const result = await executeFetch(config.baseUrl, config.apiKey, modelName);
        
        // Jika berhasil, kembalikan hasil + info model yang dipakai (opsional, agar admin tahu)
        return result; // Bersih tanpa embel-embel, sesuai request
      } catch (err) {
        console.warn(`❌ Gagal ${modelName}:`, err.message);
        lastError = err;
        // Delay sedikit sebelum coba model berikutnya agar tidak spam
        await new Promise(r => setTimeout(r, 500)); 
      }
    }
    // Jika semua model gagal
    throw new Error(`Semua model OpenRouter sibuk/down. Terakhir: ${lastError?.message}`);
  } 
  
  // B. Provider Lain (Google, Groq, Mistral, dll) - Langsung panggil model yang dipilih
  else {
    try {
      const selectedProvider = AI_PROVIDERS[config.provider] || AI_PROVIDERS.custom;
      const baseUrl = config.provider === 'custom' ? config.baseUrl : selectedProvider.baseUrl;
      
      return await executeFetch(baseUrl, config.apiKey, config.model);
    } catch (error) {
      throw new Error(`Provider Error (${config.provider}): ${error.message}`);
    }
  }
};