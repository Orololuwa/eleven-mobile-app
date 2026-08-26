export const PITCH_NAME_MAX = 100;

export const validatePitchName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Pitch name is required';
  if (trimmed.length > PITCH_NAME_MAX) return `Max ${PITCH_NAME_MAX} characters`;
  return undefined;
};
