import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processImages } from '../../lib/processImages';

export const runtime = 'edge';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  try {
    // Get next pending job
    const { data: job, error } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
      .limit(1)
      .single();

    if (error || !job) {
      return NextResponse.json({ message: 'No pending jobs' });
    }

    // Update job to processing
    await supabase
      .from('processing_queue')
      .update({ status: 'processing' })
      .eq('id', job.id);

    // Process the job
    await processImages(job.status_id, job.images, job.prompt, job.style);

    // Update job to completed
    await supabase
      .from('processing_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);

    return NextResponse.json({ processed: job.id });

  } catch (error) {
    console.error('Worker error:', error);
    return NextResponse.json({ 
      error: 'Worker failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 