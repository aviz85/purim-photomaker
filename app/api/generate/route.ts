import { NextResponse } from 'next/server';
import { fal, type Result } from "@fal-ai/client";
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';

interface PhotomakerOutput {
  images: Array<{
    url: string;
  }>;
}

type StatusRecord = {
  id: string;
  status: string;
  message: string;
  result: GenerationResult | null;
  created_at: string;
  updated_at: string;
};

type GenerationResult = Result<PhotomakerOutput>;

type ErrorResponse = {
  error: string;
  details?: string;
};

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes timeout

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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
    const binaryData = Buffer.from(base64Data, 'base64');
    zip.file(`image_${i + 1}.jpg`, binaryData);
  }
  
  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

export async function POST(request: Request) {
  let statusRecord: StatusRecord | null = null;
  
  try {
    const { images, prompt, style } = await request.json();
    
    // Create initial status record
    const { data } = await supabase
      .from('generation_status')
      .insert({
        status: 'started',
        message: 'Starting image generation...',
      })
      .select()
      .single();
      
    if (!data) throw new Error('Failed to create status record');
    statusRecord = data;
    const id = data.id;

    // Update status for ZIP creation
    await updateStatus(id, 'processing', 'Creating ZIP file from images...');
    const zipBlob = await createZipFromImages(images);
    
    // Update status for upload
    await updateStatus(id, 'processing', 'Uploading images to fal.ai...');
    const zipUrl = await fal.storage.upload(zipBlob);

    // Update status for generation
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

    // Update final status
    await updateStatus(id, 'completed', 'Image generated successfully!', result);
    return NextResponse.json({ result, statusId: id });

  } catch (error: unknown) {
    console.error('Error details:', error instanceof Error ? error.message : error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If we have a statusId, update the error status
    if (statusRecord?.id) {
      await updateStatus(statusRecord.id, 'error', errorMessage);
    }
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ 
          error: 'Authentication failed',
          details: 'API key authentication failed. Please check your credentials.'
        }, { status: 401 });
      }
      if (error.message.includes('Unprocessable Entity')) {
        return NextResponse.json({ 
          error: 'Failed to process image',
          details: 'Please try a different image or make sure the image is clear and shows a face'
        }, { status: 422 });
      }
      if (error.message.includes('JSON')) {
        return NextResponse.json({ 
          error: 'Invalid request',
          details: 'Failed to parse request data'
        }, { status: 400 });
      }
    }

    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: errorMessage
    }, { status: 500 });
  }
} 