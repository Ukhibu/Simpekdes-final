/**
 * KONFIGURASI PROVIDER & MODEL AI
 * Daftar model ini disesuaikan dengan paket Free Tier terbaru (2025).
 */

export const AI_PROVIDERS = {
    openrouter: {
      id: 'openrouter',
      name: "OpenRouter (Auto-Switch Free)",
      baseUrl: "https://openrouter.ai/api/v1",
      description: "Otomatis mencari model gratis terbaik yang tersedia (Gemini, Llama, Mistral, dll).",
      // Daftar prioritas model gratis untuk Auto-Switching
      models: [
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-pro-exp-02-05:free", // Estimasi nama slug Gemini 2.5 Pro/Flash
        "meta-llama/llama-3.2-11b-vision-instruct:free",
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen-2.5-coder-32b-instruct:free", // Qwen3 Coder equivalent
        "thudm/glm-4-9b-chat:free", // GLM 4.5 Air equivalent
        "deepseek/deepseek-r1:free", // DeepSeek-R1T equivalent
        "nousresearch/hermes-3-llama-3.1-405b:free", // Pengganti Venice/Uncensored yang kuat
        "allenai/olmo-7b-instruct:free", // Olmo
        "google/gemma-2-9b-it:free",
        "microsoft/phi-3-mini-128k-instruct:free",
        "huggingfaceh4/zephyr-7b-beta:free"
      ]
    },
    google: {
      id: 'google',
      name: "Google AI Studio",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      description: "Langsung ke server Google (Gemini). Cepat & Stabil.",
      models: [
        "gemini-2.0-flash-exp", // Gemini 2.5 Flash
        "gemini-1.5-pro",       // Gemini 2.5 Pro equivalent current stable
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b"   // Gemini 2.5 Flash-Lite
      ]
    },
    groq: {
      id: 'groq',
      name: "Groq (Ultra Fast)",
      baseUrl: "https://api.groq.com/openai/v1",
      description: "Inferensi tercepat di dunia (Llama, Mixtral).",
      models: [
        "llama3-8b-8192",
        "llama3-70b-8192",
        "mixtral-8x7b-32768",
        "gemma-7b-it"
      ]
    },
    mistral: {
      id: 'mistral',
      name: "Mistral AI",
      baseUrl: "https://api.mistral.ai/v1",
      description: "Model open-weight terbaik dari Prancis.",
      models: ["mistral-tiny", "mistral-small-latest", "codestral-latest"]
    },
    cerebras: {
      id: 'cerebras',
      name: "Cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      description: "Chip WSE-3 untuk kecepatan ekstrem.",
      models: ["llama3.1-8b", "llama3.1-70b"]
    },
    github: {
      id: 'github',
      name: "GitHub Models",
      baseUrl: "https://models.inference.ai.azure.com",
      description: "Koleksi model via Azure AI.",
      models: ["gpt-4o", "gpt-4o-mini", "Phi-3.5-mini-instruct"]
    },
    custom: {
      id: 'custom',
      name: "Custom / Local (Ollama)",
      baseUrl: "http://localhost:11434/v1",
      description: "Gunakan server sendiri atau provider lain.",
      models: [] // Diisi manual oleh user
    }
  };
  
  export const DEFAULT_CONFIG = {
    provider: 'openrouter',
    model: AI_PROVIDERS.openrouter.models[0],
    apiKey: '',
    baseUrl: AI_PROVIDERS.openrouter.baseUrl
  };