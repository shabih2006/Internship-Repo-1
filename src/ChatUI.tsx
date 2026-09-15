import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// --- Web Speech API Interfaces ---
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
    length: number;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface DocumentChunk {
  id: number;
  documentId: number;
  chunkIndex: number;
  content: string;
}

interface ExtractedTextBlock {
  id: string;
  text: string;
}

interface DocumentPreviewData {
  id: number;
  fileName: string;
  fileUrl: string;
  markdownUrl?: string;
  extractedBlocks: ExtractedTextBlock[];
  fullExtractedText?: string;
}

export interface ThemeColors {
  titleText?: string;
  titleFont?: string;
  bgApp: string;
  bgSidebar: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarTitle: string;
  activeSessionBg: string;
  activeSessionBorder: string;
  activeSessionText: string;
  newChatBtn: string;
  newChatBtnText: string;
  mainTitle: string;
  chatBoxBg: string;
  chatBoxBorder: string;
  userBubbleBg: string;
  userBubbleText: string;
  assistantBubbleBg: string;
  assistantBubbleText: string;
  voiceBtnBg: string;
  voiceBtnText: string;
  sendBtnBg: string;
  sendBtnText: string;
}

export interface PalettePreset {
  id: string;
  name: string;
  effect?: 'leaves' | 'snow' | 'rain' | 'flowers' | 'berry' | 'taylor';
  dark: ThemeColors;
  light: ThemeColors;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', name: '🇺🇸 English' },
  { code: 'ur-PK', name: '🇵🇰 Urdu (اردو)' },
  { code: 'es-ES', name: '🇪🇸 Spanish (Español)' },
  { code: 'fr-FR', name: '🇫🇷 French (Français)' },
  { code: 'de-DE', name: '🇩🇪 German (Deutsch)' },
  { code: 'zh-CN', name: '🇨🇳 Mandarin (中文)' },
  { code: 'ar-SA', name: '🇸🇦 Arabic (العربية)' },
];

