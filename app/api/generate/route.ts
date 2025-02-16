import { NextResponse } from 'next/server';
import { fal, type Result } from "@fal-ai/client";
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';

interface PhotomakerOutput {
  images: Array<{
    url: string;
  }>;
}

type GenerationResult = Result<PhotomakerOutput>;

type PhotomakerStyle = "(No style)" | "Cinematic" | "Photographic" | "Digital Art" | "Fantasy art" | 
  "Neonpunk" | "Disney Character" | "Enhance" | "Comic book" | "Lowpoly" | "Line art";

const isValidStyle = (style: unknown): style is PhotomakerStyle => {
  const validStyles: PhotomakerStyle[] = ["(No style)", "Cinematic", "Photographic", "Digital Art", 
    "Fantasy art", "Neonpunk", "Disney Character", "Enhance", "Comic book", "Lowpoly", "Line art"];
  return typeof style === 'string' && validStyles.includes(style as PhotomakerStyle);
};

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes timeout

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize with credentials
fal.config({
  credentials: FAL_KEY
});

export async function POST(request: Request) {
  try {
    const { images, prompt, style } = await request.json();
    if (!isValidStyle(style)) {
      throw new Error('Invalid style parameter');
    }
    
    // Create both status and queue records in a transaction
    const { data, error } = await supabase.rpc('create_generation_job', {
      p_images: images,
      p_prompt: prompt,
      p_style: style
    });

    if (error) throw error;
    
    return NextResponse.json({ statusId: data.status_id }, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 