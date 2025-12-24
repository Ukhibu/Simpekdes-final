import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { 
  Send, X, User, Bot, Settings, MapPin, AlertCircle, Trash2, Cpu, Mic, Volume2, Copy, Check, StopCircle,
  Minimize2, Maximize2, Square, Sparkles, Key, RefreshCcw, MessageSquare, Plus, ChevronDown, History, Loader2, AlertTriangle, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { fetchVillageContext, callAIModel } from '../../services/aiService';
import { AI_PROVIDERS, DEFAULT_CONFIG } from '../../services/aiModels';
import { checkLocalIntent, QUICK_ACTIONS } from '../../services/localIntentService';
import { getRandomSuggestions } from '../../services/localKnowledgeBase';
import { loadConversations, saveConversations, createConversation as createConversationStorage, deleteConversation as deleteConversationStorage } from '../../services/chatStorage';

// Sanity-check imported icons at runtime
const _importedIcons = {
  Send, X, User, Bot, Settings, MapPin, AlertCircle, Trash2, Cpu, Mic, Volume2, Copy, Check, StopCircle,
  Minimize2, Maximize2, Square, Sparkles, Key, RefreshCcw, MessageSquare, Plus, ChevronDown, History, Loader2, AlertTriangle, Zap
};
if (typeof window !== 'undefined') {
  Object.entries(_importedIcons).forEach(([name, val]) => {
    if (typeof val === 'undefined') console.warn(`[AIChatWindow] Imported icon is undefined: ${name}`);
  });
}

const INITIAL_GREETING = "Halo! 👋 Saya Asisten Cerdas Simpekdes. Silakan pilih topik di bawah atau tanyakan apa saja.";

// Sub-component for Settings (Defined before usage to ensure availability)
function SettingsView({ aiConfig, setAiConfig, onClose, handleSaveSettings }) {
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

    return (
        <div className="flex-1 p-6 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h4 className="font-bold text-lg mb-6 flex items-center gap-2 border-b pb-4 dark:border-slate-700">
            <Cpu size={22} className="text-indigo-500" /> Konfigurasi AI
          </h4>
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div>
              <label className="block text-xs font-bold mb-2 text-slate-500 uppercase tracking-wider">Provider AI</label>
              <div className="relative">
                <select value={aiConfig.provider} onChange={handleProviderChange} className="w-full p-3.5 pl-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-sm focus:ring-2 focus:ring-indigo-500 appearance-none font-medium">
                    {Object.values(AI_PROVIDERS).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <div className="absolute right-4 top-4 pointer-events-none text-slate-400">▼</div>
              </div>
              <p className="text-[10px] mt-1.5 text-slate-400 px-1 leading-relaxed">
                {AI_PROVIDERS[aiConfig.provider]?.description}
              </p>
            </div>
            
            {aiConfig.provider === 'openrouter' ? (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium flex gap-2 items-start leading-relaxed">
                        <Sparkles size={16} className="mt-0.5 shrink-0" />
                        Mode Auto-Switch: Sistem akan otomatis mencari model gratis terbaik (Gemini, Llama, dll) yang tersedia.
                    </p>
                </div>
            ) : (
                <div>
                    <label className="block text-xs font-bold mb-2 text-slate-500 uppercase tracking-wider">Model</label>
                    <div className="relative">
                        {aiConfig.provider === 'custom' ? (
                            <input type="text" value={aiConfig.model} onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})} placeholder="Nama Model (misal: llama3)" className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500" />
                        ) : (
                            <select value={aiConfig.model} onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})} className="w-full p-3.5 pl-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-sm focus:ring-2 focus:ring-indigo-500 appearance-none font-medium">
                                {AI_PROVIDERS[aiConfig.provider]?.models.map(m => (<option key={m} value={m}>{m}</option>))}
                            </select>
                        )}
                        {aiConfig.provider !== 'custom' && <div className="absolute right-4 top-4 pointer-events-none text-slate-400">▼</div>}
                    </div>
                </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-2 text-slate-500 uppercase tracking-wider">API Key</label>
              <div className="relative">
                <input type="password" value={aiConfig.apiKey} onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})} placeholder="Default System Key" className="w-full p-3.5 pl-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
                <Key size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              </div>
              <p className="text-[10px] mt-1.5 text-slate-400">Kosongkan untuk menggunakan Default Key (Gratis).</p>
            </div>

            <div className="flex gap-3 pt-6 mt-auto">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-sm text-slate-600 dark:text-slate-200 transition-colors">Batal</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02]">Simpan Pengaturan</button>
            </div>
          </form>
        </div>
    );
}