const PALETTES: Record<string, PalettePreset> = {
  taylor: {
    id: 'taylor',
    name: '✨ Taylor Swift (Eras)',
    effect: 'taylor',
    dark: {
      titleText: "What's Up Swiftie",
      titleFont: "'Georgia', 'Palatino', serif",
      bgApp: '#080414',
      bgSidebar: '#100a21',
      sidebarBorder: '#3c5e42',
      sidebarText: '#e2d9cc',
      sidebarTitle: '#c084fc',
      activeSessionBg: '#1f1338',
      activeSessionBorder: '#3c5e42',
      activeSessionText: '#ffffff',
      newChatBtn: '#3c5e42',
      newChatBtnText: '#ffffff',
      mainTitle: '#e2d9cc',
      chatBoxBg: 'rgba(16, 10, 33, 0.88)',
      chatBoxBorder: '#3c5e42',
      userBubbleBg: '#4c1d95',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#130d24',
      assistantBubbleText: '#e2d9cc',
      voiceBtnBg: '#3c5e42',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#6b21a8',
      sendBtnText: '#ffffff',
    },
    light: {
      titleText: "What's Up Swiftie",
      titleFont: "'Georgia', 'Palatino', serif",
      bgApp: '#fce7f3',
      bgSidebar: '#fbcfe8',
      sidebarBorder: '#f472b6',
      sidebarText: '#991b1b',
      sidebarTitle: '#831843',
      activeSessionBg: '#e0f2fe',
      activeSessionBorder: '#0284c7',
      activeSessionText: '#0369a1',
      newChatBtn: '#dc2626',
      newChatBtnText: '#ffffff',
      mainTitle: '#991b1b',
      chatBoxBg: 'rgba(255, 255, 255, 0.85)',
      chatBoxBorder: '#f472b6',
      userBubbleBg: '#dc2626',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#f0f9ff',
      assistantBubbleText: '#0f172a',
      voiceBtnBg: '#eab308',
      voiceBtnText: '#422006',
      sendBtnBg: '#15803d',
      sendBtnText: '#ffffff',
    },
  },
  berry: {
    id: 'berry',
    name: '🍇 Bold Berry',
    effect: 'berry',
    dark: {
      titleText: '💖 Hello Girlypop 💖',
      titleFont: "'Comic Sans MS', 'Pacifico', 'Brush Script MT', cursive",
      bgApp: '#1f0a14',
      bgSidebar: '#331222',
      sidebarBorder: '#4a1b32',
      sidebarText: '#fcd3e1',
      sidebarTitle: '#f794b1',
      activeSessionBg: '#612143',
      activeSessionBorder: '#a0406d',
      activeSessionText: '#ffffff',
      newChatBtn: '#d9537f',
      newChatBtnText: '#ffffff',
      mainTitle: '#fde8f0',
      chatBoxBg: '#331222',
      chatBoxBorder: '#612143',
      userBubbleBg: '#a0406d',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#260d19',
      assistantBubbleText: '#fde8f0',
      voiceBtnBg: '#f794b1',
      voiceBtnText: '#1f0a14',
      sendBtnBg: '#d9537f',
      sendBtnText: '#ffffff',
    },
    light: {
      titleText: '💖 Hello Girlypop 💖',
      titleFont: "'Comic Sans MS', 'Pacifico', 'Brush Script MT', cursive",
      bgApp: '#fde8f0',
      bgSidebar: '#f8d0e0',
      sidebarBorder: '#f2b3cb',
      sidebarText: '#4d1430',
      sidebarTitle: '#61113a',
      activeSessionBg: '#e08ba9',
      activeSessionBorder: '#802050',
      activeSessionText: '#3b0621',
      newChatBtn: '#a0406d',
      newChatBtnText: '#ffffff',
      mainTitle: '#331222',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#ea9ab8',
      userBubbleBg: '#a0406d',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#fbf0f5',
      assistantBubbleText: '#331222',
      voiceBtnBg: '#a0406d',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#a0406d',
      sendBtnText: '#ffffff',
    },
  },
  spring: {
    id: 'spring',
    name: '🌸 Spring Bloom',
    effect: 'flowers',
    dark: {
      bgApp: '#1e141a',
      bgSidebar: '#2a1b24',
      sidebarBorder: '#4a2d3f',
      sidebarText: '#fce4ec',
      sidebarTitle: '#f48fb1',
      activeSessionBg: '#4a2d3f',
      activeSessionBorder: '#f48fb1',
      activeSessionText: '#ffffff',
      newChatBtn: '#ec407a',
      newChatBtnText: '#ffffff',
      mainTitle: '#f8bbd0',
      chatBoxBg: '#2a1b24',
      chatBoxBorder: '#f48fb1',
      userBubbleBg: '#d81b60',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#170e13',
      assistantBubbleText: '#fce4ec',
      voiceBtnBg: '#f48fb1',
      voiceBtnText: '#1e141a',
      sendBtnBg: '#ec407a',
      sendBtnText: '#ffffff',
    },
    light: {
      bgApp: '#fff0f5',
      bgSidebar: '#fbe4eb',
      sidebarBorder: '#f8bbd0',
      sidebarText: '#880e4f',
      sidebarTitle: '#ad1457',
      activeSessionBg: '#f8bbd0',
      activeSessionBorder: '#d81b60',
      activeSessionText: '#880e4f',
      newChatBtn: '#e91e63',
      newChatBtnText: '#ffffff',
      mainTitle: '#880e4f',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#f48fb1',
      userBubbleBg: '#e91e63',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#fff8fa',
      assistantBubbleText: '#880e4f',
      voiceBtnBg: '#e91e63',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#e91e63',
      sendBtnText: '#ffffff',
    },
  },
  summer: {
    id: 'summer',
    name: '☀️ Golden Summer',
    dark: {
      bgApp: '#1f1a0e',
      bgSidebar: '#2e2612',
      sidebarBorder: '#4d3d1a',
      sidebarText: '#fff3e0',
      sidebarTitle: '#ffe082',
      activeSessionBg: '#4d3d1a',
      activeSessionBorder: '#ffe082',
      activeSessionText: '#ffffff',
      newChatBtn: '#ffb300',
      newChatBtnText: '#1f1a0e',
      mainTitle: '#ffe082',
      chatBoxBg: '#2e2612',
      chatBoxBorder: '#ffe082',
      userBubbleBg: '#ff8f00',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#141108',
      assistantBubbleText: '#fff3e0',
      voiceBtnBg: '#ffe082',
      voiceBtnText: '#1f1a0e',
      sendBtnBg: '#ffb300',
      sendBtnText: '#1f1a0e',
    },
    light: {
      bgApp: '#fffde7',
      bgSidebar: '#fff9c4',
      sidebarBorder: '#fff59d',
      sidebarText: '#f57f17',
      sidebarTitle: '#f57f17',
      activeSessionBg: '#ffe082',
      activeSessionBorder: '#ffb300',
      activeSessionText: '#3e2723',
      newChatBtn: '#ff8f00',
      newChatBtnText: '#ffffff',
      mainTitle: '#e65100',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#ffe082',
      userBubbleBg: '#ff8f00',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#fffffa',
      assistantBubbleText: '#3e2723',
      voiceBtnBg: '#ff8f00',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#ff8f00',
      sendBtnText: '#ffffff',
    },
  },
  monsoon: {
    id: 'monsoon',
    name: '🌧️ Monsoon Rain',
    effect: 'rain',
    dark: {
      bgApp: '#0f171e',
      bgSidebar: '#17222d',
      sidebarBorder: '#233342',
      sidebarText: '#e0f2fe',
      sidebarTitle: '#7dd3fc',
      activeSessionBg: '#233342',
      activeSessionBorder: '#7dd3fc',
      activeSessionText: '#ffffff',
      newChatBtn: '#0284c7',
      newChatBtnText: '#ffffff',
      mainTitle: '#bae6fd',
      chatBoxBg: '#17222d',
      chatBoxBorder: '#38bdf8',
      userBubbleBg: '#0284c7',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#0a1015',
      assistantBubbleText: '#e0f2fe',
      voiceBtnBg: '#38bdf8',
      voiceBtnText: '#0f171e',
      sendBtnBg: '#0284c7',
      sendBtnText: '#ffffff',
    },
    light: {
      bgApp: '#f0f9ff',
      bgSidebar: '#e0f2fe',
      sidebarBorder: '#bae6fd',
      sidebarText: '#0369a1',
      sidebarTitle: '#0c4a6e',
      activeSessionBg: '#bae6fd',
      activeSessionBorder: '#0284c7',
      activeSessionText: '#0c4a6e',
      newChatBtn: '#0284c7',
      newChatBtnText: '#ffffff',
      mainTitle: '#0369a1',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#7dd3fc',
      userBubbleBg: '#0284c7',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#f8fafc',
      assistantBubbleText: '#0c4a6e',
      voiceBtnBg: '#0284c7',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#0284c7',
      sendBtnText: '#ffffff',
    },
  },
  autumn: {
    id: 'autumn',
    name: '🍂 Crisp Autumn',
    effect: 'leaves',
    dark: {
      bgApp: '#1c120c',
      bgSidebar: '#2a1b12',
      sidebarBorder: '#422a1d',
      sidebarText: '#ffedd5',
      sidebarTitle: '#fb923c',
      activeSessionBg: '#422a1d',
      activeSessionBorder: '#fb923c',
      activeSessionText: '#ffffff',
      newChatBtn: '#ea580c',
      newChatBtnText: '#ffffff',
      mainTitle: '#fed7aa',
      chatBoxBg: '#2a1b12',
      chatBoxBorder: '#f97316',
      userBubbleBg: '#c2410c',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#120b07',
      assistantBubbleText: '#ffedd5',
      voiceBtnBg: '#fb923c',
      voiceBtnText: '#1c120c',
      sendBtnBg: '#ea580c',
      sendBtnText: '#ffffff',
    },
    light: {
      bgApp: '#fff7ed',
      bgSidebar: '#ffedd5',
      sidebarBorder: '#fed7aa',
      sidebarText: '#9a3412',
      sidebarTitle: '#7c2d12',
      activeSessionBg: '#fed7aa',
      activeSessionBorder: '#ea580c',
      activeSessionText: '#431407',
      newChatBtn: '#ea580c',
      newChatBtnText: '#ffffff',
      mainTitle: '#7c2d12',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#fdba74',
      userBubbleBg: '#c2410c',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#fffaf5',
      assistantBubbleText: '#431407',
      voiceBtnBg: '#ea580c',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#ea580c',
      sendBtnText: '#ffffff',
    },
  },
  winter: {
    id: 'winter',
    name: '❄️ Frosty Winter',
    effect: 'snow',
    dark: {
      bgApp: '#0f172a',
      bgSidebar: '#1e293b',
      sidebarBorder: '#334155',
      sidebarText: '#f1f5f9',
      sidebarTitle: '#38bdf8',
      activeSessionBg: '#334155',
      activeSessionBorder: '#38bdf8',
      activeSessionText: '#ffffff',
      newChatBtn: '#0ea5e9',
      newChatBtnText: '#ffffff',
      mainTitle: '#e2e8f0',
      chatBoxBg: '#1e293b',
      chatBoxBorder: '#38bdf8',
      userBubbleBg: '#0284c7',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#090d16',
      assistantBubbleText: '#f1f5f9',
      voiceBtnBg: '#38bdf8',
      voiceBtnText: '#0f172a',
      sendBtnBg: '#0ea5e9',
      sendBtnText: '#ffffff',
    },
    light: {
      bgApp: '#f1f5f9',
      bgSidebar: '#e2e8f0',
      sidebarBorder: '#cbd5e1',
      sidebarText: '#1e293b',
      sidebarTitle: '#0f172a',
      activeSessionBg: '#cbd5e1',
      activeSessionBorder: '#0284c7',
      activeSessionText: '#0f172a',
      newChatBtn: '#0284c7',
      newChatBtnText: '#ffffff',
      mainTitle: '#0f172a',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#94a3b8',
      userBubbleBg: '#0284c7',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#f8fafc',
      assistantBubbleText: '#0f172a',
      voiceBtnBg: '#0284c7',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#0284c7',
      sendBtnText: '#ffffff',
    },
  },
  coastal: {
    id: 'coastal',
    name: '🌊 Coastal Vibes',
    dark: {
      bgApp: '#1d2630',
      bgSidebar: '#28313e',
      sidebarBorder: '#1c242f',
      sidebarText: '#c5dae8',
      sidebarTitle: '#8eb8d0',
      activeSessionBg: '#3b5a80',
      activeSessionBorder: '#8eb8d0',
      activeSessionText: '#ffffff',
      newChatBtn: '#f26b51',
      newChatBtnText: '#ffffff',
      mainTitle: '#e2f9f9',
      chatBoxBg: '#28313e',
      chatBoxBorder: '#3b5a80',
      userBubbleBg: '#3b5a80',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#1f2833',
      assistantBubbleText: '#e2f9f9',
      voiceBtnBg: '#8eb8d0',
      voiceBtnText: '#1d2630',
      sendBtnBg: '#f26b51',
      sendBtnText: '#ffffff',
    },
    light: {
      bgApp: '#e2f9f9',
      bgSidebar: '#ffffff',
      sidebarBorder: '#b8dce4',
      sidebarText: '#3b5a80',
      sidebarTitle: '#1c3452',
      activeSessionBg: '#c2e7ed',
      activeSessionBorder: '#3b5a80',
      activeSessionText: '#1c3452',
      newChatBtn: '#f26b51',
      newChatBtnText: '#ffffff',
      mainTitle: '#28313e',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#8eb8d0',
      userBubbleBg: '#3b5a80',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#e8f8f8',
      assistantBubbleText: '#28313e',
      voiceBtnBg: '#3b5a80',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#f26b51',
      sendBtnText: '#ffffff',
    },
  },
  highcontrast: {
    id: 'highcontrast',
    name: '👁️ High Contrast (Low Vision)',
    dark: {
      bgApp: '#000000',
      bgSidebar: '#0a0a0a',
      sidebarBorder: '#ffe600',
      sidebarText: '#ffffff',
      sidebarTitle: '#ffe600',
      activeSessionBg: '#1f1f00',
      activeSessionBorder: '#ffe600',
      activeSessionText: '#ffe600',
      newChatBtn: '#ffe600',
      newChatBtnText: '#000000',
      mainTitle: '#ffe600',
      chatBoxBg: '#0a0a0a',
      chatBoxBorder: '#ffe600',
      userBubbleBg: '#003366',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#1a1a1a',
      assistantBubbleText: '#ffffff',
      voiceBtnBg: '#00f0ff',
      voiceBtnText: '#000000',
      sendBtnBg: '#ffe600',
      sendBtnText: '#000000',
    },
    light: {
      bgApp: '#ffffff',
      bgSidebar: '#f0f0f0',
      sidebarBorder: '#000000',
      sidebarText: '#000000',
      sidebarTitle: '#000000',
      activeSessionBg: '#000000',
      activeSessionBorder: '#000000',
      activeSessionText: '#ffffff',
      newChatBtn: '#002b66',
      newChatBtnText: '#ffffff',
      mainTitle: '#000000',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#000000',
      userBubbleBg: '#002b66',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#e6e6e6',
      assistantBubbleText: '#000000',
      voiceBtnBg: '#002b66',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#002b66',
      sendBtnText: '#ffffff',
    },
  },
  albinism: {
    id: 'albinism',
    name: '🕶️ Soft Anti-Glare (Albinism)',
    dark: {
      bgApp: '#1a1d20',
      bgSidebar: '#212529',
      sidebarBorder: '#343a40',
      sidebarText: '#ced4da',
      sidebarTitle: '#e0c3fc',
      activeSessionBg: '#343a40',
      activeSessionBorder: '#e0c3fc',
      activeSessionText: '#ffffff',
      newChatBtn: '#8e9aaf',
      newChatBtnText: '#1a1d20',
      mainTitle: '#f0e6d2',
      chatBoxBg: '#212529',
      chatBoxBorder: '#495057',
      userBubbleBg: '#3d5a80',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#181a1b',
      assistantBubbleText: '#f0e6d2',
      voiceBtnBg: '#8e9aaf',
      voiceBtnText: '#1a1d20',
      sendBtnBg: '#8e9aaf',
      sendBtnText: '#1a1d20',
    },
    light: {
      bgApp: '#e5ebd9',
      bgSidebar: '#d4dcbf',
      sidebarBorder: '#b3bd9b',
      sidebarText: '#121f17',
      sidebarTitle: '#2a4030',
      activeSessionBg: '#b8c49d',
      activeSessionBorder: '#2a4030',
      activeSessionText: '#0d1710',
      newChatBtn: '#385e43',
      newChatBtnText: '#ffffff',
      mainTitle: '#121f17',
      chatBoxBg: '#f2f5eb',
      chatBoxBorder: '#b3bd9b',
      userBubbleBg: '#385e43',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#e2e8d5',
      assistantBubbleText: '#121f17',
      voiceBtnBg: '#385e43',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#385e43',
      sendBtnText: '#ffffff',
    },
  },
  pastel: {
    id: 'pastel',
    name: '🎀 Subtle Pastel Hues',
    dark: {
      bgApp: '#1e222a',
      bgSidebar: '#272c36',
      sidebarBorder: '#313744',
      sidebarText: '#e3e8f0',
      sidebarTitle: '#b8d8d8',
      activeSessionBg: '#3a4252',
      activeSessionBorder: '#b8d8d8',
      activeSessionText: '#ffffff',
      newChatBtn: '#f5c2c7',
      newChatBtnText: '#1e222a',
      mainTitle: '#f5f0eb',
      chatBoxBg: '#272c36',
      chatBoxBorder: '#3e4656',
      userBubbleBg: '#b8d8d8',
      userBubbleText: '#1e222a',
      assistantBubbleBg: '#1a1d24',
      assistantBubbleText: '#f5f0eb',
      voiceBtnBg: '#c2d4f0',
      voiceBtnText: '#1e222a',
      sendBtnBg: '#f5c2c7',
      sendBtnText: '#1e222a',
    },
    light: {
      bgApp: '#fdf2f4',
      bgSidebar: '#f7e1e5',
      sidebarBorder: '#f0c4cb',
      sidebarText: '#5e3840',
      sidebarTitle: '#8a4251',
      activeSessionBg: '#f0c4cb',
      activeSessionBorder: '#d97e8f',
      activeSessionText: '#3d1c23',
      newChatBtn: '#d97e8f',
      newChatBtnText: '#ffffff',
      mainTitle: '#4a232b',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#f0c4cb',
      userBubbleBg: '#d97e8f',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#fff5f7',
      assistantBubbleText: '#4a232b',
      voiceBtnBg: '#8bbabb',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#d97e8f',
      sendBtnText: '#ffffff',
    },
  },
  earth: {
    id: 'earth',
    name: '🌿 Earth Academia',
    dark: {
      bgApp: '#1a2217',
      bgSidebar: '#24331d',
      sidebarBorder: '#1a2515',
      sidebarText: '#d3dfc7',
      sidebarTitle: '#92a880',
      activeSessionBg: '#364a2c',
      activeSessionBorder: '#556b35',
      activeSessionText: '#ffffff',
      newChatBtn: '#be6b27',
      newChatBtnText: '#ffffff',
      mainTitle: '#fdfbf0',
      chatBoxBg: '#232e1f',
      chatBoxBorder: '#364a2c',
      userBubbleBg: '#556b35',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#2e3d29',
      assistantBubbleText: '#fdfbf0',
      voiceBtnBg: '#556b35',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#e2a05d',
      sendBtnText: '#1a2217',
    },
    light: {
      bgApp: '#fdfbf0',
      bgSidebar: '#f2ecd9',
      sidebarBorder: '#dcd6c5',
      sidebarText: '#3d4d33',
      sidebarTitle: '#3d4d33',
      activeSessionBg: '#cbd2b8',
      activeSessionBorder: '#556b35',
      activeSessionText: '#1a2217',
      newChatBtn: '#be6b27',
      newChatBtnText: '#ffffff',
      mainTitle: '#24331d',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#dcd6c5',
      userBubbleBg: '#556b35',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#f4f0e4',
      assistantBubbleText: '#24331d',
      voiceBtnBg: '#556b35',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#be6b27',
      sendBtnText: '#ffffff',
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: '⚡ Neon Cyber',
    dark: {
      bgApp: '#0d0e15',
      bgSidebar: '#151621',
      sidebarBorder: '#232538',
      sidebarText: '#a0a5c0',
      sidebarTitle: '#00f0ff',
      activeSessionBg: '#25283b',
      activeSessionBorder: '#00f0ff',
      activeSessionText: '#00f0ff',
      newChatBtn: '#ff0055',
      newChatBtnText: '#ffffff',
      mainTitle: '#00f0ff',
      chatBoxBg: '#151621',
      chatBoxBorder: '#7000ff',
      userBubbleBg: '#7000ff',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#1e1f2d',
      assistantBubbleText: '#00f0ff',
      voiceBtnBg: '#00f0ff',
      voiceBtnText: '#0d0e15',
      sendBtnBg: '#ff0055',
      sendBtnText: '#ffffff',
    },
    light: {
      bgApp: '#f0f2fb',
      bgSidebar: '#e1e4f2',
      sidebarBorder: '#c6cbdc',
      sidebarText: '#202336',
      sidebarTitle: '#5200cc',
      activeSessionBg: '#b2b8e3',
      activeSessionBorder: '#5200cc',
      activeSessionText: '#120033',
      newChatBtn: '#d9004c',
      newChatBtnText: '#ffffff',
      mainTitle: '#151621',
      chatBoxBg: '#ffffff',
      chatBoxBorder: '#c8ceea',
      userBubbleBg: '#5200cc',
      userBubbleText: '#ffffff',
      assistantBubbleBg: '#e8eaf7',
      assistantBubbleText: '#151621',
      voiceBtnBg: '#5200cc',
      voiceBtnText: '#ffffff',
      sendBtnBg: '#d9004c',
      sendBtnText: '#ffffff',
    },
  },
};

const STORAGE_KEY = 'universal_voice_bot_sessions';
const PALETTE_KEY = 'universal_voice_bot_palette';
const THEME_KEY = 'universal_voice_bot_theme_mode';
const LANG_KEY = 'universal_voice_bot_language';

const BerrySVGIcon: React.FC<{ type: number; size: number }> = ({ type, size }) => {
  switch (type) {
    case 0:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="7" y="12" width="10" height="10" rx="1" fill="#4A1525" stroke="#E63956" strokeWidth="1.5" />
          <rect x="8" y="9" width="8" height="3" fill="#C2A3B8" />
          <path d="M9 9L11 2C11 2 15 3 15 5L15 9H9Z" fill="#E61C40" />
        </svg>
      );
    case 1:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF2A55">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 2:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF4D79">
          <circle cx="12" cy="12" r="2.5" fill="#B3002D" />
          <path d="M12 12L4 7C3 10 4 15 8 13L12 12Z" fill="#FF4D79" />
          <path d="M12 12L20 7C21 10 20 15 16 13L12 12Z" fill="#FF4D79" />
          <path d="M11 14L7 21L9.5 21.5L12 14.5Z" fill="#D90036" />
          <path d="M13 14L17 21L14.5 21.5L12 14.5Z" fill="#D90036" />
        </svg>
      );
    case 3:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="9" r="6" fill="#E60039" />
          <path d="M12 3C8 3 7 7 12 9C17 11 16 15 12 15C8 15 6 10 12 9" stroke="#FF809B" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M12 15V22" stroke="#2D7A3A" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 18C10 17 7 18 6 20" stroke="#2D7A3A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 4:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="7" rx="1" fill="#1A1A1A" />
          <path d="M6 10C6 9 7 8 8 8H16C17 8 18 9 18 10V20C18 21.1 17.1 22 16 22H8C6.9 22 6 21.1 6 20V10Z" fill="#FF0044" stroke="#800022" strokeWidth="1" />
          <path d="M9 12L15 14" stroke="#FF99B2" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 5:
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#D9002C">
          <path d="M19 17C16 17 13 13 11 9L10 4H7L8 9C8.5 11.5 10 14 13 16L6 17V20H8L15 18L19 19V17Z" />
          <path d="M7 17V22H5V17H7Z" fill="#80001A" />
        </svg>
      );
  }
};

