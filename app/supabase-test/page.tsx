import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos, error } = await supabase
    .from('todos')
    .select('*')

  if (error) {
    return (
      <div>
        <h1>Supabase Connection Test</h1>
        <p>Error fetching todos: {error.message}</p>
        <p>This is expected if the todos table doesn't exist yet.</p>
        <p>Supabase client is properly configured!</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Supabase Connection Test</h1>
      <p>Successfully connected to Supabase!</p>
      <ul>
        {todos?.map((todo) => (
          <li key={todo.id}>{todo.name || 'Unnamed todo'}</li>
        ))}
      </ul>
    </div>
  )
}