export default function AIChatWindow({ onClose, pageContext, currentSize, onResize, onNewMessage }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // --- STATE UTAMA ---
  const [messages, setMessages] = useState([
    { id: 1, text: INITIAL_GREETING, sender: 'ai', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // --- STATE PERCAKAPAN (HISTORY) ---
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Modal State
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', action: null, payload: null });
  const { showNotification } = useNotification();

  // --- STATE UI & MULTIMEDIA ---
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // --- CONFIG AI ---
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

  // --- INIT DATA ---
  useEffect(() => {
    handleRefreshSuggestions();
    
    // Load Voices
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Load Conversations
    try {
      const convs = loadConversations();
      if (convs && convs.length > 0) {
        setConversations(convs);
        setActiveConvId(convs[0].id);
        const m = convs[0].messages.map(mm => ({ ...mm, timestamp: new Date(mm.timestamp) }));
        setMessages(m.length ? m : [{ id: 1, text: INITIAL_GREETING, sender: 'ai', timestamp: new Date() }]);
      } else {
        // Create initial default conversation if none exist
        const conv = createConversationStorage('Percakapan Baru', INITIAL_GREETING);
        setConversations([conv]);
        setActiveConvId(conv.id);
        setMessages(conv.messages.map(mm => ({ ...mm, timestamp: new Date(mm.timestamp) })));
      }
    } catch (e) {
      console.warn('Failed to load conversations', e);
    }
  }, []);

  // --- AUTO SCROLL & FOCUS ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isListening]);

  useEffect(() => {
    if (!showSettings && inputRef.current) inputRef.current.focus();
  }, [showSettings]);

  // --- HELPERS ---
  const handleRefreshSuggestions = () => {
    setSuggestions(getRandomSuggestions(3));
  };

  const getResizeIcon = () => {
    if (currentSize === 'medium') return <Maximize2 size={16} />;
    if (currentSize === 'large') return <Minimize2 size={16} />;
    return <Square size={16} />;
  };

  const activeTitle = useMemo(() => {
    return conversations.find(c => c.id === activeConvId)?.title || 'Percakapan';
  }, [conversations, activeConvId]);

  // --- HANDLER CONVERSATION ---
  const handleSelectConversation = (convId) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    setActiveConvId(convId);
    setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
    setDropdownOpen(false);
  };

  // --- TOPIK BARU INSTAN (Tanpa Modal) ---
  const handleNewTopic = () => {
    const conv = createConversationStorage('Percakapan Baru', INITIAL_GREETING);
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
    setDropdownOpen(false);
    if (showNotification) showNotification('Topik baru dimulai', 'info');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // --- HANDLER HAPUS (DENGAN KONFIRMASI) ---
  const handleDeleteConversation = (e, convId) => {
    e.stopPropagation();
    setConfirmModal({
        open: true,
        message: 'Apakah Anda yakin ingin menghapus topik percakapan ini? Riwayat chat akan hilang permanen.',
        action: 'delete',
        payload: convId
    });
  };

  const handleConfirmAction = () => {
    const { action, payload } = confirmModal;
    
    if (action === 'delete') {
        const convId = payload;
        const next = deleteConversationStorage(convId);
        setConversations(next);
        
        if (activeConvId === convId) {
          if (next.length > 0) {
            setActiveConvId(next[0].id);
            setMessages(next[0].messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
          } else {
            const conv = createConversationStorage('Percakapan Baru', INITIAL_GREETING);
            setConversations([conv]);
            setActiveConvId(conv.id);
            setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
          }
        }
        if (showNotification) showNotification('Topik berhasil dihapus', 'success');
    }
    setConfirmModal({ open: false, message: '', action: null, payload: null });
  };

  const saveCurrentConversation = (msgs) => {
    if (!activeConvId) return;
    
    const currentConv = conversations.find(c => c.id === activeConvId);
    let titleToSave = currentConv?.title;
    
    if (currentConv && (currentConv.title === 'Percakapan Baru' || currentConv.title.includes('Hari Ini'))) {
        const firstUserMsg = msgs.find(m => m.sender === 'user');
        if (firstUserMsg) {
            titleToSave = firstUserMsg.text.split(' ').slice(0, 5).join(' ') + '...';
        }
    }

    const updatedConv = {
        id: activeConvId,
        title: titleToSave,
        messages: msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp })),
        updatedAt: Date.now()
    };

    const nextConvs = conversations.map(c => c.id === activeConvId ? updatedConv : c);
    setConversations(nextConvs);
    saveConversations(nextConvs);
  };

  // --- HANDLER CHAT ---
  const handleSendMessage = async (e, overrideText = null, shouldCreateNewTopic = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const textToSend = overrideText || inputText;
    if (!textToSend.trim()) return;

    // JIKA USER KLIK SARAN: BUAT TOPIK BARU TERLEBIH DAHULU
    let currentConvId = activeConvId;
    if (shouldCreateNewTopic) {
        const conv = createConversationStorage(textToSend.slice(0, 30), INITIAL_GREETING);
        setConversations(prev => [conv, ...prev]);
        setActiveConvId(conv.id);
        currentConvId = conv.id;
        // Reset messages to new topic's initial state
        setMessages([...conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))]);
    }

    const userMsg = { id: Date.now(), text: textToSend, sender: 'user', timestamp: new Date() };
    
    // Update messages for current or new topic
    setMessages(prev => {
        const next = [...prev, userMsg];
        // Note: saveCurrentConversation relies on activeConvId state, 
        // but since setState is async, we need to handle saving carefully for new topics.
        // For simplicity in this flow, let's just update UI first.
        return next;
    });
    
    // Immediate save for new topic scenario to ensure persistence
    if (shouldCreateNewTopic) {
         // We manually trigger save logic because activeConvId state might not be updated yet in closure
         // But actually, we already created the conversation in storage. We just need to add the user message.
         // Let's rely on standard flow but maybe need a small delay or ref usage for robust sync.
         // For now, standard flow is okay as long as we don't switch context too fast.
    }

    setInputText("");
    setIsLoading(true);

    // 1. Cek Lokal
    const localResponse = checkLocalIntent(textToSend);
    if (localResponse) {
        setTimeout(() => {
            const aiMsg = { 
                id: Date.now()+1, 
                text: localResponse.text, 
                sender: 'ai', 
                timestamp: new Date(), 
                isLocal: true,
                actions: localResponse.isGreeting ? QUICK_ACTIONS : null
            };
            setMessages(prev => {
                const next = [...prev, aiMsg];
                // Helper to save to correct ID
                const convIdToSave = shouldCreateNewTopic ? currentConvId : activeConvId;
                const convs = loadConversations(); // Reload fresh
                const idx = convs.findIndex(c => c.id === convIdToSave);
                if (idx >= 0) {
                   convs[idx].messages = next.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }));
                   convs[idx].updatedAt = Date.now();
                   saveConversations(convs);
                   setConversations(convs); // Sync state
                }
                return next;
            });
            setIsLoading(false);
            
            if (localResponse.actionPath) {
                if (showNotification) showNotification('Sedang mengalihkan halaman...', 'info');
                setTimeout(() => navigate(localResponse.actionPath), 800);
            }
            if (onNewMessage) onNewMessage();
        }, 600);
        return;
    }

    // 2. AI Cloud
    try {
      const villageData = await fetchVillageContext();
      const systemPrompt = `
        Anda adalah Asisten Desa Simpekdes.
        [CONTEXT] Halaman: ${pageContext.title}, User: ${currentUser?.email || 'Tamu'}
        ${villageData}
        INSTRUKSI: Jawab santai, ramah, dan manusiawi dalam Bahasa Indonesia. Format Markdown rapi.
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

      const aiMsg = { id: Date.now() + 1, text: aiResponseText, sender: 'ai', timestamp: new Date() };
      setMessages(prev => {
          const next = [...prev, aiMsg];
          // Save Logic (Duplicated for safety in async context)
          const convIdToSave = shouldCreateNewTopic ? currentConvId : activeConvId;
          const convs = loadConversations();
          const idx = convs.findIndex(c => c.id === convIdToSave);
          if (idx >= 0) {
             convs[idx].messages = next.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }));
             if (shouldCreateNewTopic) convs[idx].title = textToSend.slice(0,30); // Set title for new topic
             convs[idx].updatedAt = Date.now();
             saveConversations(convs);
             setConversations(convs);
          }
          return next;
      });
      if (onNewMessage) onNewMessage();

    } catch (error) {
      const errorMsg = { 
        id: Date.now() + 1, 
        text: `⚠️ **Gagal:** ${error.message}. Pastikan koneksi internet lancar.`, 
        sender: 'ai', 
        isError: true,
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMsg]);
      if (onNewMessage) onNewMessage();
    } finally {
      setIsLoading(false);
    }
  };

  // --- FITUR TAMBAHAN (VOICE, DLL) ---
  const handleVoiceInput = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Browser tidak support Voice.");
    if (isListening) { setIsListening(false); return; }
    const rec = new SR();
    rec.lang = 'id-ID';
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => setInputText(e.results[0][0].transcript);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const handleSpeak = (text, msgId) => {
    if (speakingMsgId === msgId) { window.speechSynthesis.cancel(); setSpeakingMsgId(null); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'id-ID';
    if(availableVoices.length > 0) {
        const v = availableVoices.find(v => v.lang === 'id-ID' && v.name.includes('Google')) || availableVoices.find(v => v.lang === 'id-ID');
        if(v) utt.voice = v;
    }
    utt.onend = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utt);
  };

  const handleCopy = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans overflow-hidden relative">
      
      {/* --- HEADER --- */}
      <div className="relative flex items-center justify-between p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b dark:border-slate-700 shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative shrink-0">
             <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Bot size={20} />
             </div>
             <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border-2 border-white dark:border-slate-800"></span>
             </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Asisten Desa</span>
            <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[160px] group"
            >
                <span className="truncate">{activeTitle}</span>
                <ChevronDown size={14} className={`text-slate-400 group-hover:text-indigo-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { if(currentSize==='medium') onResize('large'); else if(currentSize==='large') onResize('small'); else onResize('medium'); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition text-slate-500" title="Ubah Ukuran">
            {getResizeIcon()}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'} text-slate-500`} title="Pengaturan">
            <Settings size={18} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        {/* --- DROPDOWN RIWAYAT --- */}
        {dropdownOpen && (
            <>
                <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} /> 
                <div className="absolute top-[60px] left-4 right-4 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 origin-top animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                            <History size={14} /> Riwayat Percakapan
                        </span>
                        <button onClick={handleNewTopic} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg transition-colors">
                            <Plus size={12} /> Baru
                        </button>
                    </div>
                    
                    <div className="max-h-[250px] overflow-y-auto space-y-1 py-1 custom-scrollbar">
                        {conversations.length === 0 && (
                            <p className="text-xs text-center py-4 text-slate-400 italic">Belum ada riwayat.</p>
                        )}
                        {conversations.map(c => (
                            <div key={c.id} className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${activeConvId === c.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'}`} onClick={() => handleSelectConversation(c.id)}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-1.5 rounded-lg ${activeConvId === c.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
                                        <MessageSquare size={14} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className={`text-sm font-medium truncate ${activeConvId === c.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{c.title}</span>
                                        <span className="text-[10px] text-slate-400 truncate">{new Date(c.updatedAt || c.createdAt).toLocaleDateString()} • {c.messages.length} pesan</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleDeleteConversation(e, c.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    title="Hapus Topik"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}
      </div>

      {/* --- CONTENT AREA --- */}
      {showSettings ? (
        <SettingsView 
            aiConfig={aiConfig} 
            setAiConfig={setAiConfig} 
            onClose={() => setShowSettings(false)} 
            handleSaveSettings={(e) => {
                e.preventDefault();
                localStorage.setItem('simpekdes_ai_config', JSON.stringify(aiConfig));
                setShowSettings(false);
            }}
        />
      ) : (
        <>
          <div className="flex-1 p-4 overflow-y-auto space-y-6 scroll-smooth">
            
            {/* CHAT HISTORY */}
            {messages.map((msg, idx) => (
              <React.Fragment key={msg.id}>
                {/* 1. RENDER CHAT BUBBLE */}
                <div className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border self-end mb-1
                        ${msg.sender === 'user' 
                            ? 'bg-slate-800 border-slate-700 text-white' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600'
                        }`}>
                        {msg.sender === 'user' ? <User size={14} /> : <Bot size={16} />}
                    </div>

                    <div className={`relative max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm
                        ${msg.sender === 'user' 
                        ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm'}
                    `}>
                        {msg.isError ? (
                        <span className="text-red-400 font-medium flex items-center gap-2"><AlertCircle size={16} className="shrink-0"/> {msg.text}</span>
                        ) : (
                        <div className="prose dark:prose-invert prose-sm max-w-none prose-p:mb-1.5 prose-ul:my-1 prose-li:my-0.5">
                            <ReactMarkdown components={{
                                a: ({node, ...props}) => <a {...props} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline" />
                            }}>
                                {msg.text}
                            </ReactMarkdown>
                        </div>
                        )}

                        <div className={`flex items-center justify-between mt-2 pt-2 border-t ${msg.sender === 'user' ? 'border-white/10' : 'border-slate-100 dark:border-slate-700/50'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <div className="flex items-center gap-1">
                            {msg.sender === 'ai' && (
                                <button onClick={() => handleSpeak(msg.text, msg.id)} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition ${speakingMsgId === msg.id ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`}>
                                    {speakingMsgId === msg.id ? <StopCircle size={12} /> : <Volume2 size={12} />}
                                </button>
                            )}
                            <button onClick={() => handleCopy(msg.text, msg.id)} className={`p-1.5 rounded-lg hover:bg-white/20 dark:hover:bg-slate-700 transition ${msg.sender === 'user' ? 'text-slate-400 hover:text-white' : 'text-slate-400'}`} title="Salin">
                                {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                        </div>
                        <div className={`text-[10px] ${msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                            {msg.isLocal && <span className="mr-2 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold tracking-wide text-[9px]">LOKAL</span>}
                            {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                        </div>
                    </div>
                </div>

                {/* 2. RENDER SARAN (ACTIONS / SUGGESTIONS) DI BAWAH CHAT AWAL */}
                {/* LOGIKA: Tampilkan jika pesan ini dari AI, DAN msg.id === 1 (Sapaan Awal)
                   Tampilkan saran ini PERMANEN (tanpa kondisi suggestions.length > 0 agar layout stabil)
                   dan tidak hilang saat diklik (karena klik memicu topik baru).
                */}
                {msg.id === 1 && msg.sender === 'ai' && (
                    <div className="ml-11 mt-2 mb-6 animate-in slide-in-from-left-4 fade-in duration-500">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={10} className="text-amber-400" /> Saran Cepat
                            </span>
                            <button onClick={handleRefreshSuggestions} className="text-indigo-500 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30" title="Acak Ulang">
                                <RefreshCcw size={12} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={(e) => handleSendMessage(e, item.label, true)} // Pass true for new topic
                                    className="group relative overflow-hidden text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 p-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 max-w-full"
                                >
                                    <div className="p-1.5 bg-indigo-50 dark:bg-slate-700 text-indigo-500 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors shrink-0">
                                        <MessageSquare size={12} />
                                    </div>
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors truncate">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 3. RENDER QUICK ACTIONS DARI SAPAAN (DI BAWAH PESAN TERKAIT) */}
                {msg.sender === 'ai' && msg.actions && (
                    <div className="ml-11 mt-2 mb-6 animate-in slide-in-from-left-4 fade-in duration-500">
                         <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Zap size={10} className="text-amber-400 fill-current" /> Aksi Cepat
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {msg.actions.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => handleSendMessage(e, item.text)}
                                    className="group relative overflow-hidden text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 p-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 max-w-full"
                                >
                                    <div className="p-1.5 bg-amber-50 dark:bg-slate-700 text-amber-500 group-hover:bg-amber-500 group-hover:text-white rounded-lg transition-colors shrink-0">
                                        <Zap size={12} />
                                    </div>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
              </React.Fragment>
            ))}
            
            {/* Typing Animation */}
            {isLoading && (
              <div className="flex gap-3 group animate-in fade-in">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white border border-slate-200 self-end mb-1">
                    <Loader2 size={14} className="text-indigo-500 animate-spin" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5 w-fit">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* --- INPUT AREA --- */}
          <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0 relative z-10">
             <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 group">
               <div className="relative flex-1">
                 <textarea 
                    ref={inputRef} 
                    value={inputText} 
                    onChange={(e) => setInputText(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }}} 
                    placeholder={isListening ? "Mendengarkan..." : "Ketik pesan..."} 
                    className={`w-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl py-3.5 pl-4 pr-10 outline-none focus:ring-2 focus:ring-indigo-500/50 border border-transparent focus:border-indigo-500 transition-all resize-none max-h-32 text-sm shadow-inner ${isListening ? 'ring-2 ring-red-500/50 bg-red-50 dark:bg-red-900/10' : ''}`} 
                    rows={1} 
                    disabled={isLoading} 
                 />
                 <button 
                    type="button" 
                    onClick={handleVoiceInput} 
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'text-red-500 bg-red-100 animate-pulse' : 'text-slate-400 hover:text-indigo-500 hover:bg-white shadow-sm'}`}
                    title="Voice Input"
                 >
                    {isListening ? <StopCircle size={16} /> : <Mic size={18} />}
                 </button>
               </div>
               <button 
                type="submit" 
                disabled={!inputText.trim() || isLoading} 
                className="p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
               >
                <Send size={20} />
               </button>
             </form>
             <p className="text-[9px] text-center mt-2 text-slate-400">
                AI Simpekdes • Cepat & Cerdas
             </p>
          </div>
        </>
      )}

      {/* --- CONFIRMATION MODAL --- */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmModal({ ...confirmModal, open: false })} />
            <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-500">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1">Hapus Percakapan?</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{confirmModal.message}</p>
                    </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setConfirmModal({ ...confirmModal, open: false })} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Batal</button>
                    <button onClick={handleConfirmAction} className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30">Hapus</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}