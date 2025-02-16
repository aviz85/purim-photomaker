import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processImages, type PhotomakerStyle } from '../../lib/processImages';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Add timeout to processImages call
const TIMEOUT = 270000; // 4.5 minutes (leaving buffer for response)

interface ProcessingJob {
  id: string;
  status_id: string;
  status: string;
  images: string[];
  prompt: string;
  style: PhotomakerStyle;
  error?: string;
}

async function handleJobError(job: ProcessingJob | null, error: unknown) {
  console.error('Worker error:', error);
  if (job) {
    await supabase
      .from('processing_queue')
      .update({ 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', job.id);
  }
  return NextResponse.json({ 
    error: 'Worker failed',
    details: error instanceof Error ? error.message : 'Unknown error'
  }, { status: 500 });
}

export async function GET() {
  let job: ProcessingJob | null = null;
  try {
    // Get next pending job
    const { data, error } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ message: 'No pending jobs' });
    }

    job = data as ProcessingJob;  // Type assertion here
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Processing timeout')), TIMEOUT)
    );

    // Update job to processing
    await supabase
      .from('processing_queue')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // Process with timeout
    await Promise.race([
      processImages(job.status_id, job.images, job.prompt, job.style),
      timeoutPromise
    ]);

    // Update job to completed
    await supabase
      .from('processing_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);

    return NextResponse.json({ processed: job.id });

  } catch (error) {
    return handleJobError(job, error);
  }
} 