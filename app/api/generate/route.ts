import { NextResponse } from 'next/server';
import * as fal from "@fal-ai/serverless-client";

export const runtime = 'edge';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

// Initialize with credentials
const [key_id, key_secret] = FAL_KEY.split(':');
const falClient = fal.init({
  credentials: {
    key_id,
    key_secret,
  },
});

export async function POST(request: Request) {
  try {
    const { images, prompt, style } = await request.json();
    
    // Debug the incoming image data
    console.log('Image data length:', images[0].length);
    console.log('Image data prefix:', images[0].substring(0, 50));
    console.log('Using FAL_KEY:', FAL_KEY.split(':')[0] + '...');

    // Create a temporary URL from base64 data
    const imageUrl = images[0];

    console.log('Attempting API call...');

    try {
      const result = await falClient.subscribe("fal-ai/photomaker", {
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
    } catch (apiError: any) {
      console.error('API Error:', apiError);
      if (apiError.response) {
        try {
          const errorData = await apiError.response.json();
          console.error('API Error Details:', errorData);
          return NextResponse.json({ 
            error: 'API Error',
            details: errorData.message || 'Unknown API error'
          }, { status: apiError.response.status });
        } catch (e) {
          console.error('Failed to parse API error:', e);
        }
      }
      throw apiError;
    }
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
        details: 'Please try a different image or make sure the image is clear and shows a face'
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