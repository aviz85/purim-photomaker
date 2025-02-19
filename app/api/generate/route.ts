import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";  // Use client instead of serverless-client

export const runtime = 'edge';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

fal.config({
  credentials: process.env.FAL_KEY
});

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
        image_archive_url: imageUrl,
        prompt,
        style: "Disney Character",
        base_pipeline: "photomaker-style",
        num_images: 1,
        guidance_scale: 5,
        style_strength: 20,
        negative_prompt: "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
        num_inference_steps: 50
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          update.logs.map((log) => log.message).forEach(console.log);
        }
      },
    });

    console.log('Result data:', result.data);
    console.log('Request ID:', result.requestId);
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ 
          error: 'Authentication failed',
          details: 'API key authentication failed. Please check your credentials.'
        }, { status: 401 });
      }
      if (error.message.includes('Unprocessable Entity')) {
        return NextResponse.json({ 
          error: 'Failed to process image',
          details: 'Please make sure the image shows a clear, front-facing photo with good lighting and visible face'
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