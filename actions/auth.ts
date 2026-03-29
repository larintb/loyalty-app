'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionState = { error: string } | null

export async function login(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  redirect('/dashboard')
}

export async function register(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const businessName = formData.get('businessName') as string
  const ownerName = formData.get('ownerName') as string

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: ownerName },
    },
  })

  if (authError) {
    if (authError.code === 'user_already_exists') {
      return { error: 'Este correo ya está registrado.' }
    }
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  if (!authData.user) {
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  // 2 y 3. Usar admin client para bypassear RLS:
  //   - El usuario recién creado no tiene sesión activa aún
  //   - auth.uid() = null → las policies bloquearían el INSERT
  const admin = createAdminClient()

  const { data: business, error: bizError } = await admin
    .from('businesses')
    .insert({
      owner_id: authData.user.id,
      name: businessName,
      email,
    })
    .select()
    .single()

  if (bizError) {
    // Limpiar el usuario de auth si falla la creación del negocio
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Error al crear el negocio. Intenta de nuevo.' }
  }

  const { error: staffError } = await admin.from('staff_members').insert({
    business_id: business.id,
    user_id: authData.user.id,
    role: 'owner',
    name: ownerName,
    email,
  })

  if (staffError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Error al configurar el perfil. Intenta de nuevo.' }
  }

  redirect('/onboarding')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
