import { createClient } from '@supabase/supabase-js';

// Same project + publishable key the single-file app used. The publishable key
// is safe to ship in client code because Row Level Security enforces access.
export const sb = createClient(
  'https://fbiwhttuivxhxpzbhsfu.supabase.co',
  'sb_publishable_JLxegOFEGvAMi6FZ6bozNg_h2kcKpVz'
);

// Kept on window too, so ported modules that still reference window.sb during
// the migration keep working. Remove once nothing reads the global.
if (typeof window !== 'undefined') window.sb = sb;
