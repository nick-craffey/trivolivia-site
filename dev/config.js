export const apiOrigin = 'https://social-us-central1-m1rif45.uc.gateway.dev';
const firebaseConfigUrl = `${apiOrigin}/api/v1/analytics/config`;
let apiKeyPromise;
export function getFirebaseApiKey() {
  apiKeyPromise ??= fetch(firebaseConfigUrl, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then((response) => { if (!response.ok) throw new Error('Dashboard sign-in has not been configured.'); return response.json(); })
    .then((config) => { if (typeof config.apiKey !== 'string' || !/^AIza[\w-]{30,}$/.test(config.apiKey)) throw new Error('Dashboard sign-in has not been configured.'); return config.apiKey; });
  return apiKeyPromise;
}
