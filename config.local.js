/*
 * Copy over config.js when working against a local API:
 *   cp config.local.js config.js
 * Keep config.js pointed at the deployed API so a deploy from a clean
 * checkout is correct by default.
 */
window.BU_ADMIN_CONFIG = {
  apiBaseUrl: 'http://localhost:3000/api/v1',
  institution: 'Bugema University',
  showBootstrap: true,
  defaultPageSize: 20,
};
