import axios from 'axios';
import ENV from 'src/env';
import env from 'src/env';
import {isLoggedIn, loggedIn} from 'src/services/auth';
const axiosInstance = axios.create({
  baseURL: ENV.ENDPOINT,
  withCredentials: true,
  // Add more settings as needed
});

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const response = await axios.post(`${env.ENDPOINT}/auth/refresh-token`, {}, { withCredentials: true });
        loggedIn.value = isLoggedIn();

        return axios(originalRequest);
      } catch (refreshError) {
        loggedIn.value = isLoggedIn();

        console.error('Refresh token error', refreshError);
        window.location.href = `${ENV.ENDPOINT}/auth/google?state=web`;
      }
    }
    return Promise.reject(error);
  }
);

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}
export default axiosInstance;
