/**
 * Wraps asynchronous route handlers to eliminate try-catch boilerplate.
 * @param {Function} requestHandler
 * @returns {Function} Express middleware handler
 */
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

module.exports = asyncHandler;
