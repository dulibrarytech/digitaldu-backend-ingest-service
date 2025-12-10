/**

 Copyright 2025 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

'use strict';

const HTTP = require('axios');
const CONFIG = require('../config/webservices_config')();
const ARCHIVESSPACE_CONFIG = require('../config/archivesspace_config')();
const ARCHIVESSPACE = require('../libs/archivesspace');
const LOGGER = require('../libs/log4');

// ============================================================================
// CONSTANTS
// ============================================================================

const KALTURA_MEDIA_EXTENSIONS = [
    '.wav', '.mp3', '.mp4', '.mov',
    '.mkv', '.avi', '.m4v', '.flac',
    '.ogg', '.webm', '.wmv'
];

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const LONG_TIMEOUT = 3600000;  // 1 hour

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitizes error messages to remove sensitive information.
 *
 * @param {string} message - The error message to sanitize
 * @returns {string} Sanitized error message
 */
function sanitize_error_message(message) {
    if (!message || typeof message !== 'string') {
        return 'Unknown error';
    }

    return message
        .replace(/api_key=[^&\s]+/gi, 'api_key=****')
        .replace(/password[=:]\s*[^\s&]+/gi, 'password=****')
        .replace(/token[=:]\s*[^\s&]+/gi, 'token=****')
        .replace(/authorization[=:]\s*[^\s]+/gi, 'authorization=****')
        .replace(/\/[\w\/.-]+/g, '[PATH]')
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
        .substring(0, 500);
}

/**
 * Validates a single URI string.
 *
 * @param {*} uri - The URI to validate
 * @param {number} index - The index of the URI in the array (for error messages)
 * @returns {Object} - Validation result with valid flag, sanitized uri, or error message
 */
function validate_uri(uri, index) {
    if (uri === null || uri === undefined) {
        return {
            valid: false,
            error: `URI at index ${index} is null or undefined`
        };
    }

    if (typeof uri !== 'string') {
        return {
            valid: false,
            error: `URI at index ${index} is not a string (got ${typeof uri})`
        };
    }

    const trimmed_uri = uri.trim();

    if (trimmed_uri.length === 0) {
        return {
            valid: false,
            error: `URI at index ${index} is empty`
        };
    }

    if (!trimmed_uri.startsWith('/repositories/')) {
        return {
            valid: false,
            error: `URI at index ${index} has invalid format: ${trimmed_uri.substring(0, 50)}`
        };
    }

    if (trimmed_uri.includes('..') || trimmed_uri.includes('//')) {
        return {
            valid: false,
            error: `URI at index ${index} contains invalid path sequences`
        };
    }

    const uri_pattern = /^\/repositories\/\d+\/(archival_objects|resources|digital_objects)\/\d+$/;
    if (!uri_pattern.test(trimmed_uri)) {
        LOGGER.module().debug('DEBUG: [/astools/service (validate_uri)] URI does not match expected pattern', {
            uri: trimmed_uri,
            index: index
        });
    }

    return {
        valid: true,
        uri: trimmed_uri
    };
}

/**
 * Extracts and validates files from result data.
 *
 * @param {Object} result_data - The result data object
 * @returns {Array<string>} - Array of validated file names
 */
function extract_files(result_data) {
    if (!result_data || !result_data.files) {
        return [];
    }

    if (Array.isArray(result_data.files)) {
        return result_data.files
            .filter(file => file && typeof file === 'string' && file.trim().length > 0)
            .map(file => file.trim());
    }

    if (typeof result_data.files === 'string' && result_data.files.trim().length > 0) {
        return [result_data.files.trim()];
    }

    return [];
}

/**
 * Extracts and validates URIs from result data.
 *
 * @param {Object} result_data - The result data object
 * @returns {Object} - Object containing validated uris array and validation_errors array
 */
function extract_uris(result_data) {
    const uris = [];
    const validation_errors = [];

    if (!result_data) {
        return { uris, validation_errors };
    }

    if (result_data.uris) {
        const uris_source = Array.isArray(result_data.uris)
            ? result_data.uris
            : [result_data.uris];

        uris_source.forEach((uri, index) => {
            const validation_result = validate_uri(uri, index);
            if (validation_result.valid) {
                uris.push(validation_result.uri);
            } else {
                validation_errors.push(validation_result.error);
            }
        });
    }

    if (uris.length === 0) {
        const legacy_uri = result_data.uri || result_data.metadata_uri;
        if (legacy_uri) {
            const validation_result = validate_uri(legacy_uri, 0);
            if (validation_result.valid) {
                uris.push(validation_result.uri);
            } else {
                validation_errors.push(validation_result.error);
            }
        }
    }

    return { uris, validation_errors };
}

