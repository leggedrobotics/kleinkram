import axios from 'axios';
import ENV from 'src/env';
import env from 'src/env';
const axiosInstance = axios.create({
  baseURL: ENV.ENDPOINT,
  withCredentials: true,
  // Add more settings as needed
});

// axiosInstance.interceptors.response.use(
//   response => response,
//   async error => {
//     const originalRequest = error.config;
//     if (error.response.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true;
//       try {
//         const response = await axios.post(`${env.ENDPOINT}/auth/refresh-token`);
//         return axios(originalRequest);
//       } catch (refreshError) {
//         console.error('Refresh token error', refreshError);
//         // window.location.href = `${ENV.ENDPOINT}/auth/google`;
//       }
//     }
//     return Promise.reject(error);
//   }
// );

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}
export default axiosInstance;
