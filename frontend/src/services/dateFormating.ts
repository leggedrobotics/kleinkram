export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export function parseDate(date: string) {
  const [daymonthyear, time] = date.split(' ');
  const [day, month, year] = daymonthyear.split('.');
  const [hours, minutes] = time.split(':');
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}`);

}

export const dateMask = 'DD.MM.YYYY HH:mm'
