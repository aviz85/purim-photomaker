'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tab } from '@headlessui/react';
import { COSTUMES, IS_GENERATOR_ENABLED } from '../lib/constants';
import { Costume, GeneratedImage } from '../lib/types';
import Image from 'next/image';
import confetti from 'canvas-confetti';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

const loadingMessages = [
  // הודעות התחלה
  ["🎭 ונהפוך הוא - הופכים אותך לדמות מדהימה...",
   "✨ משנכנס אדר - מתחילים בקסם...",
   "🎪 פותחים את מגילת התחפושות..."],
  
  // הודעות אמצע
  ["👑 ליהודים הייתה אורה ושמחה - ותחפושת מדהימה!",
   "🎨 מכינים לך תחפושת שתשמח בה כמו מרדכי ברחוב...",
   "🎭 מערבבים קצת קסם עם הרבה שמחה..."],
  
  // הודעות סיום
  ["📜 כמעט מוכן, כמו המן שחשב שהוא מוכן...",
   "🍷 עד דלא ידע - בין ארור המן לברוך מרדכי...",
   "👑 מלביש אותך בבגדי מלכות, ממש כמו אסתר..."]
];

const errorMessages = {
  face: [
    "אוי ויי! 😅 צריך תמונה ברורה של הפנים, כמו שאסתר הופיעה לפני אחשוורוש",
    "רגע אחד! 🤔 התמונה לא ברורה כמו המן כשראה את מרדכי על הסוס...",
    "אופס! 📸 צריך תמונה יותר ברורה, שיראו אותך כמו ושתי במשתה..."
  ],
  process: [
    "רגע, נפלו לנו האוזני המן! 🍪 בוא ננסה שוב...",
    "המגילה קצת הסתבכה! 📜 ננסה לגלגל מחדש...",
    "זרעונים של בלבול! 🌱 ננסה שוב, כמו זרש עם העצות שלה..."
  ],
  upload: [
    "אויש! המגילה כבדה מדי 📜 צריך תמונה קטנה יותר",
    "התמונה גדולה יותר מארמון המלך! 🏰 צריך לכווץ אותה",
    "וואו, זה יותר גדול מ-127 המדינות של אחשוורוש! 🌍 בוא נקטין..."
  ],
  general: [
    "משהו השתבש בממלכה... 👑 אולי כדאי לשלוח את מרדכי היהודי לבדוק?",
    "נראה שהמן שוב מתכנן משהו... 😅 בוא ננסה שוב!",
    "אוי, התרחש נס - אבל לא הנס שציפינו לו! 🎲 ננסה שוב..."
  ]
};

const retryMessages = [
  "אוי, נראה שהמן תפס את השרת! 😅 אולי ננסה שוב בעוד דקה כשמרדכי יטפל בו?",
  "רגע, ושתי תפסה את המחשב! 👑 בואו נחכה דקה שאחשוורוש ימצא מחליפה...",
  "אופס! המן בנה עץ על השרת! 🌳 נחכה דקה שיפילו אותו...",
  "אוי ויי, התחפושת נתקעה בארמון! 🏰 ננסה שוב בעוד דקה כשאסתר תשחרר אותה...",
  "נראה שהשרת שיכור מיין המלך! 🍷 נחכה דקה שיתפכח...",
  "זרש תפסה את הרשת! 🕸️ נחכה דקה שמרדכי יעבור ברחוב...",
  "התרנגול של גבר חרבונה מפריע לשרת! 🐓 ננסה שוב בעוד דקה...",
  "השרת בתענית אסתר! ⏳ נחכה דקה ונשבור את הצום...",
  "חתול של בגתן ותרש חוסם את השרת! 🐱 נחכה דקה שמרדכי יגלה את הקשר..."
];

