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

async function uploadImagesToSupabase(images: string[], jobId: string): Promise<string[]> {
  const urls = await Promise.all(images.map(async (image, index) => {
    const base64Data = image.split(',')[1];
    const fileName = `jobs/${jobId}/image_${index + 1}.jpg`;
    
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
    
    await updateStatus(id, 'processing', 'Uploading images...');
    const imageUrls = await uploadImagesToSupabase(images, id);
    
    await updateStatus(id, 'processing', 'Generating with AI...');
    const result = await fal.run("fal-ai/photomaker", {
      input: {
        image_archive_url: supabase.storage
          .from('photomaker')
          .getPublicUrl(imageUrls[0]).data.publicUrl,
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