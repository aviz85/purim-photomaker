import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/serverless-client";

export const runtime = 'edge';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

// Initialize with credentials
const [key_id, key_secret] = FAL_KEY.split(':');
fal.config({
  credentials: {
    key_id,
    key_secret,
  },
});

interface ErrorResponse {
  message?: string;
  details?: string;
  status?: number;
}

export async function POST(request: Request) {
  try {
    const { images, prompt, style } = await request.json();
    
    // Upload the image directly
    const base64Data = images[0].split(',')[1];
    const imageBlob = new Blob([Buffer.from(base64Data, 'base64')], { type: 'image/jpeg' });
    
    console.log('Uploading to fal.ai storage...');
    const imageUrl = await fal.storage.upload(imageBlob);
    console.log('Upload successful, URL:', imageUrl);

    const result = await fal.subscribe("fal-ai/photomaker", {
      input: {
        image_archive_url: imageUrl,  // Use the uploaded image URL directly
        prompt,
        style,
        base_pipeline: "photomaker-style",
        negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
        num_inference_steps: 50,
        style_strength: 20,
        num_images: 1,
        guidance_scale: 5,
      },
    });

    if (!result || !result.data) {
      throw new Error('No result data received from API');
    }

    console.log('API call successful');
    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('Error details:', error?.message || error);
    
    // Handle specific error types
    if (error.message?.includes('Unauthorized')) {
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: 'API key authentication failed. Please check your credentials.'
      }, { status: 401 });
    }
    if (error.message?.includes('Unprocessable Entity')) {
      return NextResponse.json({ 
        error: 'Failed to process image',
        details: 'Please make sure the image shows a clear, front-facing photo with good lighting and visible face'
      }, { status: 422 });
    }
    if (error.message?.includes('JSON')) {
      return NextResponse.json({ 
        error: 'Invalid request',
        details: 'Failed to parse request data'
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
} 