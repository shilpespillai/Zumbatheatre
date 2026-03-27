
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
    return
  }
  console.log('Teacher Found:', data.full_name, '(', data.id, ')')

  console.log('Testing EXACT frontend query for schedules...')
  const { data: scheds, error: sErr } = await supabase
    .from('schedules')
    .select(`
      *,
      routines (
        name,
        duration_minutes
      ),
      profiles (
        full_name
      )
    `)
    .eq('teacher_id', data.id)
    .order('start_time', { ascending: true })

  console.log('---')
  console.log('Fetching all students to find match for af9f0796...')
  const { data: allStudents, error: sError } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'STUDENT')

  if (sError) {
    console.error('Error fetching students:', sError.message)
  } else {
    const matching = allStudents.filter(u => u.id.startsWith('af9f0796'))
    console.log('Matching students found:', matching.length)
    if (matching.length > 0) {
      console.log('Student Info:', JSON.stringify(matching[0], null, 2))
    } else {
      console.log('PROFILES found for STUDENTS:', allStudents.length)
      if (allStudents.length > 0) {
        console.log('First student ID:', allStudents[0].id)
      }
    }
  }
}

checkTeacher()
