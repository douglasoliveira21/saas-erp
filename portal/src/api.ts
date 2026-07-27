import axios from 'axios'
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'/api',withCredentials:true})
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401&&!String(e.config?.url).includes('/public/'))localStorage.removeItem('portal_user');return Promise.reject(e)})
export const message=(e:any,fallback='Não foi possível concluir')=>Array.isArray(e.response?.data?.message)?e.response.data.message.join(', '):e.response?.data?.message||fallback