/**
 * Parses metadata errors which may be in various formats.
 *
 * @param {*} errors - The errors to parse (string, array, or JSON string)
 * @returns {Array<string>} - Array of error messages
 */
function parse_metadata_errors(errors) {
    if (!errors) {
        return [];
    }

    if (Array.isArray(errors)) {
        return errors.filter(e => e && typeof e === 'string' && e.trim().length > 0);
    }

    if (typeof errors === 'string') {
        try {
            const parsed = JSON.parse(errors);
            if (Array.isArray(parsed)) {
                return parsed.filter(e => e && typeof e === 'string' && e.trim().length > 0);
            }
            return [String(parsed)];
        } catch (e) {
            return errors.trim().length > 0 ? [errors.trim()] : [];
        }
    }

    return [String(errors)];
}

/**
 * Handles request errors with consistent formatting.
 *
 * @param {Error} error - The error object
 * @param {string} function_name - Name of the function where error occurred
 * @param {Object} context - Additional context for logging
 * @returns {Object} - Standardized error response
 */
function handle_request_error(error, function_name, context = {}) {
    const error_details = {
        error: error.message,
        ...context
    };

    let error_message = 'An error occurred';

    if (error.response) {
        error_details.status = error.response.status;
        error_details.status_text = error.response.statusText;
        error_message = `API error: ${error.response.status} - ${error.response.statusText}`;
        LOGGER.module().error(`ERROR: [/astools/service (${function_name})] API response error`, error_details);
    } else if (error.request) {
        error_details.request = 'No response received';

        if (error.code === 'ECONNREFUSED') {
            error_message = 'Unable to connect to ASTools service';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            error_message = 'Request to ASTools service timed out';
        } else if (error.code === 'ENOTFOUND') {
            error_message = 'ASTools service host not found';
        } else if (error.code === 'ECONNRESET') {
            error_message = 'Connection to ASTools service was reset';
        } else {
            error_message = 'No response received from ASTools service';
        }

        LOGGER.module().error(`ERROR: [/astools/service (${function_name})] No response from API`, error_details);
    } else {
        error_details.stack = error.stack;
        LOGGER.module().error(`ERROR: [/astools/service (${function_name})] Request setup error`, error_details);
    }

    return {
        errors: [error_message + ': ' + sanitize_error_message(error.message)],
        result: null
    };
}

/**
 * Detects if packages contain Kaltura media files.
 *
 * @param {Array} packages - Array of package objects
 * @returns {boolean} - True if media files detected
 */
