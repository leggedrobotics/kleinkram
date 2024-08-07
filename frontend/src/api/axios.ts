import axios from 'axios';
import ENV from 'src/env';
import env from 'src/env';

const axiosInstance = axios.create({
    baseURL: ENV.ENDPOINT,
    withCredentials: true,
    // Add more settings as needed
});

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            await axios.post(
                `${env.ENDPOINT}/auth/refresh-token`,
                {},
                { withCredentials: true },
            );
            return axios(originalRequest);
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
