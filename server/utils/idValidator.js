/**
 * Validates a Kenyan National ID number
 * @param {string} id - The National ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateKenyanID(id) {
  // Check if it's exactly 9 digits
  if (!/^\d{9}$/.test(id)) {
    return false;
  }

  // Convert to array of digits
  const digits = id.split('').map(Number);

  // Checksum calculation for Kenyan ID
  // The last digit is a check digit
  const checkDigit = digits[8];
  const baseDigits = digits.slice(0, 8);

  // Multiply by weights (8,7,6,5,4,3,2,1)
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  let sum = 0;

  for (let i = 0; i < baseDigits.length; i++) {
    sum += baseDigits[i] * weights[i];
  }

  // Calculate check digit
  const remainder = sum % 11;
  const calculatedCheckDigit = remainder === 0 ? 0 : 11 - remainder;

  return calculatedCheckDigit === checkDigit;
}

/**
 * Generates a valid Kenyan National ID for testing purposes
 * @returns {string} - A valid 9-digit Kenyan ID
 */
function generateValidKenyanID() {
  // Generate first 8 digits randomly
  const baseDigits = [];
  for (let i = 0; i < 8; i++) {
    baseDigits.push(Math.floor(Math.random() * 10));
  }

  // Calculate check digit
  const weights = [8, 7, 6, 5, 4, 3, 2, 1];
  let sum = 0;

  for (let i = 0; i < baseDigits.length; i++) {
    sum += baseDigits[i] * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;

  return baseDigits.join('') + checkDigit;
}

module.exports = {
  validateKenyanID,
  generateValidKenyanID
};
