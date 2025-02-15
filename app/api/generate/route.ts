import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";

export const runtime = 'edge';

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: Request) {
  try {
    const { images, prompt, style } = await request.json();
    
    // Just use the first image for now
    const imageData = images[0];
    
    const result = await fal.subscribe("fal-ai/photomaker", {
      input: {
        image_archive_url: imageData, // The base64 data URL can be used directly
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

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
} 