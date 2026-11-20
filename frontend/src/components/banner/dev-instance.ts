import ENV from 'src/environment';

// TODO: currently, all hosted versions should show this warning
export const isDevInstance = ENV.BACKEND_URL.includes(
    '.dev.leggedrobotics.com',
);
