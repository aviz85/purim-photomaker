import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export const runtime = 'edge';

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: Request) {
  try {
    const { images, prompt, style } = await request.json();
    
    // Debug the incoming image data
    console.log('Image data length:', images[0].length);
    console.log('Image data prefix:', images[0].substring(0, 50));

    // Create a temporary URL from base64 data
    const imageUrl = images[0];

    console.log('Attempting API call...');

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

    console.log('API call successful');
    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('Error details:', error?.message || error);
    if (error.message?.includes('Unprocessable Entity')) {
      return NextResponse.json({ 
        error: 'Failed to process image',
        details: 'Please try a different image or make sure the image is clear and shows a face'
      }, { status: 422 });
    }
    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
} 