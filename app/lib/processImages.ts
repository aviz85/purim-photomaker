// Move all the processing code here (processImages function and its dependencies)
import { fal, type Result } from "@fal-ai/client";
import { createClient } from '@supabase/supabase-js';
import ConvertAPI from 'convertapi';

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

const convertapi = new ConvertAPI(process.env.CONVERT_API_SECRET!);

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

async function cleanupStorage(jobId: string) {
  const { data, error } = await supabase.storage
    .from('photomaker')
    .list(`jobs/${jobId}`);

  if (error) {
    console.error(`Failed to list files for cleanup: ${error.message}`);
    return;
  }

  if (data.length > 0) {
    const { error: deleteError } = await supabase.storage
      .from('photomaker')
      .remove(data.map(file => `jobs/${jobId}/${file.name}`));

    if (deleteError) {
      console.error(`Failed to delete files: ${deleteError.message}`);
    }
  }
}

export async function processImages(id: string, images: string[], prompt: string, style: PhotomakerStyle) {
  try {
    console.log(`[${id}] Starting image processing`);
    
    await updateStatus(id, 'processing', 'Uploading images...');
    const imageUrls = await uploadImagesToSupabase(images, id);
    
    await updateStatus(id, 'processing', 'Creating ZIP...');
    const publicUrls = imageUrls.map(url => 
      supabase.storage.from('photomaker').getPublicUrl(url).data.publicUrl
    );
    console.log(`[${id}] Public URLs:`, publicUrls);

    console.log(`[${id}] Converting to ZIP...`);
    const result = await convertapi.convert('zip', {
      Files: publicUrls
    }, 'any');
    
    const zipUrl = result.files[0].url
    console.log(`[${id}] ZIP created, URL:`, zipUrl);

    await updateStatus(id, 'processing', 'Generating with AI...');
    const falResult = await fal.run("fal-ai/photomaker", {
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

    console.log(`[${id}] Generation result:`, falResult);
    console.log(`[${id}] Result data structure:`, {
      data: falResult.data,
      requestId: falResult.requestId
    });
    
    // Format result according to the PhotomakerOutput type
    const formattedResult: GenerationResult = {
      data: {
        images: falResult.data.images
      },
      requestId: falResult.requestId
    };
    console.log(`[${id}] Formatted result for DB:`, formattedResult);

    await updateStatus(id, 'completed', 'Image generated successfully!', formattedResult);
    console.log(`[${id}] Process completed successfully`);
    
    // Cleanup uploaded images
    await cleanupStorage(id);
  } catch (error) {
    console.error(`[${id}] Processing error:`, error);
    await updateStatus(id, 'error', error instanceof Error ? error.message : 'Processing failed');
    // Cleanup on error too
    await cleanupStorage(id);
    throw error;
  }
} 