function detect_kaltura_media(packages) {
    if (!Array.isArray(packages) || packages.length === 0) {
        return false;
    }

    for (const pkg of packages) {
        if (!pkg || typeof pkg !== 'object' || !Array.isArray(pkg.files)) {
            continue;
        }

        for (const file of pkg.files) {
            if (!file || typeof file !== 'string') {
                continue;
            }

            const file_lower = file.toLowerCase();
            if (KALTURA_MEDIA_EXTENSIONS.some(ext => file_lower.endsWith(ext))) {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// METADATA VALIDATION HELPERS
// ============================================================================

/**
 * Validates required string fields.
 */
function validate_required_field(errors, field, error_message) {
    if (!field || (typeof field === 'string' && field.trim().length === 0)) {
        errors.push(error_message);
    }
}

/**
 * Validates required array fields.
 */
function validate_required_array(errors, field, error_message) {
    if (!Array.isArray(field) || field.length === 0) {
        errors.push(error_message);
    }
}

/**
 * Validates notes array for abstract and rights statement.
 */
function validate_notes(errors, notes) {
    if (!notes) {
        errors.push('Notes field is missing - The notes field contains the abstract and rights statement');
        return;
    }

    let notes_array = notes;

    if (!Array.isArray(notes) && typeof notes === 'object' && Array.isArray(notes.notes)) {
        notes_array = notes.notes;
    }

    if (typeof notes === 'string') {
        try {
            notes_array = JSON.parse(notes);
        } catch (e) {
            errors.push('Notes field is invalid - Unable to parse notes data');
            return;
        }
    }

    if (!Array.isArray(notes_array) || notes_array.length === 0) {
        errors.push('Notes field is missing - The notes field contains the abstract and rights statement');
        return;
    }

    let has_abstract = false;
    let has_rights = false;
    let abstract_is_empty = false;
    let rights_is_empty = false;

    for (const note of notes_array) {
        if (!note || typeof note !== 'object') {
            continue;
        }

        if (note.type === 'abstract') {
            has_abstract = true;
            if (typeof note.content === 'string') {
                abstract_is_empty = note.content.trim().length === 0;
            } else if (Array.isArray(note.content)) {
                abstract_is_empty = note.content.length === 0;
            } else {
                abstract_is_empty = true;
            }
        }

        if (note.type === 'userestrict') {
            has_rights = true;
            if (typeof note.content === 'string') {
                rights_is_empty = note.content.trim().length === 0;
            } else if (Array.isArray(note.content)) {
                rights_is_empty = note.content.length === 0;
            } else {
                rights_is_empty = true;
            }
        }
    }

    if (has_abstract && abstract_is_empty) {
        errors.push('Abstract field is missing');
    }

    if (has_rights && rights_is_empty) {
        errors.push('Rights statement field is missing');
    }
}

/**
 * Validates dates array.
 */
function validate_dates(errors, dates) {
    if (!Array.isArray(dates)) {
        return;
    }

    for (const date of dates) {
        if (!date || typeof date !== 'object') {
            continue;
        }

        if (!date.expression || (typeof date.expression === 'string' && date.expression.trim().length === 0)) {
            errors.push('Date expression is missing');
        }
    }
}

/**
 * Validates parts array.
 */
function validate_parts(errors, parts, is_compound) {
    if (is_compound === true) {
        if (!Array.isArray(parts) || parts.length < 2) {
            errors.push('Compound objects must have at least 2 parts');
        }
    }

    if (!Array.isArray(parts) || parts.length === 0) {
        errors.push('Parts is missing');
        return;
    }

    for (const part of parts) {
        if (!part || typeof part !== 'object') {
            continue;
        }

        if (!part.type || (typeof part.type === 'string' && part.type.trim().length === 0)) {
            const part_title = part.title || 'Unknown part';
            errors.push(`Mime-type is missing (${part_title})`);
        }
    }
}

/**
 * Cleans up ArchivesSpace session.
 */
async function cleanup_session(archivesspace_lib, token) {
    try {
        if (!token) {
            return;
        }

        const result = await archivesspace_lib.destroy_session_token(token);

        if (result && result.data && result.data.status === 'session_logged_out') {
            LOGGER.module().info('INFO: [/astools/service] ArchivesSpace session terminated');
        }
    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service] Failed to cleanup session', {
            error: error.message
        });
    }
}

// ============================================================================
// INTERNAL FUNCTIONS
// ============================================================================

/**
 * Gets package files for a batch (callback-based for legacy support).
 */
function get_package_files(package_name, callback) {
    (async function () {
        try {
            const api_key = encodeURIComponent(CONFIG.astools_service_api_key);
            const encoded_package = encodeURIComponent(package_name);
            const astools_url = `${CONFIG.astools_service}workspace/packages/files?package_name=${encoded_package}&api_key=${api_key}`;

            const response = await HTTP.get(astools_url, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: DEFAULT_TIMEOUT
            });

            if (response.status === 200) {
                callback(response.data);
            } else {
                callback({ errors: [`Request failed with status ${response.status}`], result: null });
            }
        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (get_package_files)]', { error: error.message });
            callback({ errors: [error.message], result: null });
        }
    })();
}

/**
 * Promisifies get_package_files for async/await usage.
 */
function promisify_get_package_files(package_name) {
    return new Promise((resolve, reject) => {
        try {
            get_package_files(package_name, (response) => {
                if (response !== undefined && response !== null) {
                    resolve(response);
                } else {
                    resolve({ errors: ['Empty response from get_package_files'], result: null });
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Processes a single batch.
 */
async function process_single_batch(batch_name) {

    try {

        if (!batch_name || typeof batch_name !== 'string' || batch_name.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (process_single_batch)] Invalid batch name');
            return { errors: ['Invalid batch name'], result: null };
        }

        const response = await promisify_get_package_files(batch_name.trim());

        if (!response || typeof response !== 'object') {
            return { errors: ['Invalid response from get_package_files'], result: null };
        }

        if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (process_single_batch)] Errors processing batch', {
                batch_name: batch_name,
                errors: response.errors
            });
            return response;
        }

        if (!response.result || typeof response.result !== 'object') {
            return { errors: ['Invalid result structure'], result: null };
        }

        const is_kaltura = detect_kaltura_media(response.result.packages);
        response.result.is_kaltura = is_kaltura;

        LOGGER.module().info('INFO: [/astools/service (process_single_batch)] Batch processed successfully', {
            batch_name: batch_name,
            is_kaltura: is_kaltura
        });

        return response;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (process_single_batch)] Error processing batch', {
            batch_name: batch_name,
            error: error.message
        });

        return { errors: [`Error processing batch: ${error.message}`], result: null };
    }
}

