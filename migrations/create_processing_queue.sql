CREATE TABLE processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  images JSONB NOT NULL,
  prompt TEXT NOT NULL,
  style VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  error TEXT,
  result JSONB
);

CREATE INDEX idx_processing_queue_status ON processing_queue(status);

-- Trigger to update updated_at
CREATE TRIGGER update_processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 