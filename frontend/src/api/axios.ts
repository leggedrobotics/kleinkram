import axios from 'axios';
import ENV from 'src/env';
const axiosInstance = axios.create({
  baseURL: ENV.ENDPOINT,
  withCredentials: true,
  // Add more settings as needed
});

export default axiosInstance;
