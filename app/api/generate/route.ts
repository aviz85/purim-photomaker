import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";
import JSZip from 'jszip';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes timeout

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

// Initialize with credentials
fal.config({
  credentials: FAL_KEY
});

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
  try {
    const { images, prompt, style } = await request.json();
    
    // Debug the incoming data
    console.log('Number of images:', images.length);
    console.log('First image data length:', images[0].length);
    console.log('First image data prefix:', images[0].substring(0, 50));

    // Create and upload ZIP immediately
    const zipBlob = await createZipFromImages(images);
    const zipUrl = await fal.storage.upload(zipBlob);

    // Use direct run method
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

    return NextResponse.json({ result });

  } catch (error: unknown) {
    console.error('Error details:', error instanceof Error ? error.message : error);
    
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
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 