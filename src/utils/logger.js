/**
 * Production-ready formatted console logger.
 */
const LogLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG'
};

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const metaStr = meta && Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

const logger = {
  info: (message, meta) => {
    console.log(formatMessage(LogLevel.INFO, message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatMessage(LogLevel.WARN, message, meta));
  },
  error: (message, error) => {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack } 
      : error;
    console.error(formatMessage(LogLevel.ERROR, message, errorDetails));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage(LogLevel.DEBUG, message, meta));
    }
  }
};

module.exports = logger;