/**
 * Processes batches in parallel.
 */
async function process_batches_parallel(batches) {
    const results = await Promise.allSettled(batches.map(batch_name => process_single_batch(batch_name)));

    const package_files = [];

    for (let i = 0; i < results.length; i++) {
        const result = results[i];

        if (result.status === 'fulfilled' && result.value) {
            package_files.push(result.value);
        } else if (result.status === 'rejected') {
            LOGGER.module().error('ERROR: [/astools/service (process_batches_parallel)] Failed to process batch', {
                batch_index: i,
                error: result.reason?.message
            });

            package_files.push({
                errors: [`Failed to process batch: ${result.reason?.message || 'Unknown error'}`],
                result: null
            });
        }
    }

    return package_files;
}

/**
 * Retrieves and validates metadata URIs for a specific package.
 */
async function get_metadata_uri(folder_name, archival_package) {

    try {

        if (!folder_name || typeof folder_name !== 'string' || folder_name.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid folder_name parameter');
            return { errors: ['Invalid folder_name parameter'], result: null };
        }

        if (!archival_package || typeof archival_package !== 'string' || archival_package.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid archival_package parameter');
            return { errors: ['Invalid archival_package parameter'], result: null };
        }

        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Missing service configuration');
            return { errors: ['Service configuration is missing'], result: null };
        }

        const safe_folder_name = folder_name.trim();
        const safe_package_name = archival_package.trim();

        LOGGER.module().info('INFO: [/astools/service (get_metadata_uri)] Retrieving metadata URIs', {
            folder: safe_folder_name,
            package: safe_package_name
        });

        const encoded_folder = encodeURIComponent(safe_folder_name);
        const encoded_package = encodeURIComponent(safe_package_name);
        const encoded_api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}workspace/uri?folder=${encoded_folder}&package=${encoded_package}&api_key=${encoded_api_key}`;
        console.log('URI ENDPOINT ', astools_url);
        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: DEFAULT_TIMEOUT
        });
        console.log('URI RESPONSE ', response);
        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid response from API', {
                status: response?.status,
                folder: safe_folder_name,
                package: safe_package_name
            });

            return { errors: [`API request failed with status ${response?.status || 'unknown'}`], result: null };
        }

        if (!response.data || typeof response.data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid response data structure');
            return { errors: ['Invalid response data structure from API'], result: null };
        }

        if (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_metadata_uri)] Errors returned from API', {
                errors: response.data.errors
            });
            return { errors: response.data.errors, result: null };
        }

        const result_data = response.data.result || response.data;
        const files = extract_files(result_data);
        const { uris, validation_errors } = extract_uris(result_data);

        if (validation_errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_metadata_uri)] Some URIs failed validation', {
                validation_errors: validation_errors
            });
        }

        if (uris.length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_metadata_uri)] No valid URIs found in response');

            return {
                errors: ['No valid metadata URIs found'],
                result: { files: files, uris: [], uri_count: 0, file_count: files.length }
            };
        }

        LOGGER.module().info('INFO: [/astools/service (get_metadata_uri)] Metadata URIs retrieved successfully', {
            uri_count: uris.length,
            file_count: files.length
        });

        return {
            errors: validation_errors,
            result: { files: files, uris: uris, uri_count: uris.length, file_count: files.length }
        };

    } catch (error) {
        return handle_request_error(error, 'get_metadata_uri', {
            folder: folder_name,
            package: archival_package
        });
    }
}

/**
 * Processes metadata for a URI.
 */
async function process_metadata(uri) {

    try {

        if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
            return { errors: ['Invalid URI parameter'] };
        }

        const ARCHIVESSPACE_LIB = new ARCHIVESSPACE(ARCHIVESSPACE_CONFIG);
        const token = await ARCHIVESSPACE_LIB.get_session_token();
        const errors = [];

        LOGGER.module().info('INFO: [/astools/service (process_metadata)] Checking record', { uri });

        const record = await ARCHIVESSPACE_LIB.get_record(uri, token);

        if (!record || record === false) {
            await cleanup_session(ARCHIVESSPACE_LIB, token);
            return { errors: ['Record not found.'] };
        }

        const metadata = record.metadata || {};

        validate_required_field(errors, metadata.title, 'Title field is missing');
        validate_required_field(errors, metadata.uri, 'URI field is missing');
        validate_required_array(errors, metadata.identifiers, 'Identifier field is missing');
        validate_notes(errors, metadata.notes);
        validate_dates(errors, metadata.dates);
        validate_parts(errors, metadata.parts, metadata.is_compound);

        if (errors.length > 0) {
            metadata.errors = JSON.stringify(errors);
        }

        await cleanup_session(ARCHIVESSPACE_LIB, token);

        return metadata;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (process_metadata)] Unable to process metadata', {
            error: error.message,
            stack: error.stack
        });
        return { errors: ['An error occurred while processing metadata: ' + error.message] };
    }
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Retrieves workspace packages.
 */
exports.get_workspace_packages = async function () {

    try {

        LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] Retrieving workspace packages');

        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Missing service configuration');
            return [];
        }

        const api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}workspace?api_key=${api_key}`;

        const response = await HTTP.get(astools_url, {
            headers: { 'Content-Type': 'application/json' },
            timeout: DEFAULT_TIMEOUT
        });

        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Invalid response from workspace API');
            return [];
        }

        if (!response.data || typeof response.data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Invalid response data structure');
            return [];
        }

        if (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_workspace_packages)] Errors returned from workspace API', {
                errors: response.data.errors
            });
            return [];
        }

        const batches = response.data.result;

        if (!Array.isArray(batches) || batches.length === 0) {
            LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] No batches found in workspace');
            return [];
        }

        LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] Processing batches', {
            batch_count: batches.length
        });

        const package_files = await process_batches_parallel(batches);

        LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] Workspace packages retrieved successfully', {
            total_packages: package_files.length,
            successful: package_files.filter(p => !p.errors || p.errors.length === 0).length
        });

        return package_files;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Unable to retrieve workspace packages', {
            error: error.message,
            stack: error.stack
        });
        return [];
    }
};

