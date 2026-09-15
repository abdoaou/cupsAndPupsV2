class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  // Surface real errors on Vercel so deploy/DB issues are visible in the browser.
  const message = err.message || 'Request failed';

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    message,
    code: err.code || undefined,
  });
}

module.exports = { HttpError, asyncHandler, errorHandler };