const AnimatedFlappingSeagull: React.FC<{ size: number; duration: number }> = ({ size, duration }) => {
  return (
    <svg width={size * 1.6} height={size} viewBox="0 0 50 30" fill="none" style={{ overflow: 'visible' }}>
      <path
        d="M25 18 C 18 8, 8 2, 2 10 C 10 14, 18 16, 25 18 Z"
        fill="#0284c7"
        opacity="0.85"
        style={{
          transformOrigin: '25px 18px',
          animation: `wingFlapLeft ${duration}s ease-in-out infinite alternate`,
        }}
      />
      <path
        d="M25 18 C 32 8, 42 2, 48 10 C 40 14, 32 16, 25 18 Z"
        fill="#0284c7"
        opacity="0.85"
        style={{
          transformOrigin: '25px 18px',
          animation: `wingFlapRight ${duration}s ease-in-out infinite alternate`,
        }}
      />
      <ellipse cx="25" cy="18" rx="3" ry="1.5" fill="#0369a1" />
    </svg>
  );
};

const TaylorEraSVG: React.FC<{ era: number; size: number }> = ({ era, size }) => {
  switch (era) {
    case 0:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round">
          <path d="M7 3v9a3 3 0 003 3h5l4 3v3H4V3h3z" fill="#15803d" />
        </svg>
      );
    case 1:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#eab308">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 2:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#a855f7">
          <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2-6.4-4.8-6.4 4.8 2.4-7.2-6-4.8h7.6z" />
        </svg>
      );
    case 3:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 8c0-2 3-3 7-3s7 1 7 3v4c0 2-3 3-7 3S5 14 5 12V8z" />
          <path d="M12 15v6M15 15v4" />
        </svg>
      );
    case 4:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round">
          <path d="M2 12C6 12 9 7 12 12C15 7 18 12 22 12" />
        </svg>
      );
    case 5:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path d="M12 3C8 3 5 5 5 8C5 11 8 12 12 13C16 14 19 15 19 18C19 21 15 22 11 22C7 22 4 20 4 17" stroke="#4a7c59" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="18" cy="5" r="1.2" fill="#ef4444" />
        </svg>
      );
    case 6:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="url(#loverHeart)">
          <defs>
            <linearGradient id="loverHeart" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 7:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#9ca3af">
          <path d="M12 2L4 12h3l-4 8h18l-4-8h3L12 2z" />
        </svg>
      );
    case 8:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#d97706">
          <path d="M17 2C10 2 4 8 4 15c0 4 3 7 7 7 7 0 11-8 11-15 0-2-2-5-5-5z" />
        </svg>
      );
    case 9:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#fef08a">
          <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z" />
          <path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#facc15" />
        </svg>
      );
    case 10:
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e9d5ff" strokeWidth="1.8">
          <path d="M12 2L19 9L15 22H9L5 9L12 2Z" strokeLinejoin="round" />
          <circle cx="12" cy="11" r="1.5" fill="#e9d5ff" />
          <path d="M12 12.5V22" />
        </svg>
      );
  }
};