function RandomMessage({ messages, interval }: { messages: string[][], interval: number }) {
  const [phase, setPhase] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((prev) => {
        if (prev >= messages.length - 1) {
          setMessageIndex(Math.floor(Math.random() * messages[0].length));
          return 0;
        }
        return prev + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [interval, messages]);

  return (
    <motion.p
      key={`${phase}-${messageIndex}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.8 }}
      className="text-lg text-purple-800 min-h-[2em]"
    >
      {messages[phase][messageIndex]}
    </motion.p>
  );
}

// הוספת אנימציות לאימוג'ים
const floatingEmoji = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

const spinningEmoji = {
  animate: {
    rotate: 360,
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

const ServiceDisabledMessage = () => {
  const emojis = ['🎭', '🎪', '👑', '🎨', '✨', '🎉'];
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-yellow-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center">
        <div className="relative mb-8">
          {emojis.map((emoji, index) => (
            <motion.span
              key={index}
              className="text-4xl inline-block mx-2"
              animate={{
                y: [0, -20, 0],
                rotate: [0, 360, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: index * 0.2,
                ease: "easeInOut"
              }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
        
        <motion.h1
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl font-bold text-purple-800 mb-6 tracking-wide"
        >
          תודה שחגגתם איתנו! 🎉
        </motion.h1>
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <p className="text-2xl text-purple-600 font-medium">
            שמחנו לראות את כל התחפושות המדהימות שיצרתם!
          </p>
          <p className="text-xl text-purple-500">
            תודה שהייתם חלק מחגיגת פורים המיוחדת שלנו
          </p>
          <p className="text-lg text-purple-400 mt-4">
            חג שמח! 🎭
          </p>
        </motion.div>
      </div>
    </main>
  );
};

export default function Home() {
  const [selectedGender, setSelectedGender] = useState<'boy' | 'girl'>('boy');
  const [selectedCostume, setSelectedCostume] = useState<Costume | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset any previous errors
    setError(null);
    setGeneratedImage(null);
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImage(reader.result as string);
    };
    reader.onerror = () => {
      setError('Failed to read the image file');
    };
    reader.readAsDataURL(file);
  }, []);

  if (!IS_GENERATOR_ENABLED) {
    return <ServiceDisabledMessage />;
  }

  const handleGenerate = async () => {
    if (!IS_GENERATOR_ENABLED) {
      setError('משנכנס אדר מרבים בשמחה - הכלי יפתח לשימוש בקרוב...');
      return;
    }

    if (!selectedCostume || !uploadedImage) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: [uploadedImage],
          prompt: selectedCostume.prompt,
          style: 'Photographic',
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to generate image');
      }

      if (data.images?.[0]?.url) {
        setGeneratedImage(data.images[0]);
        confetti({
          particleCount: 150,
          spread: 100,
          colors: ['#9333ea', '#ec4899', '#fcd34d'],
          shapes: ['circle', 'square'],
          origin: { y: 0.6 }
        });
        
        // גלילה חלקה לתמונה
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'center'
          });
        }, 100);
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('No image was generated');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      let errorMessage = getRandomError('general');
      
      if (error instanceof Error) {
        if (error.message.includes('clear, front-facing photo')) {
          errorMessage = getRandomError('face');
        } else if (error.message.includes('Failed to process')) {
          errorMessage = getRandomError('process');
        } else if (error.message.includes('rate limit') || error.message.includes('timeout')) {
          // בחירה אקראית מהודעות הניסיון מחדש
          errorMessage = retryMessages[Math.floor(Math.random() * retryMessages.length)];
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (index: number) => {
    setSelectedGender(index === 0 ? 'boy' : 'girl');
    setSelectedCostume(null);
  };

  const filteredCostumes = COSTUMES.filter(costume => costume.gender === selectedGender);
  console.log('Selected Gender:', selectedGender);
  console.log('All Costumes:', COSTUMES);
  console.log('Filtered Costumes:', filteredCostumes);

  const getRandomError = (type: keyof typeof errorMessages) => {
    const messages = errorMessages[type];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const handleDownload = async () => {
    if (!generatedImage?.url) return;
    
    try {
      // המרת base64 ל-blob
      const base64Data = generatedImage.url.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      
      const blob = new Blob(byteArrays, { type: 'image/png' });

      // בדיקה אם Web Share API זמין
      if (navigator.share && /mobile|tablet|android/i.test(navigator.userAgent)) {
        const file = new File([blob], 'purim-costume.png', { type: 'image/png' });
        await navigator.share({
          title: 'התחפושת שלי לפורים!',
          text: 'תראו איזו תחפושת מגניבה יצרתי באתר של \'אותיות וילדים\'!\n\nרוצו לנסות: https://rb.gy/sxql8q',
          files: [file]
        });
      } else {
        // אם לא במובייל, נשתמש בהורדה רגילה
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'purim-costume.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error sharing/downloading image:', error);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-yellow-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 relative">
          {/* אימוג'ים מרחפים */}
          <motion.span 
            variants={floatingEmoji}
            animate="animate"
            className="absolute -left-8 -top-4 text-4xl"
          >
            🎭
          </motion.span>
          <motion.span 
            variants={spinningEmoji}
            animate="animate"
            className="absolute -right-8 -top-4 text-4xl"
          >
            👑
          </motion.span>
          
          <h1 className="text-5xl font-bold text-purple-800 mb-6 tracking-wide">
            ✨ יוצר תחפושות פורים קסום ✨
          </h1>
          <p className="text-xl text-purple-600 font-medium">
            🎪 ונהפוך הוא - העלו תמונה והפכו אותה לתחפושת מדהימה! 🎪
          </p>
        </div>

        <div className="space-y-12">
          {/* שלב א - בחירת תחפושת */}
          <div className="bg-white rounded-[2rem] shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-purple-800 mb-6 text-center">
              <span className="text-4xl">🎭</span> שלב א׳: בחרו תחפושת
            </h2>
            <p className="text-lg text-purple-600 mb-8 text-center">
              בחרו את התחפושת המושלמת מהאפשרויות שלנו
            </p>
            
            <Tab.Group selectedIndex={selectedGender === 'boy' ? 0 : 1} onChange={handleTabChange}>
              <Tab.List className="flex space-x-4 rtl:space-x-reverse mb-8">
                <Tab
                  className={({ selected }) =>
                    classNames(
                      'w-full py-3 text-xl font-medium leading-5 rounded-full transition-all duration-300',
                      'focus:outline-none focus:ring-4 ring-offset-2 ring-offset-purple-400 ring-white ring-opacity-60',
                      selected
                        ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white shadow-lg transform scale-105'
                        : 'text-purple-600 hover:bg-purple-100 hover:scale-102'
                    )
                  }
                >
                  בנים
                </Tab>
                <Tab
                  className={({ selected }) =>
                    classNames(
                      'w-full py-3 text-xl font-medium leading-5 rounded-full transition-all duration-300',
                      'focus:outline-none focus:ring-4 ring-offset-2 ring-offset-pink-400 ring-white ring-opacity-60',
                      selected
                        ? 'bg-gradient-to-r from-pink-500 to-pink-700 text-white shadow-lg transform scale-105'
                        : 'text-pink-600 hover:bg-pink-100 hover:scale-102'
                    )
                  }
                >
                  👧 בנות
                </Tab>
              </Tab.List>

              <Tab.Panels>
                <Tab.Panel static className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCostumes.map((costume) => (
                    <motion.div
                      key={costume.id}
                      whileHover={{ scale: 1.05, rotate: 1 }}
                      whileTap={{ scale: 0.95 }}
                      className={classNames(
                        'cursor-pointer p-6 rounded-[1.5rem] transition-all duration-300',
                        selectedCostume?.id === costume.id
                          ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-500 shadow-lg'
                          : 'bg-gray-50 hover:bg-purple-50 hover:shadow-xl'
                      )}
                      onClick={() => setSelectedCostume(costume)}
                    >
                      <h3 className="text-xl font-bold text-purple-800 mb-3">{costume.name}</h3>
                      <p className="text-md text-purple-600">{costume.description}</p>
                    </motion.div>
                  ))}
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>

          {/* שלב ב - העלאת תמונה */}
          <div className="bg-white rounded-[2rem] shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-purple-800 mb-6 text-center">
              <span className="text-4xl">📸</span> שלב ב׳: העלו תמונה
            </h2>
            <p className="text-lg text-purple-600 mb-8 text-center">
              העלו תמונה ברורה של הפנים. התמונה צריכה להיות חזיתית עם תאורה טובה.
            </p>

            <div className="flex flex-col items-center">
              <motion.div 
                className="mb-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ul className="text-lg text-purple-600 space-y-2 text-right">
                  <li>👀 רצוי תמונה חזיתית (פרונטלית)</li>
                  <li>💡 הפנים צריכות להיות מוארות היטב</li>
                  <li>📦 גודל מקסימלי: 5MB</li>
                </ul>
              </motion.div>
              
              <label className="w-full max-w-md flex flex-col items-center px-6 py-8 bg-gradient-to-br from-purple-50 to-pink-50 text-purple rounded-[1.5rem] shadow-xl tracking-wide border-2 border-purple-200 cursor-pointer hover:border-purple-400 hover:shadow-2xl transition-all duration-300">
                {uploadedImage ? (
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-4">
                    <Image
                      src={uploadedImage}
                      alt="Uploaded photo"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-lg font-medium">
                        לחץ להחלפת תמונה 🔄
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl mb-4 text-purple-500">
                      📸
                    </div>
                    <span className="text-xl font-medium text-purple-700">העלו תמונה!</span>
                    <span className="text-sm text-purple-500 mt-2">לחצו כאן או גררו תמונה</span>
                  </>
                )}
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
              </label>
            </div>
          </div>

          {/* שלב ג - יצירת התמונה */}
          <div className="bg-white rounded-[2rem] shadow-2xl p-8">
            <h2 className="text-3xl font-bold text-purple-800 mb-6 text-center">
              <span className="text-4xl">✨</span> שלב ג׳: צרו את התחפושת הקסומה
            </h2>
            <p className="text-lg text-purple-600 mb-8 text-center">
              לחצו על הכפתור ותנו לקסם לקרות! התהליך יכול לקחת כדקה.
            </p>

            <div className="text-center">
              {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                  <p className="text-xl mb-2">🤔</p>
                  {error}
                </div>
              )}
              <button
                className={classNames(
                  'px-8 py-3 rounded-lg text-lg font-medium',
                  'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-purple-400',
                  !IS_GENERATOR_ENABLED || isLoading || !selectedCostume || !uploadedImage
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                )}
                onClick={handleGenerate}
                disabled={!IS_GENERATOR_ENABLED || isLoading || !selectedCostume || !uploadedImage}
              >
                {!IS_GENERATOR_ENABLED ? 'הכלי יפתח בקרוב...' : isLoading ? 'יוצר תמונה...' : 'צור תמונה קסומה!'}
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <div className="bg-white p-8 rounded-xl text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="text-4xl mb-4"
              >
                🎭
              </motion.div>
              <RandomMessage messages={loadingMessages} interval={4000} />
              <p className="text-sm text-purple-600 mt-2">
                (זה יכול לקחת כדקה, בדיוק כמו שמרדכי חיכה בשער המלך...)
              </p>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {generatedImage && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 bg-white rounded-2xl shadow-xl p-6"
            >
              <h2 className="text-2xl font-bold text-purple-800 mb-4 text-center">
                🎉 ליהודים הייתה אורה ושמחה - והתחפושת מוכנה! 🎉
              </h2>
              <div className="relative w-full aspect-square max-w-2xl mx-auto">
                <Image
                  src={generatedImage.url}
                  alt="Generated costume image"
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {/mobile|tablet|android/i.test(navigator.userAgent) ? (
                    <>
                      שתף תמונה
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                      </svg>
                    </>
                  ) : (
                    <>
                      הורד תמונה
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
} 