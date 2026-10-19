/*
 * Runtime configuration. This file is deliberately NOT bundled or compiled —
 * edit it on the server (or mount it into the container) to point the console
 * at a different API without rebuilding anything.
 *
 * SECURITY: everything in this file is downloaded by every visitor's browser.
 * It holds no secrets and must never hold any. The API's environment
 * variables — DATABASE_URL, the JWT keys, MFA_ENCRYPTION_KEY,
 * PAYMENT_WEBHOOK_SECRET, the S3 credentials — belong only on the API host.
 * The console needs none of them: it authenticates as a person, with that
 * person's own password, and receives a short-lived token like any client.
 */
window.BU_ADMIN_CONFIG = {
  /**
   * Base URL of the API, including the version prefix and no trailing slash.
   *
   *   Deployed API:  'https://bu-app-t9gy.onrender.com/api/v1'
   *   Local API:     'http://localhost:3000/api/v1'
   *   Same-origin:   '/api/v1'   (console served behind the same host or a
   *                               rewrite rule as the API — no CORS at all)
   *
   * Whichever absolute URL you use here must also appear in the API's
   * CORS_ORIGIN, or the browser blocks every request. See README.md.
   */
  apiBaseUrl: 'https://bu-app-t9gy.onrender.com/api/v1',

  /** Shown in the sidebar header. */
  institution: 'Bugema University',

  /**
   * Show the "first-run setup" link on the login screen, which calls
   * POST /auth/bootstrap-admin with the x-bootstrap-secret header. Turn this
   * off once the first SUPER_ADMIN exists.
   */
  showBootstrap: false,

  /** Rows per page in list views. The API caps this at 100. */
  defaultPageSize: 20,
};
