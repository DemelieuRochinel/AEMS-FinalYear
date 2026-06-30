// const configuredApiUrl = import.meta.env.VITE_API_URL;
// const fallbackApiPort = import.meta.env.VITE_API_PORT || '5000';

// export const API_BASE_URL = configuredApiUrl
//   || `${window.location.protocol}//${window.location.hostname}:${fallbackApiPort}`;


const configuredApiUrl = import.meta.env.VITE_API_URL;

// If VITE_API_URL exists, use it. Otherwise, fall back directly to your PC's IP and backend port.
export const API_BASE_URL = configuredApiUrl || 'http://192.168.1.159:5000';
