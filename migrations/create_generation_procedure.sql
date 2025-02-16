CREATE OR REPLACE FUNCTION create_generation_job(
  p_images JSONB,
  p_prompt TEXT,
  p_style TEXT
) RETURNS JSONB AS $$
DECLARE
  v_status_id UUID;
  v_queue_id UUID;
BEGIN
  -- Create status record
  INSERT INTO generation_status (status, message)
  VALUES ('started', 'Job queued for processing')
  RETURNING id INTO v_status_id;

  -- Create queue record
  INSERT INTO processing_queue (
    status_id,
    images,
    prompt,
    style
  ) VALUES (
    v_status_id,
    p_images,
    p_prompt,
    p_style
  ) RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object(
    'status_id', v_status_id,
    'queue_id', v_queue_id
  );
END;
$$ LANGUAGE plpgsql; 