/**
 * Creates digital objects in ArchivesSpace via the ASTools web service.
 */
exports.make_digital_objects = async function (args) {

    try {

        if (!args || typeof args !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid args parameter');
            return { result: null, errors: ['Invalid arguments provided'] };
        }

        if (!args.folder || typeof args.folder !== 'string' || args.folder.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid folder parameter');
            return { result: null, errors: ['Invalid folder parameter: folder is required'] };
        }

        const folder = args.folder.trim();
        if (folder.includes('..') || folder.startsWith('/') || folder.startsWith('\\')) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid folder path detected', { folder });
            return { result: null, errors: ['Invalid folder parameter: path traversal not allowed'] };
        }

        let is_kaltura_value = 0;
        if (args.is_kaltura === true || args.is_kaltura === 1 || args.is_kaltura === '1') {
            is_kaltura_value = 1;
        }

        const packages = Array.isArray(args.packages) ? args.packages : [];
        const files = Array.isArray(args.files) ? args.files : [];

        if (is_kaltura_value === 1 && files.length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Files required when is_kaltura is enabled');
            return { result: null, errors: ['Invalid files parameter: files are required when is_kaltura is enabled'] };
        }

        // Normalize file entries
        const normalized_files = files.map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return entry;
            }

            if (entry.file && typeof entry.file === 'string') {
                return entry;
            }

            const file_value = entry.filename || entry.fileName || entry.name || entry.file_name || null;

            if (file_value && typeof file_value === 'string') {
                return { ...entry, file: file_value };
            }

            return entry;
        });

        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Missing service configuration');
            return { result: null, errors: ['Service configuration is missing'] };
        }

        const no_caption = args.no_caption !== undefined ? Boolean(args.no_caption) : true;
        const no_publish = args.no_publish !== undefined ? Boolean(args.no_publish) : false;
        const use_test_server = args.test !== undefined ? Boolean(args.test) : false;
        const verbose = args.verbose !== undefined ? Boolean(args.verbose) : false;

        LOGGER.module().info('INFO: [/astools/service (make_digital_objects)] Creating digital objects', {
            folder: folder,
            package_count: packages.length,
            file_count: files.length,
            is_kaltura: is_kaltura_value === 1
        });

        const api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const base_url = CONFIG.astools_service.endsWith('/') ? CONFIG.astools_service : CONFIG.astools_service + '/';
        const astools_url = `${base_url}make-digital-objects?api_key=${api_key}`;

        const payload = {
            data: {
                folder: folder,
                packages: packages,
                files: normalized_files,
                is_kaltura: is_kaltura_value,
                no_caption: no_caption,
                no_publish: no_publish,
                test: use_test_server,
                verbose: verbose
            }
        };

        const timeout_ms = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : LONG_TIMEOUT;

        const response = await HTTP.post(astools_url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: timeout_ms,
            validateStatus: (status) => status >= 200 && status < 600
        });

        if (!response) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] No response received from API');
            return { result: null, errors: ['No response received from API'] };
        }

        const status = response.status;
        const response_data = response.data;

        // Handle specific HTTP status codes
        if (status === 401) {
            return { result: null, errors: response_data?.errors || ['Authentication failed: Invalid API key'] };
        }
        if (status === 403) {
            return { result: null, errors: response_data?.errors || ['Access forbidden: Path traversal or permission denied'] };
        }
        if (status === 404) {
            return { result: null, errors: response_data?.errors || [`Folder not found: ${folder}`] };
        }
        if (status === 400) {
            return { result: null, errors: response_data?.errors || ['Bad request: Invalid parameters'] };
        }
        if (status === 504) {
            return { result: null, errors: response_data?.errors || ['Request timed out: Processing took too long'] };
        }
        if (status >= 500) {
            if (response_data?.result) {
                return { result: response_data.result, errors: response_data.errors || [`Server error: ${status}`] };
            }
            return { result: null, errors: response_data?.errors || [`Server error: ${status}`] };
        }

        if (!response_data || typeof response_data !== 'object') {
            return { result: null, errors: ['Invalid response data structure from API'] };
        }

        const result = response_data.result || null;
        const errors = Array.isArray(response_data.errors) ? response_data.errors : [];

        if (errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (make_digital_objects)] Errors returned from API', { errors, folder });
            return { result: result, errors: errors };
        }

        const is_successful = result && result.success === true;

        if (is_successful) {
            LOGGER.module().info('INFO: [/astools/service (make_digital_objects)] Digital objects created successfully', {
                folder: folder,
                log_file: result.log_file
            });
        }

        return { result: result, errors: errors };

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Unable to make digital objects', {
            error: error.message,
            folder: args?.folder
        });

        if (error.response?.data?.errors) {
            return { result: error.response.data?.result || null, errors: error.response.data.errors };
        }

        return handle_request_error(error, 'make_digital_objects', { folder: args?.folder });
    }
};