const SeasonalParticles: React.FC<{ effect?: string; mode?: 'dark' | 'light' }> = ({ effect, mode = 'dark' }) => {
  const isLightMode = mode === 'light';

  const particleData = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 5,
      size: 22 + Math.random() * 14,
      eraType: i % 11,
      iconType: i % 6,
    }));
  }, []);

  if (!effect) return null;

  if (effect === 'taylor') {
    const clouds = Array.from({ length: 6 });
    const flyingSeagulls = Array.from({ length: 7 });

    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          {clouds.map((_, i) => {
            const width = 360 + i * 100;
            const height = 160 + i * 40;
            const top = (i * 16) % 80;
            const left = (i * 22 - 15) % 90;
            const duration = 20 + i * 5;

            const cloudColor = isLightMode
              ? i % 2 === 0
                ? 'rgba(244, 114, 182, 0.55)'
                : 'rgba(56, 189, 248, 0.55)'
              : i % 2 === 0
                ? 'rgba(60, 94, 66, 0.45)'
                : 'rgba(30, 58, 38, 0.55)';

            return (
              <div
                key={`taylor-cloud-${i}`}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: `${left}%`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: cloudColor,
                  borderRadius: '50%',
                  filter: 'blur(45px)',
                  animation: `cloudFlow ${duration}s ease-in-out infinite alternate`,
                }}
              />
            );
          })}
        </div>

        {isLightMode &&
          flyingSeagulls.map((_, i) => {
            const top = 8 + i * 11;
            const flyDuration = 14 + i * 4;
            const flapSpeed = 0.35 + (i % 3) * 0.15;
            const delay = i * 2.2;
            const size = 26 + (i % 3) * 8;

            return (
              <div
                key={`flying-seagull-${i}`}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: '-15%',
                  animation: `glideAcross ${flyDuration}s linear infinite`,
                  animationDelay: `${delay}s`,
                  zIndex: 1,
                  filter: 'drop-shadow(0 4px 6px rgba(2, 132, 199, 0.25))',
                }}
              >
                <AnimatedFlappingSeagull size={size} duration={flapSpeed} />
              </div>
            );
          })}

        {particleData.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              top: '-10%',
              left: `${p.left}%`,
              opacity: 0.85,
              animation: `fallFlow ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
              zIndex: 2,
            }}
          >
            <TaylorEraSVG era={p.eraType} size={p.size} />
          </div>
        ))}

        <style>{`
          @keyframes wingFlapLeft {
            0% { transform: rotate(0deg) scaleY(1); }
            100% { transform: rotate(-35deg) scaleY(0.5); }
          }
          @keyframes wingFlapRight {
            0% { transform: rotate(0deg) scaleY(1); }
            100% { transform: rotate(35deg) scaleY(0.5); }
          }
          @keyframes glideAcross {
            0% { transform: translateX(0vw) translateY(0px) rotate(-3deg); opacity: 0; }
            10% { opacity: 0.95; }
            90% { opacity: 0.95; }
            100% { transform: translateX(120vw) translateY(40px) rotate(3deg); opacity: 0; }
          }
          @keyframes cloudFlow {
            0% { transform: translateX(-25px) translateY(-15px) scale(1); opacity: 0.7; }
            50% { transform: translateX(35px) translateY(20px) scale(1.15); opacity: 0.95; }
            100% { transform: translateX(-15px) translateY(30px) scale(0.95); opacity: 0.7; }
          }
          @keyframes fallFlow {
            0% { transform: translateY(0vh) rotate(0deg) translateX(0px); opacity: 0.9; }
            50% { transform: translateY(50vh) rotate(180deg) translateX(25px); }
            100% { transform: translateY(110vh) rotate(360deg) translateX(-15px); opacity: 0.2; }
          }
        `}</style>
      </div>
    );
  }

  if (effect === 'rain') {
    const rainDrops = Array.from({ length: 45 });
    const clouds = Array.from({ length: 5 });

    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '180px', pointerEvents: 'none', zIndex: 1 }}>
          {clouds.map((_, i) => {
            const width = 280 + i * 80;
            const height = 90 + i * 20;
            const top = -30 + i * 10;
            const left = i * 22 - 10;
            const duration = 18 + i * 6;
            const opacity = 0.35 + (i % 3) * 0.1;

            return (
              <div
                key={`cloud-${i}`}
                style={{
                  position: 'absolute',
                  top: `${top}px`,
                  left: `${left}%`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: 'rgba(186, 230, 253, 0.45)',
                  borderRadius: '50%',
                  filter: 'blur(35px)',
                  opacity,
                  animation: `cloudDrift ${duration}s ease-in-out infinite alternate`,
                }}
              />
            );
          })}
        </div>

        {rainDrops.map((_, i) => {
          const left = Math.random() * 100;
          const duration = 0.55 + Math.random() * 0.45;
          const delay = Math.random() * 2;
          const height = 18 + Math.random() * 22;

          return (
            <div
              key={`drop-${i}`}
              style={{
                position: 'absolute',
                top: '-5%',
                left: `${left}%`,
                width: '1.5px',
                height: `${height}px`,
                backgroundColor: 'rgba(125, 211, 252, 0.65)',
                boxShadow: '0 0 4px rgba(56, 189, 248, 0.4)',
                borderRadius: '1px',
                animation: `rainFall ${duration}s linear infinite`,
                animationDelay: `${delay}s`,
                zIndex: 0,
              }}
            />
          );
        })}

        <style>{`
          @keyframes rainFall {
            0% { transform: translateY(0vh); opacity: 0.85; }
            100% { transform: translateY(105vh); opacity: 0.1; }
          }
          @keyframes cloudDrift {
            0% { transform: translateX(0px) scale(1); }
            100% { transform: translateX(35px) scale(1.08); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particleData.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-10%',
            left: `${p.left}%`,
            opacity: 0.85,
            animation: `fallFlow ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
          }}
        >
          {effect === 'berry' ? (
            <BerrySVGIcon type={p.iconType} size={p.size} />
          ) : (
            <span style={{ fontSize: `${p.size}px` }}>
              {effect === 'leaves'
                ? ['🍂', '🍁', '🍃'][p.id % 3]
                : effect === 'snow'
                ? '❄️'
                : ['🌸', '🌺', '🌼', '🌷'][p.id % 4]}
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes fallFlow {
          0% {
            transform: translateY(0vh) rotate(0deg) translateX(0px);
            opacity: 0.9;
          }
          50% {
            transform: translateY(50vh) rotate(180deg) translateX(25px);
          }
          100% {
            transform: translateY(110vh) rotate(360deg) translateX(-15px);
            opacity: 0.25;
          }
        }
      `}</style>
    </div>
  );
};

