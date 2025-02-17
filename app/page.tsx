'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tab } from '@headlessui/react';
import { COSTUMES } from '../lib/constants';
import { Costume, GeneratedImage } from '../lib/types';
import Image from 'next/image';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Home() {
  const [selectedGender, setSelectedGender] = useState<'boy' | 'girl'>('boy');
  const [selectedCostume, setSelectedCostume] = useState<Costume | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleGenerate = async () => {
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
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('No image was generated');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      let errorMessage = 'Failed to generate image';
      
      if (error instanceof Error) {
        if (error.message.includes('clear, front-facing photo')) {
          errorMessage = 'Please upload a clear photo showing the face directly';
        } else if (error.message.includes('Failed to process')) {
          errorMessage = 'Could not process this image. Try a different photo with better lighting';
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-100 to-pink-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-purple-800 mb-4">יוצר תמונות פורים קסום</h1>
          <p className="text-lg text-purple-600">העלו תמונה של הילד/ה ובחרו תחפושת קסומה!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <Tab.Group selectedIndex={selectedGender === 'boy' ? 0 : 1} onChange={handleTabChange}>
            <Tab.List className="flex space-x-4 rtl:space-x-reverse mb-6">
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-lg font-medium leading-5 rounded-lg',
                    'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-purple-400 ring-white ring-opacity-60',
                    selected
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-purple-600 hover:bg-purple-100'
                  )
                }
              >
                בנים
              </Tab>
              <Tab
                className={({ selected }) =>
                  classNames(
                    'w-full py-2.5 text-lg font-medium leading-5 rounded-lg',
                    'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-purple-400 ring-white ring-opacity-60',
                    selected
                      ? 'bg-pink-600 text-white shadow'
                      : 'text-pink-600 hover:bg-pink-100'
                  )
                }
              >
                בנות
              </Tab>
            </Tab.List>

            <Tab.Panels>
              <Tab.Panel static className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCostumes.map((costume) => (
                  <motion.div
                    key={costume.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={classNames(
                      'cursor-pointer p-4 rounded-lg',
                      selectedCostume?.id === costume.id
                        ? 'bg-purple-100 border-2 border-purple-500'
                        : 'bg-gray-50 hover:bg-purple-50'
                    )}
                    onClick={() => setSelectedCostume(costume)}
                  >
                    <h3 className="text-lg font-medium text-purple-800 mb-2">{costume.name}</h3>
                    <p className="text-sm text-purple-600">{costume.description}</p>
                  </motion.div>
                ))}
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex flex-col items-center">
            <div className="mb-6 text-center">
              <h3 className="text-lg font-medium text-purple-800 mb-2">הנחיות לתמונה:</h3>
              <ul className="text-sm text-purple-600 space-y-1 text-right">
                <li>• התמונה צריכה להיות ברורה ולהראות את הפנים</li>
                <li>• רצוי תמונה חזיתית (פרונטלית)</li>
                <li>• הפנים צריכות להיות מוארות היטב</li>
                <li>• גודל מקסימלי: 5MB</li>
              </ul>
            </div>
            <label className="w-full max-w-md flex flex-col items-center px-4 py-6 bg-purple-50 text-purple rounded-lg shadow-lg tracking-wide border border-purple-200 cursor-pointer hover:bg-purple-100">
              <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
              </svg>
              <span className="mt-2 text-base leading-normal">העלו תמונה</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>

            {uploadedImage && (
              <div className="mt-4 relative w-32 h-32">
                <Image
                  src={uploadedImage}
                  alt="Uploaded image"
                  fill
                  className="object-cover rounded-lg"
                />
                <button
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                  onClick={() => setUploadedImage(null)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          <button
            className={classNames(
              'px-8 py-3 rounded-lg text-lg font-medium',
              'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-purple-400',
              isLoading || !selectedCostume || !uploadedImage
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            )}
            onClick={handleGenerate}
            disabled={isLoading || !selectedCostume || !uploadedImage}
          >
            {isLoading ? 'יוצר תמונה...' : 'צור תמונה קסומה!'}
          </button>
        </div>

        <AnimatePresence>
          {generatedImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 bg-white rounded-2xl shadow-xl p-6"
            >
              <h2 className="text-2xl font-bold text-purple-800 mb-4 text-center">התמונה המוכנה!</h2>
              <div className="relative w-full aspect-square max-w-2xl mx-auto">
                <Image
                  src={generatedImage.url}
                  alt="Generated costume image"
                  fill
                  className="object-contain rounded-lg"
                />
              </div>
              <div className="mt-4 text-center">
                <a
                  href={generatedImage.url}
                  download="purim-costume.png"
                  className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  הורד תמונה
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
} 