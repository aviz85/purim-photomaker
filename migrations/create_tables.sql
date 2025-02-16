-- Drop existing tables and functions if they exist
DROP TRIGGER IF EXISTS update_processing_queue_updated_at ON processing_queue;
DROP TRIGGER IF EXISTS update_generation_status_updated_at ON generation_status;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS processing_queue;
DROP TABLE IF EXISTS generation_status;

-- Then create tables
CREATE TABLE generation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) NOT NULL,
  message TEXT,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Processing queue table
CREATE TABLE processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES generation_status(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  images JSONB NOT NULL,
  prompt TEXT NOT NULL,
  style VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  error TEXT,
  result JSONB
);

-- Indexes
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_generation_status_status ON generation_status(status);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_generation_status_updated_at
    BEFORE UPDATE ON generation_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 