const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const defaultBirthDate = () => {
  const today = startOfToday();
  return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
};

export const minBirthDate = () => {
  const today = startOfToday();
  return new Date(today.getFullYear() - 120, 0, 1);
};

export const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseIsoDate = (value: string) => {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

export const formatDateOfBirth = (value: string) => {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase();
};
