import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui';
import { ProfileDTO } from '../types/dto';

export const useTeamMutations = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const approveMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Сотрудник подтвержден');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка подтверждения: ${error.message}`);
    }
  });

  const blockMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('profiles').update({ is_approved: false }).eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Доступ заблокирован');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка блокировки: ${error.message}`);
    }
  });

  const deleteMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('profiles').update({ 
        deleted_at: new Date().toISOString() 
      }).eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Сотрудник уволен');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при удалении: ${error.message}`);
    }
  });

  const saveMember = useMutation({
    mutationFn: async ({ id, formData }: { id?: string, formData: any }) => {
      if (id) {
        // Update Profile
        const payload = {
          full_name: formData.full_name,
          role: formData.role,
          phone: formData.phone,
          birth_date: formData.birth_date,
          avatar_url: formData.avatar_url
        };

        const { error: profileError } = await supabase.from('profiles').update(payload as any).eq('id', id);
        if (profileError) throw profileError;

        // Update Credentials (Email/Password) via RPC if changed
        if (formData.email_changed || formData.password) {
          const { error: credsError } = await supabase.rpc('admin_update_user_credentials', {
            target_user_id: id,
            new_email: formData.email_changed ? formData.email : null,
            new_password: formData.password || null
          });
          if (credsError) throw credsError;
        }
      } else {
        // Create New User (Admin Flow)
        if (!formData.password) throw new Error('Пароль обязателен');

        const { supabaseAdmin } = await import('../lib/supabase');
        
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
            }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: rpcError } = await supabase.rpc('admin_update_profile', {
            target_user_id: authData.user.id,
            new_role: formData.role,
            new_approval_status: true
          });
          if (rpcError) throw rpcError;
        }
      }
    },
    onSuccess: (_, variables) => {
      toast.success(variables.id ? 'Профиль обновлен' : 'Сотрудник успешно создан и подтвержден');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при сохранении: ${error.message}`);
    }
  });

  const uploadAvatar = useMutation({
    mutationFn: async ({ userId, file }: { userId: string, file: File }) => {
      // 1. Validate file
      if (file.size > 1024 * 1024) throw new Error('Файл слишком большой (макс. 1МБ)');
      if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Допустимы только JPG и PNG');

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 2. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 4. Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('id', userId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      toast.success('Фото профиля обновлено');
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: any) => {
      toast.error(`Ошибка при загрузке фото: ${error.message}`);
    }
  });

  return {
    approveMember,
    blockMember,
    deleteMember,
    saveMember,
    uploadAvatar
  };
};
