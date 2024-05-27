import { jwtDecode } from 'jwt-decode';
import { ref } from 'vue';
import axios from 'src/api/axios';
function getCookie(name: string) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return null;
}

// Function to check if the JWT token is valid
export function isTokenValid(token: string) {
    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000; // Current time in seconds
        if (decoded.exp && decoded.exp < currentTime) {
            return false; // Token has expired
        }
        return true; // Token is valid
    } catch (error) {
        return false; // Error decoding token
    }
}

// Function to check if the user is logged in
export function isLoggedIn() {
    const token = getCookie('authtoken');
    if (token && isTokenValid(token)) {
        return true;
    } else {
        return false;
    }
}
export const loggedIn = ref(false);

export function logout() {
    return new Promise((resolve, reject) => {
        axios
            .post('/auth/logout')
            .then(() => {
                resolve(true);
                loggedIn.value = false;
            })
            .catch(() => {
                reject(false);
            });
    });
}
