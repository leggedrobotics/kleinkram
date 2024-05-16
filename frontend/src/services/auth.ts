export function isAuthenticated() {
  const token = localStorage.getItem('token');
  // You might want to add more checks to validate the token
  return !!token;
}

export function logout() {
  localStorage.removeItem('token');
}
