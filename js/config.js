/**
 * ====================================================================
 *  KONFIGURASI SIM KULIAH — WAJIB DIISI SEBELUM DEPLOY KE GITHUB PAGES
 * ====================================================================
 *  GAS_URL          : URL Web App Apps Script (berakhiran /exec)
 *                     Apps Script → Deploy → Manage deployments → salin "Web app URL"
 *  GOOGLE_CLIENT_ID : OAuth Client ID (jenis "Web application") dari Google Cloud Console.
 *                     Authorized JavaScript origins: https://USERNAME.github.io
 *                     (boleh dikosongkan bila sudah diisi di sheet Pengaturan → GOOGLE_CLIENT_ID)
 */
window.SIMK_CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbxNLpOi24fjzaGOmvnmdXOCcUuIf_Mo0id7qNADmX1s7E21se2RZImf-iUkeEzJRBUv/exec',
  GOOGLE_CLIENT_ID: '524055067564-dg7m3alnjbdf2nrgp7t74u0s3nadmr95.apps.googleusercontent.com',
  CACHE_VERSI: 'v1'
};
