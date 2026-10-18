import { supabase } from '@/lib/supabase'
import { resizeImage } from '@/lib/image'

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

/** Square-crops and shrinks a picked image to a JPEG ready to upload; throws a readable error if it's unusable. */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image.')
  const blob = await resizeImage(file, 512)
  if (blob.size > MAX_AVATAR_BYTES) throw new Error('Image is too large (max 2 MB).')
  return blob
}

/** Uploads to avatars/<userId>/ and points the profile at it (owner, or an admin for someone else). */
export async function saveAvatar(userId: string, blob: Blob | null): Promise<string | null> {
  let url: string | null = null
  if (blob) {
    const path = `${userId}/avatar-${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { contentType: 'image/jpeg' })
    if (upErr) throw upErr
    url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  if (error) throw error
  return url
}
