import axios from 'axios';
import ENV from 'src/env';
const axiosInstance = axios.create({
  baseURL: ENV.ENDPOINT,
  // Add more settings as needed
});

export default axiosInstance;
