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

type PhotomakerStyle = "(No style)" | "Cinematic" | "Photographic" | "Digital Art" | "Fantasy art" | 
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
  const zip = new JSZip();
  
  for (let i = 0; i < images.length; i++) {
    const base64Data = images[i].split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    zip.file(`image_${i + 1}.jpg`, binaryData);
  }
  
  return await zip.generateAsync({ type: 'blob' });
}

export async function processImages(id: string, images: string[], prompt: string, style: PhotomakerStyle) {
  try {
    console.log(`[${id}] Starting image processing with ${images.length} images`);
    
    await updateStatus(id, 'processing', 'Creating ZIP file from images...');
    const zipBlob = await createZipFromImages(images);
    console.log(`[${id}] ZIP created, size: ${zipBlob.size} bytes`);
    
    await updateStatus(id, 'processing', 'Uploading images to fal.ai...');
    const zipUrl = await fal.storage.upload(zipBlob);
    console.log(`[${id}] Upload complete, URL: ${zipUrl}`);

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