import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export const runtime = 'edge';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

// Initialize with credentials
fal.config({
  credentials: FAL_KEY
});

export async function POST(request: Request) {
  try {
    const { images, prompt, style } = await request.json();
    
    // Debug the incoming image data
    console.log('Image data length:', images[0].length);
    console.log('Image data prefix:', images[0].substring(0, 50));

    // Convert base64 to blob
    const base64Data = images[0].split(',')[1];
    const binaryData = Buffer.from(base64Data, 'base64');
    const blob = new Blob([binaryData], { type: 'image/jpeg' });
    
    console.log('Uploading image to fal.ai storage...');
    const imageUrl = await fal.storage.upload(blob);
    console.log('Image uploaded:', imageUrl);

    console.log('Attempting API call...');

    try {
      const result = await fal.subscribe("fal-ai/photomaker", {
        input: {
          image_archive_url: imageUrl,
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
    } catch (apiError: unknown) {
      console.error('API Error:', apiError);
      if (apiError && typeof apiError === 'object' && 'response' in apiError) {
        try {
          const errorData = await (apiError.response as Response).json();
          console.error('API Error Details:', errorData);
          return NextResponse.json({ 
            error: 'API Error',
            details: errorData.message || 'Unknown API error'
          }, { status: (apiError.response as Response).status });
        } catch (e) {
          console.error('Failed to parse API error:', e);
        }
      }
      throw apiError;
    }
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