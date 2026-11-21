/** Retry a write once when a concurrent insert wins the same unique-key race. */

function isDuplicateKeyError(error) {
  return !!error && (error.code === 11000 || error.code === 11001);
}

async function retryOnDuplicate(operation, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isDuplicateKeyError(error) || attempt === Math.max(1, attempts) - 1) throw error;
    }
  }
  throw lastError;
}

module.exports = { retryOnDuplicate, isDuplicateKeyError };
