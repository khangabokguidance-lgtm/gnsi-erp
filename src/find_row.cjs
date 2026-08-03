const {createClient} = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('qbank_questions')
  .select('id,question,question_mayek')
  .ilike('question', '%Average age of 5 boys%')
  .then(r => console.log(JSON.stringify(r.data, null, 2)));
