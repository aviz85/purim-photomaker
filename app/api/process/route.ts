import { NextResponse } from 'next/server';
import { processImages } from '../../lib/processImages';

export const runtime = 'edge';
export const maxDuration = 300;

export async function POST(request: Request) {
  const { id, images, prompt, style } = await request.json();
  
  // Start processing without waiting
  processImages(id, images, prompt, style)
    .catch(error => {
      console.error(`[${id}] Processing error:`, error);
    });

  return NextResponse.json({ started: true });
} 