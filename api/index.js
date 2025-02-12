import axios from "axios"

const _axios = axios.create({
  baseURL: 'https://febweb002.com/',
  headers: {
    'Content-Type': 'application/json',
  },
});


const requestSuccessInterceptor = (config) => {
  // 附加认证头
  config.headers['x-auth'] = process.env.AVE_AUTH;
  return config;
}

_axios.interceptors.request.use(
  requestSuccessInterceptor,
)


export default _axios;
