import axios from 'axios';
import ENV from 'src/env';
import * as process from 'process';
const axiosInstance = axios.create({
  baseURL: ENV.ENDPOINT,
  // Add more settings as needed
});

export default axiosInstance;
