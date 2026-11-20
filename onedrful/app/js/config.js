/* ONEDRFUL runtime config.
   USE_MOCK: true  -> everything runs on-device (localStorage). Works fully offline. Good for demo/testing.
   USE_MOCK: false -> calls your backend at API_BASE (see api/README.md). Writes made while offline are queued
                      in an outbox and sent automatically when the device reconnects. */
window.ONEDRFUL_CONFIG = {
  VERSION: '2.0.0',
  USE_MOCK: true,
  API_BASE: '/api',                     // e.g. 'https://api.onedrful.app' or '/api' on the same host
  LINK_BASE: 'https://onedrful.hunnyhive.app/r/', // public base for referral links + QR codes
  SUPPORT_EMAIL: 'support@onedrful.app'
};
