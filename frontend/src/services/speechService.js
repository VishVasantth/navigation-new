// Speech service for voice navigation
export const speakInstruction = (text) => {
  if (!text || !window.speechSynthesis) return;
  
  // Stop any current speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1;
  
  window.speechSynthesis.speak(utterance);
  
  return new Promise((resolve) => {
    utterance.onend = () => {
      resolve();
    };
  });
};

// Check if speech synthesis is available in the browser
export const isSpeechAvailable = () => {
  return 'speechSynthesis' in window;
};

// Get available voices
export const getVoices = () => {
  return window.speechSynthesis.getVoices();
};

// Save user preference for voice navigation
export const saveVoicePreference = (enabled) => {
  localStorage.setItem('voiceNavigationEnabled', JSON.stringify(enabled));
};

// Get user preference for voice navigation
export const getVoicePreference = () => {
  const preference = localStorage.getItem('voiceNavigationEnabled');
  return preference ? JSON.parse(preference) : true; // Default to enabled
}; 