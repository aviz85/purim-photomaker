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

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions (max 800px)
        const maxSize = 800;
        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 70% quality
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [selectedGender, setSelectedGender] = useState<'boy' | 'girl'>('boy');
  const [selectedCostume, setSelectedCostume] = useState<Costume | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Reset any previous errors
    setError(null);
    setGeneratedImage(null);
    
    // Check number of files
    if (files.length > 5) {
      setError('ניתן להעלות עד 5 תמונות');
      return;
    }

    // Check total number of images (existing + new)
    if (uploadedImages.length + files.length > 5) {
      setError(`ניתן להעלות עד 5 תמונות (כרגע יש ${uploadedImages.length} תמונות)`);
      return;
    }
    
    // Validate file size (max 5MB per file)
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError(`Some images are too large (max 5MB per image): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Validate file types
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      setError(`Some files are not images: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    // Compress and read all files
    Promise.all(
      files.map(file => compressImage(file))
    ).then(
      compressedImages => {
        setUploadedImages(prevImages => [...prevImages, ...compressedImages]);
      },
      err => setError(err instanceof Error ? err.message : 'Failed to process image files')
    );
  }, [uploadedImages.length]);

  const handleGenerate = async () => {
    if (!selectedCostume || uploadedImages.length === 0) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: uploadedImages,
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
      setError(error instanceof Error ? error.message : 'Failed to generate image');
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
              <h3 className="text-lg font-medium text-purple-800 mb-2">הנחיות לתמונות:</h3>
              <ul className="text-sm text-purple-600 space-y-1 text-right">
                <li>• התמונות צריכות להיות ברורות ולהראות את הפנים</li>
                <li>• רצוי תמונות חזיתיות (פרונטליות)</li>
                <li>• הפנים צריכות להיות מוארות היטב</li>
                <li>• גודל מקסימלי: 5MB לכל תמונה</li>
                <li>• ניתן להעלות עד 5 תמונות</li>
                {uploadedImages.length > 0 && (
                  <li className="font-medium">• הועלו {uploadedImages.length}/5 תמונות</li>
                )}
              </ul>
            </div>
            <label className="w-full max-w-md flex flex-col items-center px-4 py-6 bg-purple-50 text-purple rounded-lg shadow-lg tracking-wide border border-purple-200 cursor-pointer hover:bg-purple-100">
              <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
              </svg>
              <span className="mt-2 text-base leading-normal">העלו תמונות</span>
              <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
            </label>

            {uploadedImages.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {uploadedImages.map((image, index) => (
                  <div key={index} className="relative w-32 h-32">
                    <Image
                      src={image}
                      alt={`Uploaded image ${index + 1}`}
                      fill
                      className="object-cover rounded-lg"
                    />
                    <button
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      onClick={() => setUploadedImages(images => images.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </div>
                ))}
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
              isLoading || !selectedCostume || uploadedImages.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            )}
            onClick={handleGenerate}
            disabled={isLoading || !selectedCostume || uploadedImages.length === 0}
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