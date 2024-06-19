import axios from 'src/api/axios';
import ENV from 'src/env';
import ROUTES from 'src/router/routes';


export const isAuthenticated = () =>
    axios
        .get('/user/me')
        .then(() => true)
        .catch(() => false);

export const getUser = () =>
    axios.get('/user/me')
        .then((response) => response.data)
        .catch(() => null);


export function logout() {
    return new Promise((resolve, reject) => {
        axios
            .post('/auth/logout')
            .then(() => {

                // reload the page to clear the cache
                window.location.reload();

            })
            .catch(() => reject(false));
    });
}


export const login = () => {
    window.location.href = `${ENV.ENDPOINT}/auth/google`;
};