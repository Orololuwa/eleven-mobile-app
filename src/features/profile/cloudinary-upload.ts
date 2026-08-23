import type { AvatarSignatureOut } from './types';

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
};

export const uploadToCloudinary = async ({
  signature,
  uri,
}: {
  signature: AvatarSignatureOut;
  uri: string;
}): Promise<CloudinaryUploadResult> => {
  const form = new FormData();
  form.append('file', {
    uri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  } as unknown as Blob);
  form.append('api_key', signature.api_key);
  form.append('timestamp', String(signature.timestamp));
  form.append('signature', signature.signature);
  form.append('folder', signature.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
    {
      method: 'POST',
      body: form,
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    const detail =
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : 'Cloudinary upload failed';
    throw new Error(detail);
  }

  return {
    public_id: payload.public_id as string,
    secure_url: payload.secure_url as string,
  };
};