/**
 * Checks URI text files via ASTools service.
 */
exports.check_uri_txt = async function (batch) {

    try {

        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Invalid batch parameter');
            return { success: false, exists: false, errors: ['Invalid batch parameter'] };
        }

        const batch_name = batch.trim();

        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Missing service configuration');
            return { success: false, exists: false, errors: ['Service configuration is missing'] };
        }

        LOGGER.module().info('INFO: [/astools/service (check_uri_txt)] Checking URI text file', { batch: batch_name });

        const encoded_folder = encodeURIComponent(batch_name);
        const encoded_api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}check-uri-txt?folder=${encoded_folder}&api_key=${encoded_api_key}`;

        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: DEFAULT_TIMEOUT
        });

        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Invalid response from API', {
                status: response?.status,
                batch: batch_name
            });

            return { success: false, exists: false, errors: [`API request failed with status ${response?.status || 'unknown'}`] };
        }

        if (!response.data || typeof response.data !== 'object') {
            return { success: false, exists: false, errors: ['Invalid response data structure from API'] };
        }

        const result_data = response.data.data || response.data;

        if (result_data.errors && Array.isArray(result_data.errors) && result_data.errors.length > 0) {
            return {
                success: false,
                exists: result_data.exists !== false,
                errors: result_data.errors,
                result: result_data.result || 'URI text check failed'
            };
        }

        const is_successful = result_data.success !== false;

        if (!is_successful) {
            return {
                success: false,
                exists: result_data.exists || false,
                errors: result_data.errors || ['URI text check failed'],
                result: result_data.result || 'Check failed'
            };
        }

        LOGGER.module().info('INFO: [/astools/service (check_uri_txt)] URI text check successful', {
            batch: batch_name,
            uri_count: result_data.uri_count
        });

        return {
            success: true,
            exists: result_data.exists !== false,
            uri_count: result_data.uri_count || 0,
            uris: result_data.uris || [],
            file_path: result_data.file_path,
            result: result_data.result || 'URI text check completed'
        };

    } catch (error) {
        const response = handle_request_error(error, 'check_uri_txt', { batch });
        return { success: false, exists: false, errors: response.errors };
    }
};

/**
 * Gets packages for a batch.
 */
exports.get_packages = async function (batch) {

    try {

        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Invalid batch parameter');
            return [];
        }

        const batch_name = batch.trim();

        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Missing service configuration');
            return [];
        }

        LOGGER.module().info('INFO: [/astools/service (get_packages)] Retrieving packages for batch', { batch: batch_name });

        const encoded_batch = encodeURIComponent(batch_name);
        const encoded_api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}workspace/packages?batch=${encoded_batch}&api_key=${encoded_api_key}`;

        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: DEFAULT_TIMEOUT
        });

        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Invalid response from API');
            return [];
        }

        if (!response.data) {
            return [];
        }

        let packages_data = response.data.data || response.data;

        if (packages_data.errors && Array.isArray(packages_data.errors) && packages_data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_packages)] Errors returned from API', { errors: packages_data.errors });
            return [];
        }

        let packages = [];

        if (Array.isArray(packages_data)) {
            packages = packages_data;
        } else if (packages_data.packages && Array.isArray(packages_data.packages)) {
            packages = packages_data.packages;
        } else if (packages_data.result && Array.isArray(packages_data.result)) {
            packages = packages_data.result;
        } else if (typeof packages_data === 'object') {
            packages = [packages_data];
        }

        const validated_packages = packages.filter(pkg => pkg && typeof pkg === 'object');

        LOGGER.module().info('INFO: [/astools/service (get_packages)] Packages retrieved successfully', {
            batch: batch_name,
            package_count: validated_packages.length
        });

        return validated_packages;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (get_packages)] Error retrieving packages', { error: error.message });
        return [];
    }
};

