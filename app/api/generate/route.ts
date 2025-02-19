import { NextResponse } from 'next/server';
import { fal } from "@fal-ai/client";
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 300;

const FAL_KEY = process.env.FAL_KEY;
const LOGO_BASE64 = "data:image/png;base64,..."; // הלוגו שלך כ-base64

if (!FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

fal.config({
  credentials: process.env.FAL_KEY
});

async function addLogoToImage(imageUrl: string) {
  // הורדת התמונה המקורית
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();

  // טעינת הלוגו מהפרויקט
  const logoPath = process.cwd() + '/public/images/logo.png';
  
  // עיבוד התמונה עם sharp
  const image = sharp(Buffer.from(imageBuffer));
  const metadata = await image.metadata();
  
  // חישוב גודל הלוגו (10% מרוחב התמונה)
  const logoWidth = Math.round(metadata.width! * 0.1);
  const margin = Math.round(metadata.width! * 0.02);

  // הוספת הלוגו
  const finalImage = await image
    .composite([
      {
        input: logoPath,
        left: margin,
        top: metadata.height! - (logoWidth * 0.4) - margin,
        width: logoWidth
      }
    ])
    .toBuffer();

  // המרה ל-base64
  return `data:image/png;base64,${finalImage.toString('base64')}`;
}

export async function POST(request: Request) {
  try {
    const { images, prompt } = await request.json();
    
    // Upload the image directly
    const base64Data = images[0].split(',')[1];
    const imageBlob = new Blob([Buffer.from(base64Data, 'base64')], { type: 'image/jpeg' });
    
    console.log('Uploading to fal.ai storage...');
    const imageUrl = await fal.storage.upload(imageBlob);
    console.log('Upload successful, URL:', imageUrl);

    try {
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
        timeout: 300000 // 5 דקות
      });

      console.log('Result data:', result.data);
      console.log('Request ID:', result.requestId);

      // הוספת הלוגו לתמונה
      const imageWithLogo = await addLogoToImage(result.data.images[0].url);

      // החזרת התמונה המעודכנת
      return NextResponse.json({
        images: [{
          url: imageWithLogo
        }]
      });
      
    } catch (error) {
      // טיפול בשגיאות ספציפיות של API
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          return NextResponse.json({ 
            error: 'rate_limit',
            details: 'Server is busy, please try again in a minute'
          }, { status: 429 });
        }
        if (error.message.includes('timeout')) {
          return NextResponse.json({ 
            error: 'timeout',
            details: 'Request timed out, please try again'
          }, { status: 408 });
        }
      }
      throw error; // העבר שגיאות אחרות הלאה
    }

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