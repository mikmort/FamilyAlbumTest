const sql = require('mssql');

const config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 15000, // 15 seconds
  },
  pool: {
    max: 10,
    min: 2, // Keep 2 connections alive to avoid cold starts
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

/**
 * Custom error class for database warmup scenarios
 */
class DatabaseWarmupError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DatabaseWarmupError';
    this.originalError = originalError;
    this.isWarmupError = true;
  }
}

/**
 * Check if an error indicates the database is warming up (serverless tier auto-resume)
 */
function isDatabaseWarmupError(error) {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  // Common patterns when database is auto-resuming from paused state
  const warmupIndicators = [
    'timeout',
    'etimeout',
    'econnrefused',
    'enotopen',
    'connection timeout',
    'connection is closed',
    'resource unavailable',
    'database.*is being brought online',
    'database.*is starting up',
    'database.*is resuming',
    'server.*is not currently available'
  ];
  
  return warmupIndicators.some(indicator => 
    errorMessage.includes(indicator) || errorCode.includes(indicator)
  );
}

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

/**
 * Execute a query with automatic retry for database warmup scenarios
 */
async function queryWithRetry(queryText, params, maxRetries = 3, retryDelay = 5000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const pool = await getPool();
      const request = pool.request();

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          request.input(key, value);
        });
      }

      const result = await request.query(queryText);
      return result.recordset;
    } catch (error) {
      lastError = error;
      
      // Check if this is a warmup error
      if (isDatabaseWarmupError(error)) {
        // Reset pool to force reconnection on next attempt
        if (pool) {
          try {
            await pool.close();
          } catch (closeError) {
            // Ignore close errors
          }
          pool = null;
        }
        
        // If not the last attempt, wait and retry
        if (attempt < maxRetries) {
          const waitTime = retryDelay * Math.pow(1.5, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Last attempt failed - throw warmup error
        throw new DatabaseWarmupError(
          'Database is warming up. Please wait a moment and try again.',
          error
        );
      }
      
      // Not a warmup error - throw immediately
      throw error;
    }
  }
  
  // Should not reach here, but just in case
  throw lastError;
}

async function query(queryText, params) {
  return queryWithRetry(queryText, params);
}

async function execute(queryText, params) {
  const pool = await getPool();
  const request = pool.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  return await request.query(queryText);
}

module.exports = { 
  query, 
  execute, 
  getPool, 
  sql,
  DatabaseWarmupError,
  isDatabaseWarmupError 
};
