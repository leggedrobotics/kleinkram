import axios from 'axios';
import ENV from 'src/env';
import env from 'src/env';

const axiosInstance = axios.create({
    baseURL: ENV.ENDPOINT,
    withCredentials: true,
    // Add more settings as needed
});

export const kleinkramVersion: {
    version: string | undefined;
} = { version: undefined };

axiosInstance.interceptors.response.use(
    (response) => {
        const headers = response.headers;
        if (headers['kleinkram-version']) {
            kleinkramVersion.version = headers['kleinkram-version'];
            console.log('kleinkramVersion', kleinkramVersion);
        }
        return response;
    },
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
