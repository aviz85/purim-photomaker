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

async function updateStatus(
  id: string, 
  status: string, 
  message: string, 
  result?: GenerationResult
) {
  await supabase
    .from('generation_status')
    .update({ 
      status,
      message,
      result: result || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
}

async function createZipFromImages(images: string[]): Promise<Blob> {
  const zip = new JSZip();
  
  // Add each image to the ZIP
  for (let i = 0; i < images.length; i++) {
    const base64Data = images[i].split(',')[1];
    // Convert base64 to Uint8Array instead of using Buffer
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    zip.file(`image_${i + 1}.jpg`, binaryData);
  }
  
  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

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

async function processImages(id: string, images: string[], prompt: string, style: PhotomakerStyle) {
  try {
    console.log(`[${id}] Starting image processing with ${images.length} images`);
    
    // ZIP creation
    console.log(`[${id}] Creating ZIP file...`);
    await updateStatus(id, 'processing', 'Creating ZIP file from images...');
    const zipBlob = await createZipFromImages(images);
    console.log(`[${id}] ZIP created, size: ${zipBlob.size} bytes`);
    
    // Upload to fal.ai
    console.log(`[${id}] Uploading to fal.ai...`);
    await updateStatus(id, 'processing', 'Uploading images to fal.ai...');
    const zipUrl = await fal.storage.upload(zipBlob);
    console.log(`[${id}] Upload complete, URL: ${zipUrl}`);

    // Generate image
    console.log(`[${id}] Starting AI generation...`);
    await updateStatus(id, 'processing', 'Generating image with AI...');
    const result = await fal.run("fal-ai/photomaker", {
      input: {
        image_archive_url: zipUrl,
        prompt,
        style,
        base_pipeline: "photomaker-style",
        negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
        num_inference_steps: 30,
        style_strength: 20,
        num_images: 1,
        guidance_scale: 5,
      }
    });
    console.log(`[${id}] Generation complete:`, result);

    await updateStatus(id, 'completed', 'Image generated successfully!', result);
    console.log(`[${id}] Process completed successfully`);
  } catch (error) {
    console.error(`[${id}] Processing error:`, error);
    await updateStatus(id, 'error', error instanceof Error ? error.message : 'Processing failed');
    throw error;
  }
} 