/**
 * Checks and processes metadata for a batch package.
 * @param {string} batch - The batch/folder name
 * @param {string} archival_package - The archival package name
 * @returns {Promise<Object>} - Response with errors array and metadata object
 *
 * @example
 * // Response structure:
 * {
 *     errors: [],
 *     metadata: {
 *         // Primary metadata from ArchivesSpace (from process_metadata)
 *         title: 'Record Title',
 *         uri: '/repositories/2/archival_objects/12345',
 *         identifiers: [...],
 *         notes: [...],
 *         dates: [...],
 *         parts: [...],           // <-- Used by controller's check_metadata_parts
 *         is_compound: false,
 *         // Additional processing info
 *         _meta: {
 *             files: ['file1.tif', 'uri.txt'],
 *             uris: ['/repositories/2/archival_objects/12345'],
 *             processed: [{ uri, index, success, data, errors }],
 *             summary: { total: 1, successful: 1, failed: 0 }
 *         }
 *     }
 * }
 */
exports.check_metadata = async function (batch, archival_package) {

    try {

        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] Invalid batch parameter');
            return { errors: ['Invalid batch parameter'], metadata: null };
        }

        if (!archival_package || typeof archival_package !== 'string' || archival_package.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] Invalid archival_package parameter');
            return { errors: ['Invalid archival_package parameter'], metadata: null };
        }

        const safe_batch = batch.trim();
        const safe_package = archival_package.trim();

        LOGGER.module().info('INFO: [/astools/service (check_metadata)] Retrieving metadata URIs', {
            batch: safe_batch,
            archival_package: safe_package
        });

        console.log('BATCH', safe_batch);
        console.log('PACKAGE ', safe_package);

        const uri_data = await get_metadata_uri(safe_batch, safe_package);
        console.log('URI DATA ', uri_data);

        if (!uri_data || typeof uri_data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Invalid response from get_metadata_uri');
            return { errors: ['Failed to retrieve metadata URIs'], metadata: null };
        }

        if (!uri_data.result) {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata)] No URI result returned');
            return { errors: uri_data.errors || ['No metadata URIs found'], metadata: null };
        }

        const { files, uris, uri_count, file_count } = uri_data.result;

        if (!uris || uris.length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] No URIs to process');

            return {
                errors: ['No metadata URIs found to process'],
                metadata: {
                    _meta: {
                        files: files || [],
                        uris: [],
                        processed: [],
                        summary: { total: 0, successful: 0, failed: 0 }
                    }
                }
            };
        }

        LOGGER.module().info('INFO: [/astools/service (check_metadata)] Processing metadata for URIs', { uri_count });

        const processed_results = [];
        const all_errors = [...(uri_data.errors || [])];
        let successful_count = 0;
        let failed_count = 0;
        let primary_metadata = null;

        for (let i = 0; i < uris.length; i++) {
            const uri = uris[i];

            try {
                const metadata = await process_metadata(uri);

                if (!metadata || typeof metadata !== 'object') {
                    processed_results.push({ uri, index: i, success: false, data: null, errors: ['Invalid metadata response'] });
                    failed_count++;
                    all_errors.push(`Failed to process metadata for URI ${uri}`);
                    continue;
                }

                if (metadata.errors) {
                    const parsed_errors = parse_metadata_errors(metadata.errors);

                    if (parsed_errors.length > 0) {
                        processed_results.push({ uri, index: i, success: false, data: metadata, errors: parsed_errors });
                        failed_count++;
                        all_errors.push(...parsed_errors.map(e => `[${uri}] ${e}`));

                        // Still capture as primary metadata even with errors (for parts validation)
                        if (primary_metadata === null) {
                            primary_metadata = metadata;
                        }
                        continue;
                    }
                }

                processed_results.push({ uri, index: i, success: true, data: metadata, errors: [] });
                successful_count++;

                // Capture first successfully processed metadata as primary
                if (primary_metadata === null) {
                    primary_metadata = metadata;
                }

            } catch (process_error) {
                LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Error processing URI', { uri, error: process_error.message });

                processed_results.push({
                    uri,
                    index: i,
                    success: false,
                    data: null,
                    errors: [sanitize_error_message(process_error.message)]
                });
                failed_count++;
                all_errors.push(`Error processing ${uri}: ${sanitize_error_message(process_error.message)}`);
            }
        }

        const summary = { total: uris.length, successful: successful_count, failed: failed_count };

        LOGGER.module().info('INFO: [/astools/service (check_metadata)] Metadata processing complete', { summary });

        // Build response with primary metadata at top level for backward compatibility
        // The controller expects response.metadata.parts to be accessible
        const response_metadata = primary_metadata ? { ...primary_metadata } : {};

        // Add processing metadata under _meta to preserve new functionality
        response_metadata._meta = {
            files: files,
            uris: uris,
            processed: processed_results,
            summary: summary
        };

        return {
            errors: all_errors,
            metadata: response_metadata
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Unable to check metadata', {
            error: error.message,
            batch,
            archival_package
        });

        return {
            errors: ['An error occurred while checking metadata: ' + sanitize_error_message(error.message)],
            metadata: null
        };
    }
};

