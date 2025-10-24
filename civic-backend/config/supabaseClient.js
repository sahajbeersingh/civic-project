const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// const supabaseUrl = "https://ezmgdwdbulzbnatesfyu.supabase.co";
// const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bWdkd2RidWx6Ym5hdGVzZnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyODg0NzQsImV4cCI6MjA3Mzg2NDQ3NH0.TIHIA71guHh38SxnpyZKOLS-IB8t-_lJENr46e65YQc";
if(!supabaseUrl || !supabaseKey) {
  console.error("Please set SUPABASE_URL and SUPABASE_KEY in env");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
module.exports=supabase
