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

    // Ensure we have a valid base64 image
    if (!images[0].startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    }

    // Extract the base64 data and image type
    const [header, base64Data] = images[0].split(',');
    const imageType = header.match(/data:image\/(\w+);base64/)?.[1] || 'jpeg';
    
    if (!base64Data) {
      return NextResponse.json({ error: 'Invalid base64 data' }, { status: 400 });
    }

    // Create a proper image file name based on type
    const fileName = `image001.${imageType}`;

    // Create ZIP structure with proper file name and content type
    const zipData = {
      'imgs/photo/original/image001/': {
        fileName,
        content: base64Data,
        contentType: `image/${imageType}`
      }
    };

    // Convert to base64 ZIP
    const zipBase64 = btoa(JSON.stringify(zipData));
    
    console.log('ZIP data created, attempting API call...');

    const result = await fal.subscribe("fal-ai/photomaker", {
      input: {
        image_archive_url: `data:application/zip;base64,${zipBase64}`,
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