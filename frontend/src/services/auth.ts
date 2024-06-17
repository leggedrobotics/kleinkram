import axios from 'src/api/axios';
import ENV from 'src/env';
import ROUTES from 'src/router/routes';
import { routerInstance } from 'boot/router';


export const isAuthenticated = () =>
    axios
        .get('/user/me')
        .then(() => true)
        .catch(() => false);


export function logout() {
    return new Promise((resolve, reject) => {
        axios
            .post('/auth/logout')
            .then(() => {

                routerInstance.push(ROUTES.HOME.path)
                    .then(() => resolve(true));

            })
            .catch(() => reject(false));
    });
}


export const login = () => {
    window.location.href = `${ENV.ENDPOINT}/auth/google`;
};