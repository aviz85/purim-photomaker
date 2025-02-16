// Move all the processing code here (processImages function and its dependencies)
import { fal, type Result } from "@fal-ai/client";
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';

interface PhotomakerOutput {
  images: Array<{
    url: string;
  }>;
}

type GenerationResult = Result<PhotomakerOutput>;

export type PhotomakerStyle = "(No style)" | "Cinematic" | "Photographic" | "Digital Art" | "Fantasy art" | 
  "Neonpunk" | "Disney Character" | "Enhance" | "Comic book" | "Lowpoly" | "Line art";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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
  console.log('Starting ZIP creation with', images.length, 'images');
  const zip = new JSZip();
  
  // Process images in chunks
  const CHUNK_SIZE = 2;
  for (let i = 0; i < images.length; i += CHUNK_SIZE) {
    const chunk = images.slice(i, i + CHUNK_SIZE);
    console.log(`Processing chunk ${i/CHUNK_SIZE + 1} of ${Math.ceil(images.length/CHUNK_SIZE)}`);
    
    await Promise.all(chunk.map(async (image, index) => {
      try {
        const currentIndex = i + index;
        console.log(`Processing image ${currentIndex + 1}`);
        const base64Data = image.split(',')[1];
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        zip.file(`image_${currentIndex + 1}.jpg`, binaryData.buffer);
        console.log(`Added image ${currentIndex + 1} to ZIP`);
      } catch (error) {
        console.error(`Error processing image: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    }));
  }
  
  console.log('Starting ZIP compression...');
  try {
    // Generate as ArrayBuffer first
    const zipBuffer = await zip.generateAsync({ 
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 1 // Minimal compression for speed
      }
    }, (metadata) => {
      console.log(`ZIP progress: ${metadata.percent.toFixed(1)}%`);
    });
    
    // Convert to Blob
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
    console.log('ZIP generated, size:', zipBlob.size);
    return zipBlob;
  } catch (error) {
    console.error('ZIP generation error:', error);
    throw new Error(`Failed to generate ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function uploadImagesToSupabase(images: string[], jobId: string): Promise<string[]> {
  const urls = await Promise.all(images.map(async (image, index) => {
    const base64Data = image.split(',')[1];
    const fileName = `jobs/${jobId}/image_${index + 1}.jpg`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('photomaker')
      .upload(fileName, Buffer.from(base64Data, 'base64'), {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });

    if (error) throw error;
    return data.path;
  }));

  return urls;
}

export async function processImages(id: string, images: string[], prompt: string, style: PhotomakerStyle) {
  try {
    console.log(`[${id}] Starting image processing`);
    
    // Upload images to Supabase
    await updateStatus(id, 'processing', 'Uploading images...');
    const imageUrls = await uploadImagesToSupabase(images, id);
    
    // Get public URLs
    const { data: { publicUrl } } = supabase.storage
      .from('photomaker')
      .getPublicUrl(imageUrls[0]);

    // Pass URLs to fal.ai
    await updateStatus(id, 'processing', 'Generating with AI...');
    const result = await fal.run("fal-ai/photomaker", {
      input: {
        image_urls: imageUrls.map(url => supabase.storage.from('photomaker').getPublicUrl(url).data.publicUrl),
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

    await updateStatus(id, 'completed', 'Image generated successfully!', result);
    console.log(`[${id}] Process completed successfully`);
  } catch (error) {
    console.error(`[${id}] Processing error:`, error);
    await updateStatus(id, 'error', error instanceof Error ? error.message : 'Processing failed');
    throw error;
  }
} 