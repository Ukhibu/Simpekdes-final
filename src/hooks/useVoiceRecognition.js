import { useState, useEffect, useRef } from 'react';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Browser tidak mendukung fitur suara.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'id-ID'; // Bahasa Indonesia

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setError('Gagal mengenali suara.');
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    setError(null);
    setTranscript('');
    try {
        recognitionRef.current?.start();
    } catch (e) {
        // Handle jika sudah started
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  return { isListening, transcript, startListening, stopListening, error, setTranscript };
};