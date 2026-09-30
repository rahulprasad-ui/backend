/**
 * Utility for formatting consistent API response payloads.
 */
const formatResponse = (success, data = null, message = '') => ({
  success: Boolean(success),
  data,
  message: message || (success ? 'Operation completed successfully.' : 'Operation failed.')
});

module.exports = {
  formatResponse
};