const summarizeChatTitle = (msgs: Message[]): string => {
  if (msgs.length === 0) return 'New Chat';
  const userMessages = msgs.filter((m) => m.sender === 'user').map((m) => m.text);
  if (userMessages.length === 0) return 'New Chat';

  const firstPrompt = userMessages[0];
  const cleanedPrompt = firstPrompt.replace(/^(who|what|where|when|why|how|is|are|can|could|tell me about)\s+/i, '');
  const capitalized = cleanedPrompt.charAt(0).toUpperCase() + cleanedPrompt.slice(1);
  return capitalized.slice(0, 26) + (capitalized.length > 26 ? '...' : '');
};

const parseTextIntoBlocksClient = (text: string): ExtractedTextBlock[] => {
  const paragraphs = text.split(/\n\s*\n/);
  const blocks: string[] = [];

  paragraphs.forEach((p) => {
    const trimmed = p.trim();
    if (!trimmed) return;

    if (blocks.length > 0 && blocks[blocks.length - 1].startsWith('|') && trimmed.startsWith('|')) {
      blocks[blocks.length - 1] += '\n\n' + trimmed;
    } else {
      blocks.push(trimmed);
    }
  });

  return blocks.map((b, idx) => ({
    id: `blk-${idx + 1}`,
    text: b,
  }));
};

const isMarkdownTableBlock = (text: string): boolean => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.length >= 2 && lines[0].trim().startsWith('|') && lines[1].includes('---');
};

const getMarkdownTableRows = (text: string): string[][] =>
  text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|') && !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line) => line.trim().replace(/^\|\s*|\s*\|$/g, '').split('|').map((cell) => cell.trim()));

