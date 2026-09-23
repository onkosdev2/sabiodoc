import axios from 'axios'

import { clearStoredAuth, getStoredToken } from '../utils/authStorage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export { API_URL }

const client = axios.create({
  baseURL: API_URL,
})
// No fijamos `Content-Type` global: axios usa application/json para objetos y
// deja que el navegador ponga `multipart/form-data; boundary=...` en los FormData
// (subida de archivos).

client.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredAuth()
      window.dispatchEvent(new Event('sabiodoc:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export default client
