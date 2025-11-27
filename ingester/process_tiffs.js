const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const HTTP = require('axios');

/**
 * Extracts the object name from the object path (everything after '/objects/')
 * @param {string} object_path - Full object path from compound_parts
 * @returns {string|null} - Object name or null if not found
 */
function extract_object_name(object_path) {
    if (!object_path || typeof object_path !== 'string') {
        return null;
    }

    const objects_index = object_path.indexOf('/objects/');
    if (objects_index === -1) {
        return null;
    }

    return object_path.substring(objects_index + '/objects/'.length);
}

/**
 * Fetches object records with compound_parts from database by SIP UUID
 * @param {string} sip_uuid - The SIP UUID to query
 * @returns {Promise<Array>} - Array of database records
 */
async function fetch_objects_by_sip_uuid(sip_uuid) {
    try {
        const records = await DB(DB_TABLES.repo.repo_objects)
            .select('pid', 'compound_parts')
            .where({ pid: sip_uuid });

        return records;
    } catch (error) {
        console.error('Database query error:', error.message);
        throw error;
    }
}

/**
 * Parses compound_parts field and returns array of objects
 * @param {string|Array} compound_parts - The compound_parts field from database
 * @returns {Array} - Parsed array of objects
 */
function parse_compound_parts(compound_parts) {
    try {
        // If already an array, return it
        if (Array.isArray(compound_parts)) {
            return compound_parts;
        }

        // If string, parse JSON
        if (typeof compound_parts === 'string') {
            return JSON.parse(compound_parts);
        }

        // If null or undefined, return empty array
        return [];
    } catch (error) {
        console.error('Error parsing compound_parts:', error.message);
        return [];
    }
}

/**
 * Posts a single object to the API endpoint
 * @param {object} payload - The POST body payload
 * @param {string} api_url - API endpoint URL
 * @returns {Promise<object>} - API response
 */
async function post_object_to_api(payload, api_url) {
    console.log('PAYLOAD ', payload);
    try {
        const response = await HTTP.post(api_url, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        return response.data;
    } catch (error) {
        if (error.response) {
            // API responded with error status
            console.error(`API error (${error.response.status}):`, error.response.data);
        } else if (error.request) {
            // No response received
            console.error('No response from API:', error.message);
        } else {
            // Request setup error
            console.error('Request error:', error.message);
        }
        throw error;
    }
}

/**
 * Processes compound_parts and posts objects to API with rate limiting
 * @param {string} sip_uuid - The SIP UUID to process
 * @param {string} api_url - API endpoint URL
 * @param {number} interval_ms - Interval between posts in milliseconds (default: 30000)
 * @returns {Promise<object>} - Summary of processing results
 */
async function process_and_post_objects(sip_uuid, api_url, interval_ms = 30000) {
    const results = {
        total: 0,
        successful: 0,
        failed: 0,
        errors: []
    };

    try {
        // Fetch record from database
        const records = await fetch_objects_by_sip_uuid(sip_uuid);

        if (records.length === 0) {
            console.log('No records found for SIP UUID:', sip_uuid);
            return results;
        }

        // Process the first record (assuming one record per SIP UUID)
        const record = records[0];

        // Parse compound_parts
        const compound_parts = parse_compound_parts(record.compound_parts);

        if (compound_parts.length === 0) {
            console.log('No compound_parts found for SIP UUID:', sip_uuid);
            return results;
        }

        results.total = compound_parts.length;
        console.log(`Processing ${compound_parts.length} object(s) for SIP UUID: ${sip_uuid}`);

        // Process each object in compound_parts with interval delay
        for (let i = 0; i < compound_parts.length; i++) {
            const part = compound_parts[i];

            // Validate required fields
            if (!part.object || !part.type) {
                console.error(`Missing required fields in compound_part at index ${i}:`, part);
                results.failed++;
                results.errors.push({
                    index: i,
                    order: part.order,
                    error: 'Missing object or type field'
                });
                continue;
            }

            // Extract object name from object path
            const object_name = extract_object_name(part.object);

            if (!object_name) {
                console.error(`Failed to extract object_name from: ${part.object}`);
                results.failed++;
                results.errors.push({
                    index: i,
                    order: part.order,
                    error: 'Invalid object path format'
                });
                continue;
            }

            // Construct POST payload
            const payload = {
                sip_uuid: record.pid,
                full_path: part.object,
                object_name: object_name,
                mime_type: part.type
            };

            try {
                // Post to API
                await post_object_to_api(payload, api_url);
                results.successful++;
                console.log(`[${i + 1}/${compound_parts.length}] Successfully posted: ${object_name}`);
            } catch (error) {
                results.failed++;
                results.errors.push({
                    index: i,
                    order: part.order,
                    object_name: object_name,
                    error: error.message
                });
                console.error(`[${i + 1}/${compound_parts.length}] Failed to post: ${object_name}`);
            }

            // Wait for interval before next request (except for last item)
            if (i < compound_parts.length - 1) {
                console.log(`Waiting ${interval_ms / 1000} seconds before next request...`);
                await delay(interval_ms);
            }
        }

        console.log(`Processing complete. Success: ${results.successful}, Failed: ${results.failed}`);
        return results;

    } catch (error) {
        console.error('Fatal error during processing:', error.message);
        throw error;
    }
}

/**
 * Utility function to add delay between operations
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    extract_object_name,
    fetch_objects_by_sip_uuid,
    parse_compound_parts,
    post_object_to_api,
    process_and_post_objects,
    delay
};
