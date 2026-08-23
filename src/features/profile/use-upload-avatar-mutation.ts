import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadToCloudinary } from './cloudinary-upload';
import { confirmAvatar, fetchAvatarSignature } from './profile-api';
import { profileQueryKey } from './query-keys';

export const useUploadAvatarMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uri: string) => {
      const signature = await fetchAvatarSignature();
      const uploaded = await uploadToCloudinary({ signature, uri });
      return confirmAvatar({
        public_id: uploaded.public_id,
        secure_url: uploaded.secure_url,
      });
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey.me, profile);
    },
  });
};
