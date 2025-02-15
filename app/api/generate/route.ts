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

    // Create a simple array of images
    const imageUrls = [{
      "url": images[0],
      "name": "image001.jpg"
    }];

    console.log('Attempting API call with direct image data...');

    const result = await fal.subscribe("fal-ai/photomaker", {
      input: {
        images: imageUrls,
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
    return NextResponse.json({ 
      error: 'Failed to generate image',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
} 