// ============================================================================
// CALLBACK WRAPPERS (Backward Compatibility)
// ============================================================================

exports.get_workspace_packages_callback = function (callback) {
    exports.get_workspace_packages()
        .then(result => { if (typeof callback === 'function') callback(result); })
        .catch(() => { if (typeof callback === 'function') callback([]); });
};

exports.make_digital_objects_callback = function (args, callback) {
    exports.make_digital_objects(args)
        .then(result => { if (typeof callback === 'function') callback(result); })
        .catch(error => { if (typeof callback === 'function') callback({ result: null, errors: [error.message] }); });
};

exports.check_uri_txt_callback = function (batch, callback) {
    exports.check_uri_txt(batch)
        .then(result => { if (typeof callback === 'function') callback(result); })
        .catch(() => { if (typeof callback === 'function') callback({ success: false, exists: false, errors: ['An error occurred'] }); });
};

exports.get_packages_callback = function (batch, callback) {
    exports.get_packages(batch)
        .then(result => { if (typeof callback === 'function') callback(result); })
        .catch(() => { if (typeof callback === 'function') callback([]); });
};

exports.check_metadata_callback = function (batch, archival_package, callback) {
    exports.check_metadata(batch, archival_package)
        .then(result => { if (typeof callback === 'function') callback(result.metadata); })
        .catch(() => { if (typeof callback === 'function') callback({ errors: ['An error occurred'] }); });
};

// ============================================================================
// ASYNC ALIASES
// ============================================================================

exports.get_workspace_packages_async = exports.get_workspace_packages;
exports.make_digital_objects_async = exports.make_digital_objects;
exports.check_uri_txt_async = exports.check_uri_txt;
exports.get_packages_async = exports.get_packages;
exports.check_metadata_async = exports.check_metadata;

// ============================================================================
// MODULE EXPORTS FOR TESTING
// ============================================================================

exports._internal = {
    get_metadata_uri,
    process_metadata,
    validate_uri,
    sanitize_error_message,
    extract_files,
    extract_uris,
    parse_metadata_errors,
    handle_request_error,
    detect_kaltura_media,
    validate_notes,
    validate_dates,
    validate_parts
};