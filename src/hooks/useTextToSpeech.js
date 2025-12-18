import { useState, useEffect, useRef } from 'react';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const synth = useRef(window.speechSynthesis);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);
    }
  }, []);

  const speak = (text) => {
    if (!isSupported) return;

    // Hentikan suara sebelumnya jika ada
    if (synth.current.speaking) {
      synth.current.cancel();
    }

    // Bersihkan teks dari format Markdown (*, #, dll) agar dibaca bersih
    const cleanText = text.replace(/[*#_`]/g, '').replace(/\[.*?\]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'id-ID'; // Set Bahasa Indonesia
    utterance.rate = 1.0; // Kecepatan normal
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synth.current.speak(utterance);
  };

  const cancel = () => {
    if (!isSupported) return;
    synth.current.cancel();
    setIsSpeaking(false);
  };

  return { speak, cancel, isSpeaking, isSupported };
};