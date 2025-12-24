const STORAGE_KEY = 'simpekdes_ai_conversations';

export const loadConversations = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load conversations', e);
    return [];
  }
};

export const saveConversations = (conversations) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.warn('Failed to save conversations', e);
  }
};

export const createConversation = (title = 'Topik Baru', initialMessage = null) => {
  const now = Date.now();
  const conv = {
    id: now,
    title: title || `Topik ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    messages: initialMessage ? [
      {
        id: 1,
        text: initialMessage,
        sender: 'ai',
        timestamp: new Date().toISOString()
      }
    ] : []
  };
  const convs = loadConversations();
  convs.unshift(conv);
  saveConversations(convs);
  return conv;
};

export const updateConversation = (conv) => {
  const convs = loadConversations();
  const updated = convs.map(c => c.id === conv.id ? { ...conv, updatedAt: Date.now() } : c);
  saveConversations(updated);
  return updated;
};

export const deleteConversation = (id) => {
  const convs = loadConversations();
  const updated = convs.filter(c => c.id !== id);
  saveConversations(updated);
  return updated;
};
