
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTeacher() {
  console.log('Checking teacher code: STUDIO-SMRUTI-9703...')
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('stage_code', 'STUDIO-SMRUTI-9703')
    .single()

  if (error) {
    console.error('Error fetching teacher:', error.message)
  } else {
    console.log('Teacher Found:', JSON.stringify(data, null, 2))
  }
}

checkTeacher()
