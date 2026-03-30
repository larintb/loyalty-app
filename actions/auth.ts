'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ActionState = { error?: string; verifyEmail?: string } | null

export async function login(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.code === 'email_not_confirmed') {
      return { verifyEmail: email }
    }
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
    console.error('[register] authError:', authError.code, authError.message)
    if (authError.code === 'user_already_exists') {
      return { error: 'Este correo ya está registrado.' }
    }
    if (authError.code === 'weak_password' || authError.message?.toLowerCase().includes('password')) {
      return { error: 'La contraseña es muy débil. Usa al menos 6 caracteres.' }
    }
    if (authError.code === 'signup_disabled') {
      return { error: 'El registro está desactivado temporalmente.' }
    }
    return { error: `Error al crear la cuenta: ${authError.message}` }
  }

  if (!authData.user) {
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  // Supabase puede devolver user sin error cuando el email ya existe (anti-enumeración)
  // En ese caso identities suele venir vacío y no debemos continuar creando negocio.
  const identities = authData.user.identities ?? []
  const createdNewUser = identities.length > 0
  if (!createdNewUser) {
    return { error: 'Este correo ya está registrado. Inicia sesión.' }
  }

  // 2 y 3. Usar admin client para bypassear RLS:
  //   - El usuario recién creado no tiene sesión activa aún
  //   - auth.uid() = null → las policies bloquearían el INSERT
  const admin = createAdminClient()

  const { data: existingBusiness } = await admin
    .from('businesses')
    .select('id')
    .eq('owner_id', authData.user.id)
    .maybeSingle()

  if (existingBusiness?.id) {
    return { error: 'Este usuario ya tiene un negocio registrado. Inicia sesión.' }
  }

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
    if (createdNewUser) {
      await admin.auth.admin.deleteUser(authData.user.id)
    }
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
    if (createdNewUser) {
      await admin.auth.admin.deleteUser(authData.user.id)
    }
    return { error: 'Error al configurar el perfil. Intenta de nuevo.' }
  }

  // Si Supabase tiene confirmación de correo activa, no hay sesión todavía
  if (!authData.session) {
    return { verifyEmail: email }
  }

  redirect('/onboarding')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