export const ChatUI: React.FC = () => {
  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(() => {
    return localStorage.getItem(PALETTE_KEY) || 'taylor';
  });

  const [mode, setMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
  });

  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem(LANG_KEY) || 'en-US';
  });

  const currentPreset = PALETTES[selectedPaletteId] || PALETTES.taylor;
  const activeTheme = currentPreset[mode];

  const getCurrentTimeString = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const freshSessionId = Date.now().toString();
    const freshSession: ChatSession = {
      id: freshSessionId,
      title: 'New Chat',
      messages: [],
      createdAt: getCurrentTimeString(),
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validPastSessions = parsed.filter((s: ChatSession) => s.messages.length > 0);
          return [freshSession, ...validPastSessions];
        }
      }
    } catch (e) {
      console.error('[LocalStorage Load Error]:', e);
    }

    return [freshSession];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => sessions[0].id);
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [uploadedDocId, setUploadedDocId] = useState<number | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [showChunkModal, setShowChunkModal] = useState(false);
  const [isFetchingChunks, setIsFetchingChunks] = useState(false);

  // MARKDOWN VS EXTRACTED TEXT VISUAL COMPARATOR & HOVER SYNC
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<DocumentPreviewData | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DOM Refs for sync scroll and hover mapping
  const leftTextRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightTextRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handlePaletteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedPaletteId(newId);
    localStorage.setItem(PALETTE_KEY, newId);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setSelectedLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  const toggleMode = () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    localStorage.setItem(THEME_KEY, nextMode);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentSessionId) return;

    setSessions((prevSessions) => {
      const updatedSessions = prevSessions.map((session) => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            title: summarizeChatTitle(messages),
            messages,
          };
        }
        return session;
      });

      try {
        const sessionsToSave = updatedSessions.filter((s) => s.messages.length > 0);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsToSave));
      } catch (e) {
        console.error('[LocalStorage Save Error]:', e);
      }

      return updatedSessions;
    });
  }, [messages, currentSessionId]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewData?.fileUrl && previewData.fileUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewData.fileUrl);
      }
    };
  }, [previewData]);

  const handleRightTextHover = (blockId: string | null) => {
    setHoveredBlockId(blockId);
    if (blockId && leftTextRefs.current[blockId]) {
      leftTextRefs.current[blockId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const startNewChat = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setSpeakingMessageId(null);

    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [],
      createdAt: getCurrentTimeString(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setMessages([]);
    setUploadedDocId(null);
    setChunks([]);
    setPreviewData(null);
  };

  const deleteSession = (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const filtered = sessions.filter((s) => s.id !== sessionIdToDelete);
    setSessions(filtered);

    try {
      const nonEmpties = filtered.filter((s) => s.messages.length > 0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nonEmpties));
    } catch (err) {
      console.error('[LocalStorage Error]:', err);
    }

    if (sessionIdToDelete === currentSessionId) startNewChat();
  };

  const clearAllHistory = () => {
    if (!window.confirm('Are you sure you want to delete all chat history? 🧹')) return;

    localStorage.removeItem(STORAGE_KEY);

    const freshId = Date.now().toString();
    const freshSession: ChatSession = {
      id: freshId,
      title: 'New Chat',
      messages: [],
      createdAt: getCurrentTimeString(),
    };

    setSessions([freshSession]);
    setCurrentSessionId(freshId);
    setMessages([]);
    setUploadedDocId(null);
    setChunks([]);
    setPreviewData(null);
  };

  const loadSession = (session: ChatSession) => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setSpeakingMessageId(null);
    setCurrentSessionId(session.id);
    setMessages(session.messages);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('document', file);

    try {
      const filePreviewUrl = URL.createObjectURL(file);

      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      const data = await response.json();

      const docObj = data.document || data;
      const docId = docObj.id || data.documentId || Date.now();
      const fileName = docObj.filename || docObj.fileName || file.name;
      setUploadedDocId(docId);

      let parsedBlocks: ExtractedTextBlock[] = data.extractedBlocks || [];

      if (!parsedBlocks || parsedBlocks.length === 0) {
        let extractedChunks: DocumentChunk[] = [];
        try {
          const chunkRes = await fetch(`http://localhost:3000/api/chunks?documentId=${docId}`);
          if (chunkRes.ok) {
            const chunkData = await chunkRes.json();
            extractedChunks = Array.isArray(chunkData)
              ? chunkData
              : chunkData.chunks || chunkData.data || [];
            setChunks(extractedChunks);
          }
        } catch (cErr) {
          console.warn('Could not fetch chunks automatically:', cErr);
        }

        if (extractedChunks.length > 0) {
          parsedBlocks = extractedChunks.map((c, idx) => ({
            id: `blk-${c.chunkIndex ?? idx + 1}`,
            text: c.content || '',
          }));
        } else {
          const rawText =
            data.markdown ||
            data.fullExtractedText ||
            data.extractedText ||
            data.content ||
            data.text ||
            '';

          if (rawText.trim().length > 0) {
            parsedBlocks = parseTextIntoBlocksClient(rawText);
          }
        }
      }

      if (parsedBlocks.length === 0) {
        parsedBlocks = [{ id: 'blk-1', text: '*(No extracted text chunks returned for this document)*' }];
      }

      setPreviewData({
        id: docId,
        fileName: fileName,
        fileUrl: data.fileUrl || filePreviewUrl,
        markdownUrl: data.markdownUrl,
        extractedBlocks: parsedBlocks,
        fullExtractedText: data.fullExtractedText || parsedBlocks.map((b) => b.text).join('\n\n'),
      });

      setShowPreviewModal(true);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'assistant',
          text: `📄 **Document Upload Complete!**\n\nClick **👁️ Preview Doc** to launch the Visual Comparator for **${fileName}**! ✨`,
          timestamp: getCurrentTimeString(),
        },
      ]);
    } catch (err) {
      console.error('[File Upload Error]:', err);
      alert('Failed to upload document. Make sure your Express server is running on http://localhost:3000!');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchDocumentChunks = async () => {
    setIsFetchingChunks(true);
    setShowChunkModal(true);

    try {
      const url = uploadedDocId
        ? `http://localhost:3000/api/chunks?documentId=${uploadedDocId}`
        : `http://localhost:3000/api/chunks`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();

      const returnedChunks = Array.isArray(data)
        ? data
        : data.chunks || data.data || [];

      if (returnedChunks.length > 0) {
        setChunks(returnedChunks);
      } else if (chunks.length === 0) {
        setChunks([
          {
            id: 1,
            documentId: uploadedDocId || 1,
            chunkIndex: 0,
            content: 'No chunks generated for this file yet.',
          },
        ]);
      }
    } catch (err) {
      console.error('[Fetch Chunks Error]:', err);
    } finally {
      setIsFetchingChunks(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Try Chrome or Edge! 🎧');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const toggleSpeakResponse = (messageId: string, text: string) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      setSpeakingMessageId(null);
      setAudioProgress(0);
      return;
    }

    window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);

    const cleanText = text.replace(/[*_#`~|]/g, '');
    const wordCount = cleanText.split(/\s+/).length;
    const estimatedSecs = Math.max(Math.round((wordCount / 150) * 60), 3);
    setAudioDuration(estimatedSecs);
    setAudioProgress(0);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = selectedLanguage;

    const langPrefix = selectedLanguage.split('-')[0].toLowerCase();
    const setMatchingVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().replace('_', '-') === selectedLanguage.toLowerCase() ||
          v.lang.toLowerCase().startsWith(langPrefix)
      );
      if (matchingVoice) utterance.voice = matchingVoice;
    };

    setMatchingVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = setMatchingVoice;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setSpeakingMessageId(messageId);
      timerRef.current = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= estimatedSecs) {
            if (timerRef.current) clearInterval(timerRef.current);
            return estimatedSecs;
          }
          return prev + 1;
        });
      }, 1000);
    };

    utterance.onend = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setSpeakingMessageId(null);
      setAudioProgress(0);
    };

    utterance.onerror = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setSpeakingMessageId(null);
      setAudioProgress(0);
    };

    window.speechSynthesis.speak(utterance);
  };

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = Math.floor(secs % 60);
    return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: trimmedInput,
      timestamp: getCurrentTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const selectedLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 1,
          prompt: trimmedInput,
          language: selectedLanguage,
          targetLanguageName: selectedLangObj ? selectedLangObj.name : 'English',
        }),
      });

      if (!response.ok) throw new Error(`Server returned HTTP status ${response.status}`);

      const data = await response.json();
      const replyText = data.reply || data.text || data.message || "I couldn't process an answer for that query.";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: replyText,
        timestamp: getCurrentTimeString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('[Chat Request Error]:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: 'Backend connection error. Please verify the Express server is running on port 3000! 💔',
          timestamp: getCurrentTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isTaylorTheme = selectedPaletteId === 'taylor';

  return (
    <div
      style={
        {
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: activeTheme.bgApp,
          transition: 'background-color 0.3s ease',
          '--sb-track': activeTheme.bgSidebar,
          '--sb-thumb': activeTheme.chatBoxBorder,
          '--sb-hover': activeTheme.sendBtnBg,
        } as React.CSSProperties
      }
    >
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: var(--sb-track);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: var(--sb-thumb);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--sb-hover);
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--sb-thumb) var(--sb-track);
        }
        
        /* FULL GFM MARKDOWN TABLE AND FORMATTING STYLES */
        .markdown-wrapper table {
          width: 100%;
          display: table;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13.5px;
          background-color: rgba(0, 0, 0, 0.25);
          border-radius: 6px;
          overflow: hidden;
        }
        .markdown-wrapper th, .markdown-wrapper td {
          border: 1px solid rgba(255, 255, 255, 0.22);
          padding: 10px 14px;
          text-align: left;
        }
        .markdown-wrapper th {
          background-color: rgba(255, 255, 255, 0.15);
          font-weight: bold;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
        .markdown-wrapper tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.05);
        }
      `}</style>

      <SeasonalParticles effect={currentPreset.effect} mode={mode} />

      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: '280px',
          backgroundColor: activeTheme.bgSidebar,
          borderRight: `1px solid ${activeTheme.sidebarBorder}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '18px',
          boxSizing: 'border-box',
          zIndex: 2,
          transition: 'all 0.3s ease',
        }}
      >
        <button
          onClick={startNewChat}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTheme.newChatBtn,
            color: activeTheme.newChatBtnText,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '10px',
            fontSize: '14px',
            boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
          }}
        >
          + New Chat
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 4px 14px 4px' }}>
          <h4 style={{ color: activeTheme.sidebarTitle, margin: 0, fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Chat History
          </h4>
          <button
            onClick={clearAllHistory}
            style={{ backgroundColor: 'transparent', border: 'none', color: activeTheme.sidebarTitle, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', opacity: 0.8 }}
          >
            Clear All
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => loadSession(session)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  backgroundColor: isActive ? activeTheme.activeSessionBg : 'transparent',
                  border: isActive ? `1px solid ${activeTheme.activeSessionBorder}` : '1px solid transparent',
                  color: isActive ? activeTheme.activeSessionText : activeTheme.sidebarText,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    💬 {session.title}
                  </div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>{session.createdAt}</div>
                </div>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  style={{ backgroundColor: 'transparent', border: 'none', color: isActive ? activeTheme.activeSessionText : activeTheme.sidebarText, cursor: 'pointer', fontSize: '12px', opacity: 0.6 }}
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: `1px solid ${activeTheme.sidebarBorder}` }}>
          <label style={{ color: activeTheme.sidebarTitle, fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
            🎨 Color Scheme
          </label>
          <select
            value={selectedPaletteId}
            onChange={handlePaletteChange}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${activeTheme.sidebarBorder}`,
              backgroundColor: activeTheme.activeSessionBg,
              color: activeTheme.activeSessionText,
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
              marginBottom: '10px',
            }}
          >
            {Object.values(PALETTES).map((p) => (
              <option key={p.id} value={p.id} style={{ backgroundColor: '#ffffff', color: '#1d2630' }}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={toggleMode}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: `1px solid ${activeTheme.sidebarBorder}`,
              backgroundColor: activeTheme.activeSessionBg,
              color: activeTheme.activeSessionText,
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {mode === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>

      {/* MAIN RIGHT AREA */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          zIndex: 2,
        }}
      >
        <div style={{ width: '100%', maxWidth: '850px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '160px' }} />
            <h2
              style={{
                color: activeTheme.mainTitle,
                fontFamily: activeTheme.titleFont || "'Segoe UI', Roboto, sans-serif",
                textAlign: 'center',
                margin: 0,
                fontWeight: 'bold',
                fontSize: activeTheme.titleFont ? '28px' : '24px',
              }}
            >
              {activeTheme.titleText || 'Universal Voice Bot'}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                value={selectedLanguage}
                onChange={handleLanguageChange}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${activeTheme.chatBoxBorder}`,
                  backgroundColor: activeTheme.activeSessionBg,
                  color: activeTheme.activeSessionText,
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} style={{ backgroundColor: '#ffffff', color: '#1d2630' }}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="markdown-wrapper"
            style={{
              border: `2px solid ${activeTheme.chatBoxBorder}`,
              borderRadius: '14px',
              height: '480px',
              overflowY: 'auto',
              padding: '24px',
              marginBottom: '18px',
              backgroundColor: activeTheme.chatBoxBg,
              backdropFilter: 'blur(12px)',
              boxShadow: isTaylorTheme
                ? mode === 'light'
                  ? '0 0 25px rgba(244, 114, 182, 0.45)'
                  : '0 0 25px rgba(60, 94, 66, 0.35)'
                : '0 6px 18px rgba(0, 0, 0, 0.12)',
              transition: 'all 0.3s ease',
            }}
          >
            {messages.length === 0 ? (
              <p style={{ color: activeTheme.sidebarTitle, textAlign: 'center', marginTop: '180px', fontStyle: 'italic' }}>
                Ask a question, upload a document, or tap speak to begin! 🎧
              </p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left', margin: '14px 0' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '14px 18px',
                      borderRadius: '14px',
                      backgroundColor: msg.sender === 'user' ? activeTheme.userBubbleBg : activeTheme.assistantBubbleBg,
                      color: msg.sender === 'user' ? activeTheme.userBubbleText : activeTheme.assistantBubbleText,
                      fontSize: '15px',
                      lineHeight: '1.5',
                      maxWidth: '85%',
                      textAlign: 'left',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.sender === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    ) : (
                      msg.text
                    )}

                    {msg.sender === 'assistant' && (
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${activeTheme.sidebarBorder}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: speakingMessageId === msg.id ? '8px' : '0' }}>
                          <button
                            onClick={() => toggleSpeakResponse(msg.id, msg.text)}
                            style={{
                              backgroundColor: speakingMessageId === msg.id ? activeTheme.newChatBtn : 'transparent',
                              border: 'none',
                              color: speakingMessageId === msg.id ? activeTheme.newChatBtnText : activeTheme.newChatBtn,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              padding: speakingMessageId === msg.id ? '4px 10px' : '0',
                            }}
                          >
                            {speakingMessageId === msg.id ? '⏹ Stop' : '🔊 Read Aloud'}
                          </button>

                          <span style={{ fontSize: '11px', opacity: 0.65, fontStyle: 'italic' }}>
                            {msg.timestamp || getCurrentTimeString()}
                          </span>
                        </div>

                        {speakingMessageId === msg.id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <span style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'monospace' }}>
                              {formatSeconds(audioProgress)}
                            </span>
                            <input
                              type="range"
                              min="0"
                              max={audioDuration || 10}
                              value={audioProgress}
                              onChange={(e) => setAudioProgress(Number(e.target.value))}
                              style={{ flex: 1, height: '4px', cursor: 'pointer', accentColor: activeTheme.newChatBtn }}
                            />
                            <span style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'monospace' }}>
                              {formatSeconds(audioDuration)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {msg.sender === 'user' && msg.timestamp && (
                      <div style={{ textAlign: 'right', marginTop: '4px', fontSize: '10px', opacity: 0.75 }}>
                        {msg.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && <p style={{ fontStyle: 'italic', color: activeTheme.sidebarTitle }}>Thinking & checking knowledge base... 🧠</p>}
            <div ref={chatEndRef} />
          </div>

          {/* Input Controls */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf,.txt,.md,.doc,.docx,image/*" />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTheme.voiceBtnBg,
                color: activeTheme.voiceBtnText,
                fontWeight: 'bold',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
              }}
            >
              {isUploading ? '⏳ Uploading...' : '📄 Upload Doc'}
            </button>

            {previewData && (
              <button
                onClick={() => setShowPreviewModal(true)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${activeTheme.chatBoxBorder}`,
                  backgroundColor: activeTheme.newChatBtn,
                  color: activeTheme.newChatBtnText,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                👁️ Preview Doc
              </button>
            )}

            <button
              onClick={fetchDocumentChunks}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: `1px solid ${activeTheme.chatBoxBorder}`,
                backgroundColor: activeTheme.activeSessionBg,
                color: activeTheme.activeSessionText,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              🧩 View Chunks
            </button>

            <button
              onClick={startVoiceInput}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isListening ? activeTheme.newChatBtn : activeTheme.voiceBtnBg,
                color: isListening ? activeTheme.newChatBtnText : activeTheme.voiceBtnText,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {isListening ? '🎙 Stop' : '🎤 Speak'}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Speak or type your question..."
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: `2px solid ${activeTheme.chatBoxBorder}`,
                backgroundColor: activeTheme.chatBoxBg,
                color: activeTheme.assistantBubbleText,
                fontSize: '15px',
                outline: 'none',
              }}
            />

            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isLoading || !input.trim() ? '#cccccc' : activeTheme.sendBtnBg,
                color: activeTheme.sendBtnText,
                fontWeight: 'bold',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Send 🚀
            </button>
          </div>
        </div>
      </div>

      {/* 📄 FULL MARKDOWN FORMATTED DOCUMENT MODAL */}
      {showPreviewModal && previewData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ width: '95%', maxWidth: '1400px', height: '90vh', backgroundColor: activeTheme.chatBoxBg, border: `2px solid ${activeTheme.chatBoxBorder}`, borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid ${activeTheme.sidebarBorder}`, paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: activeTheme.mainTitle, fontSize: '18px', fontWeight: 'bold' }}>
                📄 Visual Comparator: <span style={{ opacity: 0.8 }}>{previewData.fileName}</span>
              </h3>
              <button onClick={() => setShowPreviewModal(false)} style={{ backgroundColor: 'transparent', border: 'none', color: activeTheme.mainTitle, fontSize: '22px', fontWeight: 'bold', cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: '18px', overflow: 'hidden' }}>
              
              {/* LEFT SIDE: GENERATED MARKDOWN DOCUMENT */}
              <div className="markdown-wrapper" style={{ flex: 1, backgroundColor: activeTheme.bgSidebar, borderRadius: '10px', padding: '18px', overflowY: 'auto', border: `1px solid ${activeTheme.sidebarBorder}` }}>
                <h4 style={{ margin: '0 0 12px 0', color: activeTheme.sidebarTitle, fontSize: '13px', textTransform: 'uppercase' }}>
                  📄 GENERATED MARKDOWN DOCUMENT
                </h4>
                <div style={{ color: activeTheme.sidebarText, fontSize: '14px', lineHeight: '1.65' }}>
                  {previewData.extractedBlocks.map((block) => {
                    const isHovered = hoveredBlockId === block.id;
                    return (
                      <div
                        key={`left-${block.id}`}
                        ref={(element) => { leftTextRefs.current[block.id] = element; }}
                        style={{
                          padding: '0 8px',
                          margin: '0',
                          borderLeft: isHovered ? `4px solid ${activeTheme.chatBoxBorder}` : '4px solid transparent',
                          backgroundColor: isHovered ? `${activeTheme.newChatBtn}22` : 'transparent',
                          color: activeTheme.sidebarText,
                          transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        }}
                      >
                        {isMarkdownTableBlock(block.text) ? (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead><tr>{getMarkdownTableRows(block.text)[0]?.map((cell, index) => <th key={index} style={{ border: `1px solid ${activeTheme.sidebarBorder}`, padding: '8px', textAlign: 'left', backgroundColor: activeTheme.chatBoxBg }}>{cell}</th>)}</tr></thead>
                              <tbody>{getMarkdownTableRows(block.text).slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ border: `1px solid ${activeTheme.sidebarBorder}`, padding: '8px', verticalAlign: 'top' }}>{cell}</td>)}</tr>)}</tbody>
                            </table>
                          </div>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {block.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT SIDE: PARSED TEXT, HEADINGS, AND TABLES */}
              <div className="markdown-wrapper" style={{ flex: 1, backgroundColor: activeTheme.assistantBubbleBg, borderRadius: '10px', padding: '18px', overflowY: 'auto', border: `1px solid ${activeTheme.sidebarBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, color: activeTheme.sidebarTitle, fontSize: '13px', textTransform: 'uppercase' }}>
                    📖 PARSED TEXT, HEADINGS & TABLES
                  </h4>
                  <span style={{ fontSize: '11px', opacity: 0.7, color: activeTheme.sidebarText }}>Hover to Highlight Block 🎯</span>
                </div>

                {previewData.extractedBlocks.filter((block) => !isMarkdownTableBlock(block.text)).map((block) => {
                  const isHovered = hoveredBlockId === block.id;
                  return (
                    <div
                      key={`right-${block.id}`}
                      ref={(el) => { rightTextRefs.current[block.id] = el; }}
                      onMouseEnter={() => handleRightTextHover(block.id)}
                      onMouseLeave={() => handleRightTextHover(null)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        backgroundColor: isHovered ? activeTheme.newChatBtn : activeTheme.chatBoxBg,
                        color: isHovered ? activeTheme.newChatBtnText : activeTheme.assistantBubbleText,
                        border: `1px solid ${isHovered ? '#ef4444' : activeTheme.sidebarBorder}`,
                        cursor: 'pointer',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        transition: 'all 0.2s ease',
                        boxShadow: isHovered ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none',
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          h1: ({ children }) => <h1 style={{ fontSize: '22px', margin: '18px 0 10px', color: activeTheme.mainTitle }}>{children}</h1>,
                          h2: ({ children }) => <h2 style={{ fontSize: '18px', margin: '16px 0 8px', color: activeTheme.mainTitle }}>{children}</h2>,
                          h3: ({ children }) => <h3 style={{ fontSize: '15px', margin: '14px 0 8px', color: activeTheme.sidebarTitle }}>{children}</h3>,
                                                    p: ({ children }) => <p style={{ margin: '0 0 12px', lineHeight: '1.6' }}>{children}</p>,
                                                    strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
                          table: ({ children }) => <div style={{ overflowX: 'auto', margin: '14px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table></div>,
                          th: ({ children }) => <th style={{ border: `1px solid ${activeTheme.sidebarBorder}`, padding: '8px', textAlign: 'left', backgroundColor: activeTheme.chatBoxBg }}>{children}</th>,
                          td: ({ children }) => <td style={{ border: `1px solid ${activeTheme.sidebarBorder}`, padding: '8px', verticalAlign: 'top' }}>{children}</td>,
                        }}
                      >
                        {block.text}
                      </ReactMarkdown>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CHUNK INSPECTOR MODAL */}
      {showChunkModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <div style={{ width: '90%', maxWidth: '750px', maxHeight: '80vh', backgroundColor: activeTheme.chatBoxBg, border: `2px solid ${activeTheme.chatBoxBorder}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: activeTheme.mainTitle }}>🧩 Document Chunks Inspector</h3>
              <button onClick={() => setShowChunkModal(false)} style={{ backgroundColor: 'transparent', border: 'none', color: activeTheme.mainTitle, fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }}>✖</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {isFetchingChunks ? (
                <p style={{ color: activeTheme.sidebarTitle, textAlign: 'center' }}>Loading document chunks... ⏳</p>
              ) : chunks.length === 0 ? (
                <p style={{ color: activeTheme.sidebarTitle, textAlign: 'center' }}>No document chunks found! 📄</p>
              ) : (
                chunks.map((chunk) => (
                  <div key={chunk.id} style={{ border: `1px solid ${activeTheme.sidebarBorder}`, backgroundColor: activeTheme.assistantBubbleBg, borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: activeTheme.sidebarTitle, marginBottom: '8px' }}>
                      <span>Chunk #{chunk.chunkIndex + 1}</span>
                      <span>Doc ID: {chunk.documentId}</span>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '13px', color: activeTheme.assistantBubbleText }}>{chunk.content}</pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatUI;