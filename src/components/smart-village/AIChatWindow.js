import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { 
  Send, X, Sparkles, User, Bot, Loader2, Settings, 
  MapPin, AlertCircle, Trash2, Cpu, Mic, Volume2, Copy, Check, StopCircle,
  Minimize2, Maximize2, Square
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchVillageContext, callAIModel } from '../../services/aiService';
import { AI_PROVIDERS, DEFAULT_CONFIG } from '../../services/aiModels';
import { checkLocalIntent } from '../../services/localIntentService';

export default function AIChatWindow({ onClose, pageContext, currentSize, onResize }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // State Pesan
  const [messages, setMessages] = useState([
    { id: 1, text: "Halo! 👋 Saya Asisten Cerdas Simpekdes. Ada yang bisa saya bantu?", sender: 'ai', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // State UI
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);

  // State Config AI
  const [aiConfig, setAiConfig] = useState(() => {
    const saved = localStorage.getItem('simpekdes_ai_config');
    try {
        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.provider) return DEFAULT_CONFIG;
        return parsed;
    } catch {
        return DEFAULT_CONFIG;
    }
  });

  // Efek: Load Suara Browser saat komponen dimuat
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    
    loadVoices();
    
    // Chrome memuat suara secara asinkron
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Efek: Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isListening]);

  // Efek: Focus Input
  useEffect(() => {
    if (!showSettings && inputRef.current) inputRef.current.focus();
  }, [showSettings]);

  // Handler Ganti Provider di Settings
  const handleProviderChange = (e) => {
    const newProviderId = e.target.value;
    const providerData = AI_PROVIDERS[newProviderId];
    
    setAiConfig(prev => ({
        ...prev,
        provider: newProviderId,
        model: providerData.models.length > 0 ? providerData.models[0] : '',
        baseUrl: providerData.baseUrl
    }));
  };

  // Logika Resize
  const handleResize = () => {
    if (currentSize === 'medium') onResize('large');
    else if (currentSize === 'large') onResize('small');
    else onResize('medium');
  };

  const getResizeIcon = () => {
    if (currentSize === 'medium') return <Maximize2 size={16} />;
    if (currentSize === 'large') return <Minimize2 size={16} />;
    return <Square size={16} />;
  };

  // Fitur Multimedia: Voice Input
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Browser tidak support Voice."); return; }
    if (isListening) { setIsListening(false); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Bahasa Indonesia
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => setInputText(e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // Fitur Multimedia: Text-to-Speech (Canggih)
  const handleSpeak = (text, msgId) => {
    // Jika sedang bicara pesan yang sama, stop
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    // Stop suara sebelumnya
    window.speechSynthesis.cancel();

    // Buat utterance baru
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; // Set bahasa Indonesia
    utterance.rate = 1.0; // Kecepatan normal
    utterance.pitch = 1.0; // Nada normal

    // Cari suara Indonesia terbaik (Prioritas: Google Bahasa Indonesia)
    if (availableVoices.length > 0) {
        const indoVoice = availableVoices.find(v => v.lang === 'id-ID' && v.name.includes('Google')) 
                       || availableVoices.find(v => v.lang === 'id-ID');
        
        if (indoVoice) {
            utterance.voice = indoVoice;
        }
    }

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = (e) => {
        console.error("Speech Error:", e);
        setSpeakingMsgId(null);
    };

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Kirim Pesan
  const handleSendMessage = async (e, overrideText = null) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || inputText;
    if (!textToSend.trim()) return;

    const userMsg = { id: Date.now(), text: textToSend, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    // Cek Lokal dulu
    const localResponse = checkLocalIntent(textToSend);
    if (localResponse) {
        setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now()+1, text: localResponse.text, sender: 'ai', timestamp: new Date(), isLocal: true }]);
            setIsLoading(false);
            if (localResponse.actionPath) setTimeout(() => navigate(localResponse.actionPath), 800);
        }, 600);
        return;
    }

    // Panggil AI
    try {
      const villageData = await fetchVillageContext();
      const systemPrompt = `
        Anda adalah Asisten Desa Simpekdes.
        [CONTEXT] Halaman: ${pageContext.title}, User: ${currentUser?.email || 'Tamu'}
        ${villageData}
        
        INSTRUKSI:
        1. Jawab santai, ramah, dan manusiawi dalam Bahasa Indonesia.
        2. Jangan kaku seperti robot.
        3. Hindari tag kode kecuali diminta.
      `;

      const history = messages.filter(m => m.id !== 1).map(m => ({ 
        role: m.sender === 'user' ? 'user' : 'assistant', 
        content: m.text 
      }));
      
      const aiResponseText = await callAIModel(
          history.concat({ role: "user", content: textToSend }), 
          aiConfig, 
          systemPrompt
      );

      setMessages(prev => [...prev, { id: Date.now() + 1, text: aiResponseText, sender: 'ai', timestamp: new Date() }]);

    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        text: `⚠️ **Gagal:** ${error.message}. Cek pengaturan API Key.`, 
        sender: 'ai', 
        isError: true,
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('simpekdes_ai_config', JSON.stringify(aiConfig));
    setShowSettings(false);
    setMessages(prev => [...prev, { id: Date.now(), text: `✅ **Pengaturan Disimpan!** Menggunakan: ${AI_PROVIDERS[aiConfig.provider].name}`, sender: 'ai', timestamp: new Date() }]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b dark:border-slate-700 shadow-sm shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
             {/* HEADER AVATAR: Ikon Robot Modern */}
             <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Bot size={22} />
             </div>
             <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-green-500 border-2 border-white dark:border-slate-800"></span>
             </span>
          </div>
          <div>
            <h3 className="font-bold text-xs sm:text-sm bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Asisten Desa</h3>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <MapPin size={10} />
              <span className="truncate max-w-[100px] sm:max-w-[120px]">{pageContext.title}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleResize} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-500" title="Ubah Ukuran">
            {getResizeIcon()}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'} text-slate-500`} title="Pengaturan AI">
            <Settings size={18} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded-full transition">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* SETTINGS MODE */}
      {showSettings ? (
        <div className="flex-1 p-6 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2 border-b pb-2 dark:border-slate-700">
            <Cpu size={20} className="text-indigo-500" /> Konfigurasi AI
          </h4>
          <form onSubmit={handleSaveSettings} className="space-y-5">
            
            {/* 1. Pilih Provider */}
            <div>
              <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">Pilih Provider AI</label>
              <select 
                  value={aiConfig.provider}
                  onChange={handleProviderChange}
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 outline-none text-sm focus:ring-2 focus:ring-indigo-500"
              >
                  {Object.values(AI_PROVIDERS).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
              <p className="text-[10px] mt-1 text-slate-400 px-1">
                {AI_PROVIDERS[aiConfig.provider]?.description}
              </p>
            </div>

            {/* 2. Konfigurasi Khusus Provider */}
            {aiConfig.provider === 'openrouter' ? (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium flex gap-2 items-start">
                        <Sparkles size={14} className="mt-0.5 shrink-0" />
                        Mode Auto-Switch Aktif: Sistem otomatis mencari model gratis terbaik.
                    </p>
                </div>
            ) : aiConfig.provider === 'custom' ? (
                <div>
                    <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">Base URL</label>
                    <input 
                        type="text" 
                        value={aiConfig.baseUrl}
                        onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                        placeholder="http://localhost:11434/v1"
                        className="w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                    />
                    <label className="block text-xs font-bold mb-1.5 ml-1 mt-3 text-slate-500">Model Name</label>
                    <input 
                        type="text" 
                        value={aiConfig.model}
                        onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})}
                        placeholder="llama3"
                        className="w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
            ) : (
                <div>
                    <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">Pilih Model</label>
                    <select 
                        value={aiConfig.model}
                        onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})}
                        className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 outline-none text-sm"
                    >
                        {AI_PROVIDERS[aiConfig.provider]?.models.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* 3. API Key */}
            <div>
              <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">API Key ({AI_PROVIDERS[aiConfig.provider]?.name})</label>
              <input 
                type="password" 
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                placeholder={`Masukkan API Key...`}
                className="w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 outline-none text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 font-bold text-sm">Batal</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg">Simpan</button>
            </div>
          </form>
        </div>
      ) : (
        /* CHAT MODE */
        <>
          <div className="flex-1 p-4 overflow-y-auto space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} group`}>
                
                {/* AVATAR CHAT BUBBLE */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden shadow-md self-end mb-1 border ${msg.sender === 'user' ? 'bg-slate-700 border-slate-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400'}`}>
                  {msg.sender === 'user' ? (
                    <User size={14} className="text-white" />
                  ) : (
                    // IKON ROBOT (Dikembalikan)
                    <Bot size={16} className="text-white" />
                  )}
                </div>

                <div className={`relative max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all
                  ${msg.sender === 'user' 
                    ? 'bg-slate-800 text-white rounded-br-none dark:bg-slate-700' 
                    : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-bl-none text-slate-700 dark:text-slate-200'}
                `}>
                  {msg.isError ? (
                    <span className="text-red-400 font-medium flex items-center gap-1"><AlertCircle size={14}/> {msg.text}</span>
                  ) : (
                    <div className="prose dark:prose-invert prose-sm max-w-none prose-p:mb-1 prose-ul:my-1 prose-li:my-0">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  )}

                  <div className={`flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <div className="flex items-center gap-2">
                        {msg.sender === 'ai' && (
                            <button onClick={() => handleSpeak(msg.text, msg.id)} className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition ${speakingMsgId === msg.id ? 'text-indigo-500' : 'text-slate-400'}`}>
                                {speakingMsgId === msg.id ? <StopCircle size={12} /> : <Volume2 size={12} />}
                            </button>
                        )}
                        <button onClick={() => handleCopy(msg.text, msg.id)} className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition ${msg.sender === 'user' ? 'text-slate-300 hover:text-white' : 'text-slate-400'}`} title="Salin">
                            {copiedId === msg.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        </button>
                    </div>
                    <div className={`text-[10px] ${msg.sender === 'user' ? 'text-slate-300' : 'text-slate-400'}`}>
                        {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {/* TYPING INDICATOR */}
            {isLoading && (
              <div className="flex gap-3 group">
                {/* Avatar dengan efek loading Pulse */}
                <div className="relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden shadow-md bg-gradient-to-br from-indigo-500 to-purple-600 border border-indigo-400 self-end mb-1">
                    <div className="absolute inset-0 bg-white/20 animate-ping"></div>
                    <Bot size={16} className="text-white relative z-10" />
                </div>
                
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5 w-fit">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDuration: '1s', animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDuration: '1s', animationDelay: '200ms' }}></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDuration: '1s', animationDelay: '400ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0 relative">
             {messages.length > 2 && <button onClick={() => setMessages([{ id: 1, text: "Riwayat dibersihkan.", sender: 'ai', timestamp: new Date() }])} className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800/80 text-white text-[10px] px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg hover:bg-red-600/90 transition-opacity"><Trash2 size={10} /> Bersihkan</button>}
             
             <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
               <div className="relative flex-1">
                 <textarea ref={inputRef} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}} placeholder={isListening ? "Mendengarkan..." : "Ketik pesan..."} className={`w-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl py-3.5 pl-4 pr-10 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none max-h-32 text-sm shadow-inner ${isListening ? 'ring-2 ring-red-500' : ''}`} rows={1} disabled={isLoading} />
                 <button type="button" onClick={handleVoiceInput} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-indigo-500'}`}>{isListening ? <StopCircle size={18} /> : <Mic size={18} />}</button>
               </div>
               <button type="submit" disabled={!inputText.trim() || isLoading} className="p-3.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50"><Send size={20} /></button>
             </form>
          </div>
        </>
      )}
    </div>
  );
}