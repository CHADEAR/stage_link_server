-- 001_add_programme_schedule.sql
ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS shoot_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;

-- ค้นตามวันที่ได้ไวขึ้น (ทางเลือก)
CREATE INDEX IF NOT EXISTS idx_programmes_shoot_date ON programmes (shoot_date);
