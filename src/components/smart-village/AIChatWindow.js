import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { 
  Send, X, User, Bot, Settings, MapPin, AlertCircle, Trash2, Cpu, Mic, Volume2, Copy, Check, StopCircle,
  Minimize2, Maximize2, Square, Sparkles, Key, RefreshCcw, MessageSquare, Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { fetchVillageContext, callAIModel } from '../../services/aiService';
import { AI_PROVIDERS, DEFAULT_CONFIG } from '../../services/aiModels';
import { checkLocalIntent } from '../../services/localIntentService';
import { getRandomSuggestions } from '../../services/localKnowledgeBase'; // Import Helper Baru
import { loadConversations, saveConversations, createConversation as createConversationStorage, deleteConversation as deleteConversationStorage } from '../../services/chatStorage';

// Sanity-check imported icons at runtime to help detect undefined exports
const _importedIcons = {
  Send, X, User, Bot, Settings, MapPin, AlertCircle, Trash2, Cpu, Mic, Volume2, Copy, Check, StopCircle,
  Minimize2, Maximize2, Square, Sparkles, Key, RefreshCcw, MessageSquare
};
if (typeof window !== 'undefined') {
  Object.entries(_importedIcons).forEach(([name, val]) => {
    if (typeof val === 'undefined') console.warn(`[AIChatWindow] Imported icon is undefined: ${name}`);
  });
}

const INITIAL_GREETING = "Halo! 👋 Saya Asisten Cerdas Simpekdes. Silakan pilih topik di bawah atau tanyakan apa saja.";

export default function AIChatWindow({ onClose, pageContext, currentSize, onResize, onNewMessage }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // State Pesan
  const [messages, setMessages] = useState([
    { id: 1, text: INITIAL_GREETING, sender: 'ai', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // State Suggestions
  const [suggestions, setSuggestions] = useState([]);
  // Conversations (persisted)
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownButtonRef = useRef(null);
  const dropdownPaneRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState(null); // { left, top }
  const [generatingTitles, setGeneratingTitles] = useState({}); // { [convId]: true }
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const { showNotification } = useNotification();

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

  // Init: Load Suggestions & Voices
  useEffect(() => {
    handleRefreshSuggestions(); // Load 3 pertanyaan awal
    
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    // Load saved conversations or create default
    try {
      const convs = loadConversations();
      if (convs && convs.length > 0) {
        setConversations(convs);
        setActiveConvId(convs[0].id);
        // set messages to first conv
        const m = convs[0].messages.map(mm => ({ ...mm, timestamp: new Date(mm.timestamp) }));
        setMessages(m.length ? m : [{ id: 1, text: INITIAL_GREETING, sender: 'ai', timestamp: new Date() }]);
      } else {
        const conv = createConversationStorage('Hari Ini', INITIAL_GREETING);
        setConversations([conv]);
        setActiveConvId(conv.id);
        setMessages(conv.messages.map(mm => ({ ...mm, timestamp: new Date(mm.timestamp) })));
      }
    } catch (e) {
      console.warn('Failed to load conversations', e);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      const btn = dropdownButtonRef.current;
      const pane = dropdownPaneRef.current;
      if (dropdownOpen) {
        if (btn && btn.contains(e.target)) return;
        if (pane && pane.contains(e.target)) return;
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [dropdownOpen]);

  // compute fixed dropdown position when opened (so it stays above overlays)
  useEffect(() => {
    if (!dropdownOpen) return;
    const compute = () => {
      const btn = dropdownButtonRef.current;
      if (!btn) return setDropdownPos(null);
      const r = btn.getBoundingClientRect();
      setDropdownPos({ left: r.left + r.width / 2, top: r.top + r.height + 8 });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute, true); };
  }, [dropdownOpen]);

  

  // Fungsi Refresh Suggestions
  const handleRefreshSuggestions = () => {
    setSuggestions(getRandomSuggestions(3));
  };

  // Efek: Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isListening]);

  // Efek: Focus Input
  useEffect(() => {
    if (!showSettings && inputRef.current) inputRef.current.focus();
  }, [showSettings]);

  // Handler Ganti Provider
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

  // Fitur Multimedia
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Browser tidak support Voice."); return; }
    if (isListening) { setIsListening(false); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => setInputText(e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSpeak = (text, msgId) => {
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.0;
    
    if (availableVoices.length > 0) {
        const indoVoice = availableVoices.find(v => v.lang === 'id-ID' && v.name.includes('Google')) 
                       || availableVoices.find(v => v.lang === 'id-ID');
        if (indoVoice) utterance.voice = indoVoice;
    }

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
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
    setMessages(prev => {
      const next = [...prev, userMsg];
      saveCurrentConversation(next);
      return next;
    });
    setInputText("");
    setIsLoading(true);

    // 1. Cek Lokal
    const localResponse = checkLocalIntent(textToSend);
    if (localResponse) {
      setTimeout(() => {
        setMessages(prev => {
          const next = [...prev, { id: Date.now()+1, text: localResponse.text, sender: 'ai', timestamp: new Date(), isLocal: true }];
          saveCurrentConversation(next);
          return next;
        });
        setIsLoading(false);
        if (localResponse.actionPath) setTimeout(() => navigate(localResponse.actionPath), 800);
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
        INSTRUKSI: Jawab santai dalam Bahasa Indonesia. Jangan kaku.
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

      setMessages(prev => {
        const next = [...prev, { id: Date.now() + 1, text: aiResponseText, sender: 'ai', timestamp: new Date() }];
        saveCurrentConversation(next);
        return next;
      });
      if (onNewMessage) onNewMessage();

    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        text: `⚠️ **Gagal:** ${error.message}. Cek pengaturan API Key.`, 
        sender: 'ai', 
        isError: true,
        timestamp: new Date() 
      }]);
      if (onNewMessage) onNewMessage();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('simpekdes_ai_config', JSON.stringify(aiConfig));
    setShowSettings(false);
    setMessages(prev => [...prev, { id: Date.now(), text: `✅ **Pengaturan Disimpan!** Provider: ${AI_PROVIDERS[aiConfig.provider].name}`, sender: 'ai', timestamp: new Date() }]);
  };

  // Persist current messages to the active conversation in storage
  const saveCurrentConversation = (msgs) => {
    if (!activeConvId) return;
    const convs = conversations.slice();
    const idx = convs.findIndex(c => c.id === activeConvId);
    const serialized = msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }));
    if (idx >= 0) {
      // Update title automatically if still default
      let title = convs[idx].title;
      const isDefaultTitle = !title || title.toLowerCase().startsWith('topik') || title.toLowerCase().includes('hari');
      if (isDefaultTitle) {
        // pick first user message as title if available and ask AI to summarize to nicer title
        const firstUser = msgs.find(m => m.sender === 'user');
        if (firstUser && firstUser.text) {
          // use a short truncation as temporary title, then request AI summary
          title = firstUser.text.slice(0, 40) + (firstUser.text.length > 40 ? '...' : '');
          // async request to generate nicer title
          (async () => {
            try {
              // mark generating state for UI spinner
              setGeneratingTitles(prev => ({ ...prev, [activeConvId]: true }));
              const aiTitle = await generateTitleFromAI(firstUser.text);
              if (aiTitle && aiTitle.trim().length > 0) {
                const convs2 = loadConversations();
                const i2 = convs2.findIndex(c => c.id === activeConvId);
                if (i2 >= 0) {
                  convs2[i2] = { ...convs2[i2], title: aiTitle, updatedAt: Date.now() };
                  setConversations(convs2);
                  saveConversations(convs2);
                  showNotification && showNotification('Judul topik diperbarui', 'success');
                }
              }
            } catch (e) {
              console.warn('AI title generation failed', e);
            } finally {
              setGeneratingTitles(prev => {
                const copy = { ...prev };
                delete copy[activeConvId];
                return copy;
              });
            }
          })();
        }
      }
      convs[idx] = { ...convs[idx], title, messages: serialized, updatedAt: Date.now() };
    } else {
      convs.unshift({ id: activeConvId, title: 'Topik', messages: serialized, createdAt: Date.now(), updatedAt: Date.now() });
    }
    setConversations(convs);
    saveConversations(convs);
  };

  // Generate a short title using the AI model (fallback to truncated text)
  const generateTitleFromAI = async (text) => {
    if (!text) return '';
    try {
      const systemPrompt = `Anda adalah asisten ringkasan dalam Bahasa Indonesia. Buat judul singkat (maksimal 6 kata) yang menjelaskan inti pertanyaan pengguna. Hanya kembalikan judul tanpa penjelasan.`;
      const messagesForAI = [{ role: 'user', content: text }];
      const res = await callAIModel(messagesForAI, aiConfig, systemPrompt);
      if (!res) return text.slice(0, 40) + (text.length > 40 ? '...' : '');
      const title = res.split('\n')[0].replace(/^["'`\s]+|["'`\s]+$/g, '');
      return title.length ? title : (text.slice(0, 40) + (text.length > 40 ? '...' : ''));
    } catch (e) {
      return text.slice(0, 40) + (text.length > 40 ? '...' : '');
    }
  };

  const handleNewTopic = () => {
    setNewTopicTitle('');
    setShowNewTopicModal(true);
  };

  const handleSelectConversation = (convId) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    setActiveConvId(convId);
    setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
  };

  // Confirmation modal state for destructive actions
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', action: null, payload: null });

  const handleDeleteConversation = (convId) => {
    setConfirmModal({ open: true, message: 'Hapus topik ini? Aksi tidak bisa dibatalkan.', action: 'delete', payload: convId });
  };

  const handleConfirm = (confirmed) => {
    const { action, payload } = confirmModal;
    setConfirmModal({ open: false, message: '', action: null, payload: null });
    if (!confirmed) return;
    if (action === 'delete') {
      const convId = payload;
      const next = deleteConversationStorage(convId);
      setConversations(next);
      showNotification && showNotification('Topik dihapus', 'success');
      if (activeConvId === convId) {
        if (next.length > 0) {
          setActiveConvId(next[0].id);
          setMessages(next[0].messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
        } else {
          const conv = createConversationStorage('Hari Ini', INITIAL_GREETING);
          setConversations([conv]);
          setActiveConvId(conv.id);
          setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* HEADER */}
      <div className="relative flex items-center justify-between p-3 sm:p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b dark:border-slate-700 shadow-sm shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative">
             <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Bot size={22} />
             </div>
             <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-green-500 border-2 border-white dark:border-slate-800"></span>
             </span>
          </div>
          {/* Dropdown trigger placed under header (compact) */}
          <div className="absolute left-1/2 -bottom-5 transform -translate-x-1/2">
            <div className="relative">
              <button ref={dropdownButtonRef} onClick={() => setDropdownOpen(o => !o)} className="px-3 py-1 rounded-full bg-slate-900/70 dark:bg-slate-800 text-white text-xs flex items-center gap-2 shadow">
                <span className="max-w-[120px] truncate">{(conversations.find(c => c.id === activeConvId) || {}).title || 'Topik'}</span>
                <span className="text-[10px] text-slate-300">▾</span>
              </button>
              {dropdownOpen && (
                <div ref={dropdownPaneRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white/30 dark:bg-slate-900/40 border border-slate-700/20 rounded-lg shadow-lg z-60 p-2">
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {conversations.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/10 dark:hover:bg-slate-800">
                        <button onClick={() => { handleSelectConversation(c.id); setDropdownOpen(false); }} className="flex items-center gap-2 text-sm truncate text-slate-100">
                          <MessageSquare size={14} className="text-indigo-300" />
                          <span className="truncate max-w-[180px]">{c.title}</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button title="Buka" onClick={() => { setDropdownOpen(false); handleSelectConversation(c.id); }} className="p-1 text-slate-300 hover:text-indigo-400 rounded"><MessageSquare size={14} /></button>
                          <button title="Hapus" onClick={() => handleDeleteConversation(c.id)} className="p-1 text-red-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between">
                    <button onClick={() => { handleNewTopic(); setDropdownOpen(false); showNotification && showNotification('Membuat topik baru', 'info'); }} className="p-1 text-emerald-300 hover:text-emerald-400 rounded"><Plus size={16} /></button>
                    {activeConvId && <button onClick={() => { handleDeleteConversation(activeConvId); setDropdownOpen(false); }} className="p-1 text-red-400 hover:text-red-500 rounded"><Trash2 size={16} /></button>}
                  </div>
                </div>
              )}
            </div>
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
            <div>
              <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">Pilih Provider AI</label>
              <select value={aiConfig.provider} onChange={handleProviderChange} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 outline-none text-sm focus:ring-2 focus:ring-indigo-500">
                  {Object.values(AI_PROVIDERS).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <p className="text-[10px] mt-1 text-slate-400 px-1">
                {AI_PROVIDERS[aiConfig.provider]?.description}
              </p>
            </div>
            
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
                    <input type="text" value={aiConfig.baseUrl} onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})} placeholder="http://localhost:11434/v1" className="w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono" />
                    <label className="block text-xs font-bold mb-1.5 ml-1 mt-3 text-slate-500">Model Name</label>
                    <input type="text" value={aiConfig.model} onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})} placeholder="llama3" className="w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
                </div>
            ) : (
                <div>
                    <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">Pilih Model</label>
                    <select value={aiConfig.model} onChange={(e) => setAiConfig({...aiConfig, model: e.target.value})} className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 outline-none text-sm">
                        {AI_PROVIDERS[aiConfig.provider]?.models.map(m => (<option key={m} value={m}>{m}</option>))}
                    </select>
                </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1.5 ml-1 text-slate-500">API Key</label>
              <input type="password" value={aiConfig.apiKey} onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})} placeholder="Default System Key" className="w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 outline-none text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
              <p className="text-[10px] mt-1 text-slate-400 flex items-center gap-1"><Key size={10} /> Kosongkan untuk menggunakan Default System Key (Gratis).</p>
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
          <div className="flex-1 p-4 overflow-y-auto space-y-6 relative">
            {dropdownOpen && (
              <div onClick={(e) => {
                  const target = e.target;
                  if (dropdownPaneRef.current && dropdownPaneRef.current.contains(target)) return;
                  if (dropdownButtonRef.current && dropdownButtonRef.current.contains(target)) return;
                  setDropdownOpen(false);
                }} className="absolute inset-0 bg-black/20 backdrop-blur-sm z-20 rounded-lg" />
            )}

            
            {/* New Topic Modal */}
            {showNewTopicModal && (
              <div className="fixed inset-0 z-[100000] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowNewTopicModal(false)} />
                <div className="relative w-[92%] max-w-md bg-white dark:bg-slate-800 rounded-lg p-4 shadow-lg">
                  <h4 className="font-bold mb-2">Buat Topik Baru</h4>
                  <p className="text-sm text-slate-500 mb-3">Isi judul topik. Kosong = gunakan sapaan awal.</p>
                  <input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} placeholder="Judul topik" className="w-full p-2 rounded border dark:border-slate-700 bg-white dark:bg-slate-900 mb-3" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowNewTopicModal(false)} className="px-3 py-1 rounded bg-slate-100">Batal</button>
                    <button onClick={() => {
                        const title = newTopicTitle.trim() || 'Topik Baru';
                        const conv = createConversationStorage(title, INITIAL_GREETING);
                        setConversations(prev => { const next = [conv, ...prev]; saveConversations(next); return next; });
                        setActiveConvId(conv.id);
                        setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
                        showNotification && showNotification('Topik dibuat', 'success');
                        setShowNewTopicModal(false);
                      }} className="px-3 py-1 rounded bg-emerald-500 text-white">Buat</button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Modal for destructive actions */}
            {confirmModal.open && (
              <div className="fixed inset-0 z-[100000] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal({ open: false, message: '', action: null, payload: null })} />
                <div className="relative w-[92%] max-w-md bg-white dark:bg-slate-800 rounded-lg p-4 shadow-lg">
                  <h4 className="font-bold mb-2">Konfirmasi</h4>
                  <p className="text-sm text-slate-500 mb-4">{confirmModal.message}</p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleConfirm(false)} className="px-3 py-1 rounded bg-slate-100">Batal</button>
                    <button onClick={() => handleConfirm(true)} className="px-3 py-1 rounded bg-red-500 text-white">Hapus</button>
                  </div>
                </div>
              </div>
            )}

            {/* (Moved) Suggestions will appear after the initial AI greeting */}

            {/* CHAT HISTORY */}
            {messages.map((msg, idx) => (
              <React.Fragment key={msg.id}>
                <div className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} group`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden shadow-md self-end mb-1 border ${msg.sender === 'user' ? 'bg-slate-700 border-slate-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400'}`}>
                    {msg.sender === 'user' ? <User size={14} className="text-white" /> : <Bot size={16} className="text-white" />}
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
                          <ReactMarkdown
                            components={{
                              a: ({node, ...props}) => (
                                <a {...props} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline" />
                              )
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
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
                {/* Render suggestions only immediately after the initial AI greeting (id === 1) */}
                {msg.id === 1 && msg.sender === 'ai' && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topik Terkait</span>
                      <button onClick={handleRefreshSuggestions} className="text-indigo-500 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30" title="Ganti Pertanyaan">
                        <RefreshCcw size={12} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          onClick={(e) => handleSendMessage(e, item.label)}
                          className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl transition-all duration-200 text-left shadow-sm flex items-center gap-1.5 group"
                        >
                          <MessageSquare size={12} className="text-indigo-400 group-hover:text-indigo-600" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
            
            {/* TYPING INDICATOR */}
            {isLoading && (
              <div className="flex gap-3 group">
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
             {messages.length > 2 && <button onClick={() => setMessages([{ id: 1, text: "Riwayat dibersihkan.", sender: 'ai', timestamp: new Date() }])} className="absolute -top-10 right-3 bg-slate-800/80 text-white text-[10px] px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg hover:bg-red-600/90 transition-opacity"><Trash2 size={10} /> Bersihkan</button>}
             
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