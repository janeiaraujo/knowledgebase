import { ObjectId } from 'mongodb';

/**
 * Safely convert string ID to MongoDB ObjectId
 * @param {string|ObjectId} id - The ID to convert
 * @returns {ObjectId|null} ObjectId or null if invalid
 */
export function toObjectId(id) {
  if (!id) return null;
  
  // Already an ObjectId
  if (id instanceof ObjectId) return id;
  
  // Convert string to ObjectId
  if (typeof id === 'string') {
    try {
      return new ObjectId(id);
    } catch (err) {
      return null;
    }
  }
  
  return null;
}

/**
 * Convert multiple IDs to ObjectIds
 * @param {Array<string|ObjectId>} ids - Array of IDs
 * @returns {Array<ObjectId>} Array of ObjectIds (invalid ones filtered out)
 */
export function toObjectIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map(toObjectId).filter(id => id !== null);
}

/**
 * Check if string is valid ObjectId format
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid ObjectId format
 */
export function isValidObjectId(id) {
  return ObjectId.isValid(id);
}
