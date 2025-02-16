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
  console.log('Starting ZIP creation with', images.length, 'images');
  const zip = new JSZip();
  
  // Convert base64 to URLs first
  const imageUrls = await Promise.all(images.map(async (image, i) => {
    console.log(`Creating blob for image ${i + 1}`);
    const base64Data = image.split(',')[1];
    const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(r => r.blob());
    const url = URL.createObjectURL(blob);
    return { url, index: i };
  }));

  // Then create ZIP from URLs
  await Promise.all(imageUrls.map(async ({ url, index }) => {
    try {
      console.log(`Fetching and adding image ${index + 1} to ZIP`);
      const response = await fetch(url);
      const blob = await response.blob();
      zip.file(`image_${index + 1}.jpg`, blob);
      URL.revokeObjectURL(url); // Clean up
    } catch (error) {
      console.error(`Error processing image ${index + 1}:`, error);
      throw error;
    }
  }));
  
  console.log('Generating final ZIP');
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6 
    }
  });
  console.log('ZIP generated, size:', zipBlob.size);
  return zipBlob;
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