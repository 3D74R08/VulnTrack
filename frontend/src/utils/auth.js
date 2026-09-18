export const getUserData = () => {
  const token = localStorage.getItem('vulntrack_token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const getUserRole = () => {
  const data = getUserData();
  return data ? data.rol : null;
};
