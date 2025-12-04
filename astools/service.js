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

// Constants for media file detection
const KALTURA_MEDIA_EXTENSIONS = [
    '.wav', '.mp3', '.mp4', '.mov',
    '.mkv', '.avi', '.m4v', '.flac',
    '.ogg', '.webm', '.wmv'
];

exports.get_workspace_packages = async function() {

    try {

        LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] Retrieving workspace packages');

        // Validate configuration
        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Missing service configuration');
            return [];
        }

        // Construct API URL with proper encoding
        const api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}workspace?api_key=${api_key}`;

        // Make HTTP request
        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        console.log('RESPONSE ', response);
        // Validate response
        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Invalid response from workspace API', {
                status: response?.status
            });
            return [];
        }

        // Validate response data structure
        if (!response.data || typeof response.data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages)] Invalid response data structure');
            return [];
        }

        // Check for API errors
        if (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_workspace_packages)] Errors returned from workspace API', {
                errors: response.data.errors
            });
            return [];
        }

        // Extract batches
        const batches = response.data.result;

        if (!Array.isArray(batches) || batches.length === 0) {
            LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] No batches found in workspace');
            return [];
        }

        LOGGER.module().info('INFO: [/astools/service (get_workspace_packages)] Processing batches', {
            batch_count: batches.length
        });

        // Process all batches in parallel with error handling
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

// Helper function to process batches in parallel
const process_batches_parallel = async function(batches) {
    const promises = batches.map(batch_name => process_single_batch(batch_name));

    // Use Promise.allSettled to handle individual failures gracefully
    const results = await Promise.allSettled(promises);

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

            // Add error entry for failed batch
            package_files.push({
                errors: [`Failed to process batch: ${result.reason?.message || 'Unknown error'}`],
                result: null
            });
        }
    }

    return package_files;
};

// Helper function to process a single batch
const process_single_batch = async function(batch_name) {

    try {

        // Validate batch name
        if (!batch_name || typeof batch_name !== 'string' || batch_name.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (process_single_batch)] Invalid batch name');
            return {
                errors: ['Invalid batch name'],
                result: null
            };
        }

        // Get package files for this batch - FIXED: properly promisify
        const response = await promisify_get_package_files(batch_name.trim());

        // Validate response
        if (!response || typeof response !== 'object') {
            return {
                errors: ['Invalid response from get_package_files'],
                result: null
            };
        }

        // Check for errors in response
        if (response.errors && Array.isArray(response.errors) && response.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (process_single_batch)] Errors processing batch', {
                batch_name: batch_name,
                errors: response.errors
            });
            return response;
        }

        // Validate result structure
        if (!response.result || typeof response.result !== 'object') {
            return {
                errors: ['Invalid result structure'],
                result: null
            };
        }

        // Check if batch contains Kaltura media files
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

        return {
            errors: [`Error processing batch: ${error.message}`],
            result: null
        };
    }
};

const promisify_get_package_files = function(package_name) {
    return new Promise((resolve, reject) => {
        try {
            // Check if get_package_files exists
            if (typeof get_package_files !== 'function') {
                reject(new Error('get_package_files function is not defined'));
                return;
            }

            // Call with callback
            get_package_files(package_name, (response) => {
                if (response !== undefined && response !== null) {
                    resolve(response);
                } else {
                    resolve({
                        errors: ['Empty response from get_package_files'],
                        result: null
                    });
                }
            });
        } catch (error) {
            reject(error);
        }
    });
};

// Helper function to detect Kaltura media files
const detect_kaltura_media = function(packages) {
    if (!Array.isArray(packages) || packages.length === 0) {
        return false;
    }

    const KALTURA_MEDIA_EXTENSIONS = [
        '.wav', '.mp3', '.mp4', '.mov',
        '.mkv', '.avi', '.m4v', '.flac',
        '.ogg', '.webm', '.wmv'
    ];

    for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];

        if (!pkg || typeof pkg !== 'object') {
            continue;
        }

        // Check files array
        if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
            continue;
        }

        // Check if any file has a Kaltura media extension
        for (let j = 0; j < pkg.files.length; j++) {
            const file = pkg.files[j];

            if (!file || typeof file !== 'string') {
                continue;
            }

            const file_lower = file.toLowerCase();

            // Check against known media extensions
            for (let k = 0; k < KALTURA_MEDIA_EXTENSIONS.length; k++) {
                if (file_lower.endsWith(KALTURA_MEDIA_EXTENSIONS[k])) {
                    return true;
                }
            }
        }
    }

    return false;
};

// Callback-based wrapper for backward compatibility
exports.get_workspace_packages_callback = function(callback) {
    exports.get_workspace_packages()
        .then(result => {
            if (typeof callback === 'function') {
                callback(result);
            }
        })
        .catch(error => {
            LOGGER.module().error('ERROR: [/astools/service (get_workspace_packages_callback)] Callback wrapper error', {
                error: error.message
            });
            if (typeof callback === 'function') {
                callback([]);
            }
        });
};

// Create async version alias
exports.get_workspace_packages_async = exports.get_workspace_packages;

const get_package_files = function (package_name, callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'workspace/packages/files?package_name=' + package_name + '&api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.get(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                callback(response.data);
            } else {
                return false;
            }

        } catch (error) {
            console.error(error);
        }

    })();
}

/*
exports.make_digital_objects = async function(args) {

    try {

        // Validate args object
        if (!args || typeof args !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid args parameter');
            return {
                success: false,
                errors: ['Invalid arguments provided']
            };
        }

        // Validate required fields
        if (!args.folder || typeof args.folder !== 'string' || args.folder.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid folder parameter');
            return {
                success: false,
                errors: ['Invalid folder parameter']
            };
        }

        if (!Array.isArray(args.packages) || args.packages.length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid packages parameter');
            return {
                success: false,
                errors: ['Invalid packages parameter']
            };
        }

        if (!Array.isArray(args.files) || args.files.length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid files parameter');
            return {
                success: false,
                errors: ['Invalid files parameter']
            };
        }

        // Validate configuration
        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Missing service configuration');
            return {
                success: false,
                errors: ['Service configuration is missing']
            };
        }

        LOGGER.module().info('INFO: [/astools/service (make_digital_objects)] Creating digital objects', {
            folder: args.folder,
            package_count: args.packages.length,
            file_count: args.files.length,
            is_kaltura: args.is_kaltura || false
        });

        // Construct API URL with proper encoding
        const api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}make-digital-objects?api_key=${api_key}`;
        console.log('URL ', astools_url);
        // Convert true/false to 1/0
        let is_kaltura_value = 0;
        if (args.is_kaltura === true || args.is_kaltura === 1) {
            is_kaltura_value = 1;
        }

        // Prepare request payload
        const payload = {
            data: {
                folder: args.folder.trim(),
                packages: args.packages,
                files: args.files,
                is_kaltura: is_kaltura_value
            }
        };

        // Make HTTP request
        const response = await HTTP.post(astools_url, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000 // 60 second timeout for potentially long operation
        });

        // Validate response status
        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid response from API', {
                status: response?.status,
                status_text: response?.statusText
            });

            return {
                success: false,
                errors: [`API request failed with status ${response?.status || 'unknown'}`]
            };
        }

        // Validate response data
        if (!response.data || typeof response.data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid response data structure');
            return {
                success: false,
                errors: ['Invalid response data structure from API']
            };
        }

        // Check for errors in response
        if (response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (make_digital_objects)] Errors returned from API', {
                errors: response.data.errors,
                folder: args.folder
            });

            return {
                success: false,
                errors: response.data.errors,
                data: response.data
            };
        }

        // Check if response indicates success
        const is_successful = response.data.success !== false;

        if (!is_successful) {
            LOGGER.module().warn('WARN: [/astools/service (make_digital_objects)] Operation reported as unsuccessful', {
                folder: args.folder
            });
        } else {
            LOGGER.module().info('INFO: [/astools/service (make_digital_objects)] Digital objects created successfully', {
                folder: args.folder,
                successful: response.data.successful,
                failed: response.data.failed
            });
        }

        return response.data;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Unable to make digital objects', {
            error: error.message,
            stack: error.stack,
            folder: args?.folder
        });

        // Check for specific error types
        let error_message = 'An error occurred while creating digital objects';

        if (error.code === 'ECONNREFUSED') {
            error_message = 'Unable to connect to ASTools service';
        } else if (error.code === 'ETIMEDOUT') {
            error_message = 'Request to ASTools service timed out';
        } else if (error.response) {
            error_message = `API error: ${error.response.status} - ${error.response.statusText}`;
        }

        return {
            success: false,
            errors: [error_message + ': ' + sanitize_error_message(error.message)]
        };
    }
};
*/

///

/**
 * Creates digital objects in ArchivesSpace via the ASTools web service.
 *
 * Sends a POST request to the make-digital-objects endpoint which executes
 * the make_digital_object.py CLI script for batch processing.
 *
 * @param {Object} args - Configuration object for digital object creation
 * @param {string} args.folder - Batch folder name (relative to WORKSPACE, required)
 * @param {Array} [args.packages=[]] - List of package names (optional)
 * @param {Array} [args.files=[]] - List of file objects with Kaltura mappings (required if is_kaltura is true)
 * @param {boolean|number} [args.is_kaltura=false] - Whether to process Kaltura IDs (0/1 or true/false)
 * @param {boolean} [args.no_caption=true] - Skip caption processing
 * @param {boolean} [args.no_publish=false] - Do not publish components
 * @param {boolean} [args.test=false] - Use test ArchivesSpace server
 * @param {boolean} [args.verbose=false] - Enable verbose logging
 * @param {number} [args.timeout=3600000] - Request timeout in milliseconds (default: 1 hour)
 * @returns {Promise<Object>} Response object with result and errors
 *
 * @example
 * // Basic usage without Kaltura
 * const result = await make_digital_objects({
 *     folder: 'batch_2024_01',
 *     packages: ['package1', 'package2']
 * });
 *
 * @example
 * // With Kaltura integration
 * const result = await make_digital_objects({
 *     folder: 'batch_2024_01',
 *     packages: ['package1'],
 *     files: [
 *         { file: 'video1.mp4', entry_id: 'kaltura_id_123' },
 *         { file: 'video2.mp4', entry_id: 'kaltura_id_456' }
 *     ],
 *     is_kaltura: true
 * });
 */
exports.make_digital_objects = async function (args) {

    try {

        // Validate args object
        if (!args || typeof args !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid args parameter');
            return {
                result: null,
                errors: ['Invalid arguments provided']
            };
        }

        // Validate required folder field
        if (!args.folder || typeof args.folder !== 'string' || args.folder.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid folder parameter');
            return {
                result: null,
                errors: ['Invalid folder parameter: folder is required']
            };
        }

        // Sanitize folder name - check for path traversal attempts
        const folder = args.folder.trim();
        if (folder.includes('..') || folder.startsWith('/') || folder.startsWith('\\')) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid folder path detected', {
                folder: folder
            });
            return {
                result: null,
                errors: ['Invalid folder parameter: path traversal not allowed']
            };
        }

        // Normalize is_kaltura to integer (0 or 1)
        let is_kaltura_value = 0;
        if (args.is_kaltura === true || args.is_kaltura === 1 || args.is_kaltura === '1') {
            is_kaltura_value = 1;
        }

        // Validate packages (optional, defaults to empty array)
        const packages = Array.isArray(args.packages) ? args.packages : [];

        // Validate files array
        const files = Array.isArray(args.files) ? args.files : [];

        // Files are required when is_kaltura is enabled
        if (is_kaltura_value === 1 && files.length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Files required when is_kaltura is enabled');
            return {
                result: null,
                errors: ['Invalid files parameter: files are required when is_kaltura is enabled']
            };
        }

        // Normalize file entries to expected format
        // Handles common field name variations (filename, name, fileName -> file)
        const normalized_files = files.map((entry, index) => {
            if (!entry || typeof entry !== 'object') {
                return entry; // Let Python handle invalid entries
            }

            // If entry already has 'file' field, return as-is
            if (entry.file && typeof entry.file === 'string') {
                return entry;
            }

            // Try common alternative field names
            const file_value = entry.filename || entry.fileName || entry.name || entry.file_name || null;

            if (file_value && typeof file_value === 'string') {
                return {
                    ...entry,
                    file: file_value
                };
            }

            // Return original entry - Python will validate
            return entry;
        });

        // Log file structure for debugging (first entry only)
        if (normalized_files.length > 0) {
            LOGGER.module().debug('DEBUG: [/astools/service (make_digital_objects)] File entry structure', {
                original_keys: files[0] ? Object.keys(files[0]) : [],
                normalized_keys: normalized_files[0] ? Object.keys(normalized_files[0]) : [],
                total_files: normalized_files.length
            });
        }

        // Validate configuration
        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Missing service configuration');
            return {
                result: null,
                errors: ['Service configuration is missing']
            };
        }

        // Extract optional boolean flags with defaults matching Python endpoint
        const no_caption = args.no_caption !== undefined ? Boolean(args.no_caption) : true;
        const no_publish = args.no_publish !== undefined ? Boolean(args.no_publish) : false;
        const use_test_server = args.test !== undefined ? Boolean(args.test) : false;
        const verbose = args.verbose !== undefined ? Boolean(args.verbose) : false;

        LOGGER.module().info('INFO: [/astools/service (make_digital_objects)] Creating digital objects', {
            folder: folder,
            package_count: packages.length,
            file_count: files.length,
            is_kaltura: is_kaltura_value === 1,
            no_caption: no_caption,
            no_publish: no_publish,
            test: use_test_server,
            verbose: verbose
        });

        // Construct API URL with proper encoding
        const api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const base_url = CONFIG.astools_service.endsWith('/')
            ? CONFIG.astools_service
            : CONFIG.astools_service + '/';
        const astools_url = `${base_url}make-digital-objects?api_key=${api_key}`;

        // Prepare request payload matching Python endpoint expectations
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

        // Configure timeout (default 1 hour to match Python endpoint)
        const timeout_ms = typeof args.timeout === 'number' && args.timeout > 0
            ? args.timeout
            : 3600000; // 1 hour default

        // Make HTTP request with validateStatus to handle all response codes
        const response = await HTTP.post(astools_url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: timeout_ms,
            validateStatus: function (status) {
                // Accept all status codes so we can handle them ourselves
                return status >= 200 && status < 600;
            }
        });

        // Handle response based on status code
        if (!response) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] No response received from API');
            return {
                result: null,
                errors: ['No response received from API']
            };
        }

        const status = response.status;
        const response_data = response.data;

        // Log response details for debugging
        LOGGER.module().debug('DEBUG: [/astools/service (make_digital_objects)] Response received', {
            status: status,
            has_data: !!response_data,
            folder: folder
        });

        // Handle specific HTTP status codes
        if (status === 401) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Authentication failed');
            return {
                result: null,
                errors: response_data?.errors || ['Authentication failed: Invalid API key']
            };
        }

        if (status === 403) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Access forbidden', {
                folder: folder
            });
            return {
                result: null,
                errors: response_data?.errors || ['Access forbidden: Path traversal or permission denied']
            };
        }

        if (status === 404) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Resource not found', {
                folder: folder
            });
            return {
                result: null,
                errors: response_data?.errors || [`Folder not found: ${folder}`]
            };
        }

        if (status === 400) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Bad request', {
                folder: folder,
                errors: response_data?.errors
            });
            return {
                result: null,
                errors: response_data?.errors || ['Bad request: Invalid parameters']
            };
        }

        if (status === 504) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Request timed out', {
                folder: folder
            });
            return {
                result: null,
                errors: response_data?.errors || ['Request timed out: Processing took too long']
            };
        }

        if (status >= 500) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Server error', {
                status: status,
                folder: folder,
                errors: response_data?.errors
            });

            // For 500 errors, the Python endpoint may still return result data
            if (response_data?.result) {
                return {
                    result: response_data.result,
                    errors: response_data.errors || [`Server error: ${status}`]
                };
            }

            return {
                result: null,
                errors: response_data?.errors || [`Server error: ${status}`]
            };
        }

        // Validate response data structure for successful responses
        if (!response_data || typeof response_data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Invalid response data structure');
            return {
                result: null,
                errors: ['Invalid response data structure from API']
            };
        }

        // Extract result and errors from response (matching Python endpoint format)
        const result = response_data.result || null;
        const errors = Array.isArray(response_data.errors) ? response_data.errors : [];

        // Check for errors in response
        if (errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (make_digital_objects)] Errors returned from API', {
                errors: errors,
                folder: folder
            });

            return {
                result: result,
                errors: errors
            };
        }

        // Check if result indicates success
        const is_successful = result && result.success === true;

        if (!is_successful) {
            LOGGER.module().warn('WARN: [/astools/service (make_digital_objects)] Operation reported as unsuccessful', {
                folder: folder,
                result: result
            });
        } else {
            LOGGER.module().info('INFO: [/astools/service (make_digital_objects)] Digital objects created successfully', {
                folder: folder,
                log_file: result.log_file
            });
        }

        // Return the standardized response format
        return {
            result: result,
            errors: errors
        };

    } catch (error) {

        LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Unable to make digital objects', {
            error: error.message,
            stack: error.stack,
            folder: args?.folder
        });

        // Determine specific error type for better error messages
        let error_message = 'An error occurred while creating digital objects';

        if (error.code === 'ECONNREFUSED') {
            error_message = 'Unable to connect to ASTools service';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            error_message = 'Request to ASTools service timed out';
        } else if (error.code === 'ENOTFOUND') {
            error_message = 'ASTools service host not found';
        } else if (error.code === 'ECONNRESET') {
            error_message = 'Connection to ASTools service was reset';
        } else if (error.response) {
            // Axios error with response
            const status = error.response.status;
            const response_errors = error.response.data?.errors;

            if (response_errors && Array.isArray(response_errors) && response_errors.length > 0) {
                return {
                    result: error.response.data?.result || null,
                    errors: response_errors
                };
            }

            error_message = `API error: ${status} - ${error.response.statusText || 'Unknown error'}`;
        } else if (error.request) {
            // Request was made but no response received
            error_message = 'No response received from ASTools service';
        }

        // Sanitize error message for safe logging/display
        const sanitized_message = sanitize_error_message(error.message);

        return {
            result: null,
            errors: [`${error_message}: ${sanitized_message}`]
        };
    }
};

///

// Callback-based wrapper for backward compatibility
exports.make_digital_objects_callback = function(args, callback) {
    exports.make_digital_objects(args)
        .then(result => {
            if (typeof callback === 'function') {
                callback(result);
            }
        })
        .catch(error => {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects_callback)] Callback wrapper error', {
                error: error.message
            });
            if (typeof callback === 'function') {
                callback({
                    success: false,
                    errors: ['An error occurred: ' + error.message]
                });
            }
        });
};

// Create async version alias for the controller
exports.make_digital_objects_async = exports.make_digital_objects;

/**
 * Checks URI text files via ASTools service
 * @param {string} batch - The batch/folder name to check
 * @returns {Promise<Object>} - Structured response with URI check results
 */
exports.check_uri_txt = async function(batch) {

    try {

        // Validate batch parameter
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Invalid batch parameter');
            return {
                success: false,
                exists: false,
                errors: ['Invalid batch parameter']
            };
        }

        const batch_name = batch.trim();

        // Validate configuration
        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Missing service configuration');
            return {
                success: false,
                exists: false,
                errors: ['Service configuration is missing']
            };
        }

        LOGGER.module().info('INFO: [/astools/service (check_uri_txt)] Checking URI text file', {
            batch: batch_name
        });

        // Construct API URL with proper encoding
        const encoded_folder = encodeURIComponent(batch_name);
        const encoded_api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}check-uri-txt?folder=${encoded_folder}&api_key=${encoded_api_key}`;

        // Make HTTP request
        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });

        // Validate response status
        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Invalid response from API', {
                status: response?.status,
                status_text: response?.statusText,
                batch: batch_name
            });

            return {
                success: false,
                exists: false,
                errors: [`API request failed with status ${response?.status || 'unknown'}`]
            };
        }

        // Validate response data
        if (!response.data || typeof response.data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Invalid response data structure', {
                batch: batch_name
            });
            return {
                success: false,
                exists: false,
                errors: ['Invalid response data structure from API']
            };
        }

        // Extract results from response
        const result_data = response.data.data || response.data;

        // Check for errors in response
        if (result_data.errors && Array.isArray(result_data.errors) && result_data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_uri_txt)] Errors returned from API', {
                errors: result_data.errors,
                batch: batch_name
            });

            return {
                success: false,
                exists: result_data.exists !== false,
                errors: result_data.errors,
                result: result_data.result || 'URI text check failed'
            };
        }

        // Check success status
        const is_successful = result_data.success !== false;

        if (!is_successful) {
            LOGGER.module().warn('WARN: [/astools/service (check_uri_txt)] URI text check unsuccessful', {
                batch: batch_name,
                result: result_data.result
            });

            return {
                success: false,
                exists: result_data.exists || false,
                errors: result_data.errors || ['URI text check failed'],
                result: result_data.result || 'Check failed'
            };
        }

        // Log success with details
        const result_message = result_data.result || 'URI text check completed';
        LOGGER.module().info('INFO: [/astools/service (check_uri_txt)] URI text check successful', {
            batch: batch_name,
            result: result_message,
            uri_count: result_data.uri_count
        });

        // Return successful result
        return {
            success: true,
            exists: result_data.exists !== false,
            uri_count: result_data.uri_count || 0,
            uris: result_data.uris || [],
            file_path: result_data.file_path,
            result: result_message
        };

    } catch (error) {
        // Enhanced error handling
        let error_details = {
            error: error.message,
            batch: batch
        };

        let error_message = 'An error occurred while checking URI text file';

        if (error.response) {

            error_details.status = error.response.status;
            error_details.status_text = error.response.statusText;
            error_details.response_data = error.response.data;

            error_message = `API error: ${error.response.status} - ${error.response.statusText}`;

            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] API response error', error_details);
        } else if (error.request) {
            // The request was made but no response was received
            error_details.request = 'No response received';

            if (error.code === 'ECONNREFUSED') {
                error_message = 'Unable to connect to ASTools service';
            } else if (error.code === 'ETIMEDOUT') {
                error_message = 'Request to ASTools service timed out';
            } else {
                error_message = 'No response received from ASTools service';
            }

            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] No response from API', error_details);
        } else {
            // Something happened in setting up the request that triggered an Error
            error_details.stack = error.stack;
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Request setup error', error_details);
        }

        return {
            success: false,
            exists: false,
            errors: [error_message + ': ' + sanitize_error_message(error.message)]
        };
    }
};

// Callback-based wrapper for backward compatibility
exports.check_uri_txt_callback = function(batch, callback) {
    exports.check_uri_txt(batch)
        .then(result => {
            if (typeof callback === 'function') {
                // For backward compatibility, wrap in uri_results structure if needed
                callback(result);
            }
        })
        .catch(error => {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt_callback)] Callback wrapper error', {
                error: error.message
            });
            if (typeof callback === 'function') {
                callback({
                    success: false,
                    exists: false,
                    errors: ['An error occurred: ' + error.message]
                });
            }
        });
};

// Create async version alias for the controller
exports.check_uri_txt_async = exports.check_uri_txt;

exports.get_packages = async function(batch) {

    try {

        // Validate batch parameter
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Invalid batch parameter');
            return [];
        }

        const batch_name = batch.trim();

        // Validate configuration
        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Missing service configuration');
            return [];
        }

        LOGGER.module().info('INFO: [/astools/service (get_packages)] Retrieving packages for batch', {
            batch: batch_name
        });

        // Construct API URL with proper encoding
        const encoded_batch = encodeURIComponent(batch_name);
        const encoded_api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}workspace/packages?batch=${encoded_batch}&api_key=${encoded_api_key}`;

        // Make HTTP request
        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });

        // Validate response status
        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Invalid response from API', {
                status: response?.status,
                status_text: response?.statusText,
                batch: batch_name
            });
            return [];
        }

        // Validate response data
        if (!response.data) {
            LOGGER.module().warn('WARN: [/astools/service (get_packages)] Empty response data from API', {
                batch: batch_name
            });
            return [];
        }

        // Handle different response structures
        let packages_data = response.data;

        // If response has nested data property
        if (response.data.data) {
            packages_data = response.data.data;
        }

        // Check for errors in response
        if (packages_data.errors && Array.isArray(packages_data.errors) && packages_data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_packages)] Errors returned from API', {
                errors: packages_data.errors,
                batch: batch_name
            });
            return [];
        }

        // Extract packages array
        let packages = [];

        if (Array.isArray(packages_data)) {
            packages = packages_data;
        } else if (packages_data.packages && Array.isArray(packages_data.packages)) {
            packages = packages_data.packages;
        } else if (packages_data.result && Array.isArray(packages_data.result)) {
            packages = packages_data.result;
        } else if (typeof packages_data === 'object') {
            // Single package object
            packages = [packages_data];
        }

        // Validate and sanitize packages
        const validated_packages = [];

        for (let i = 0; i < packages.length; i++) {
            const package_item = packages[i];

            if (!package_item || typeof package_item !== 'object') {
                LOGGER.module().warn('WARN: [/astools/service (get_packages)] Invalid package at index', {
                    index: i,
                    batch: batch_name
                });
                continue;
            }

            // Add validated package to results
            validated_packages.push(package_item);
        }

        LOGGER.module().info('INFO: [/astools/service (get_packages)] Packages retrieved successfully', {
            batch: batch_name,
            package_count: validated_packages.length
        });

        return validated_packages;

    } catch (error) {
        // Enhanced error handling
        let error_details = {
            error: error.message,
            batch: batch
        };

        let error_message = 'An error occurred while retrieving packages';

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            error_details.status = error.response.status;
            error_details.status_text = error.response.statusText;

            error_message = `API error: ${error.response.status} - ${error.response.statusText}`;

            LOGGER.module().error('ERROR: [/astools/service (get_packages)] API response error', error_details);
        } else if (error.request) {
            // The request was made but no response was received
            error_details.request = 'No response received';

            if (error.code === 'ECONNREFUSED') {
                error_message = 'Unable to connect to ASTools service';
            } else if (error.code === 'ETIMEDOUT') {
                error_message = 'Request to ASTools service timed out';
            } else {
                error_message = 'No response received from ASTools service';
            }

            LOGGER.module().error('ERROR: [/astools/service (get_packages)] No response from API', error_details);
        } else {
            // Something happened in setting up the request that triggered an Error
            error_details.stack = error.stack;
            LOGGER.module().error('ERROR: [/astools/service (get_packages)] Request setup error', error_details);
        }

        // Return empty array instead of throwing to prevent cascading failures
        return [];
    }
};

// Callback-based wrapper for backward compatibility
exports.get_packages_callback = function(batch, callback) {
    exports.get_packages(batch)
        .then(result => {
            if (typeof callback === 'function') {
                callback(result);
            }
        })
        .catch(error => {
            LOGGER.module().error('ERROR: [/astools/service (get_packages_callback)] Callback wrapper error', {
                error: error.message
            });
            if (typeof callback === 'function') {
                callback([]);
            }
        });
};

// Create async version alias for the controller
exports.get_packages_async = exports.get_packages;

exports.check_metadata = async function(batch, archival_package) {

    try {

        // Input validation
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] Invalid batch parameter');
            return {
                errors: ['Invalid batch parameter'],
                metadata: null
            };
        }

        if (!archival_package || typeof archival_package !== 'string' || archival_package.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] Invalid archival_package parameter');
            return {
                errors: ['Invalid archival_package parameter'],
                metadata: null
            };
        }

        LOGGER.module().info('INFO: [/astools/service (check_metadata)] Retrieving metadata URI', {
            batch: batch,
            archival_package: archival_package
        });

        // Get metadata URI
        const data = await get_metadata_uri(batch, archival_package);

        // Validate response structure
        if (!data || typeof data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Invalid response from get_metadata_uri');
            return {
                errors: ['Failed to retrieve metadata URI'],
                metadata: null
            };
        }

        // Check for errors in the response
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] Errors returned from get_metadata_uri', {
                errors: data.errors,
                batch: batch,
                archival_package: archival_package
            });
            return {
                errors: data.errors,
                metadata: data.result || null
            };
        }

        // Validate URI result
        if (!data.result) {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata)] No URI result returned');
            return {
                errors: ['No metadata URI found'],
                metadata: null
            };
        }

        // Convert URI to string safely
        const uri = String(data.result).trim();

        if (uri.length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Empty URI returned');
            return {
                errors: ['Empty metadata URI'],
                metadata: null
            };
        }

        LOGGER.module().info('INFO: [/astools/service (check_metadata)] Processing metadata for URI', {
            uri: uri
        });

        // Process metadata
        const metadata = await process_metadata(uri);

        // Validate metadata response
        if (!metadata || typeof metadata !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Invalid metadata returned from process_metadata', {
                uri: uri
            });
            return {
                errors: ['Failed to process metadata'],
                metadata: null
            };
        }

        // Check if metadata contains errors
        if (metadata.errors) {
            let parsed_errors = [];

            try {
                // metadata.errors might be a JSON string or an array
                if (typeof metadata.errors === 'string') {
                    parsed_errors = JSON.parse(metadata.errors);
                } else if (Array.isArray(metadata.errors)) {
                    parsed_errors = metadata.errors;
                }
            } catch (parse_error) {
                LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Failed to parse metadata errors', {
                    error: parse_error.message,
                    uri: uri
                });
                parsed_errors = ['Failed to parse metadata errors'];
            }

            LOGGER.module().warn('WARN: [/astools/service (check_metadata)] Metadata validation errors found', {
                uri: uri,
                error_count: parsed_errors.length
            });

            return {
                errors: parsed_errors,
                metadata: metadata
            };
        }

        LOGGER.module().info('INFO: [/astools/service (check_metadata)] Metadata processed successfully', {
            uri: uri
        });

        // Return successful result
        return {
            errors: [],
            metadata: metadata
        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (check_metadata)] Unable to check metadata', {
            error: error.message,
            stack: error.stack,
            batch: batch,
            archival_package: archival_package
        });

        return {
            errors: ['An error occurred while checking metadata: ' + sanitize_error_message(error.message)],
            metadata: null
        };
    }
};

// Callback-based wrapper for backward compatibility (if needed)
exports.check_metadata_callback = function(batch, archival_package, callback) {
    exports.check_metadata(batch, archival_package)
        .then(result => {
            if (typeof callback === 'function') {
                callback(result.metadata);
            }
        })
        .catch(error => {
            LOGGER.module().error('ERROR: [/astools/service (check_metadata_callback)] Callback wrapper error', {
                error: error.message
            });
            if (typeof callback === 'function') {
                callback({
                    errors: ['An error occurred: ' + error.message]
                });
            }
        });
};

// Create async version alias for the controller
exports.check_metadata_async = exports.check_metadata;

// Helper function to sanitize error messages (if not already defined elsewhere)
const sanitize_error_message = function(message) {
    if (!message || typeof message !== 'string') {
        return 'An unexpected error occurred';
    }

    // Remove sensitive information from error messages
    return message
        .replace(/\/[\w\/.-]+/g, '[PATH]')  // Remove file paths
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')  // Remove IP addresses
        .substring(0, 200);  // Limit length
};

/**
 * Gets metadata
 * @param uri
 */
const process_metadata = async function(uri) {

    try {

        if (!uri || typeof uri !== 'string' || uri.trim().length === 0) {
            return {
                errors: ['Invalid URI parameter']
            };
        }

        const ARCHIVESSPACE_LIB = new ARCHIVESSPACE(ARCHIVESSPACE_CONFIG);
        const token = await ARCHIVESSPACE_LIB.get_session_token();
        const errors = [];

        LOGGER.module().info('INFO: [/astools/service (process_metadata)] Checking record', { uri });

        const record = await ARCHIVESSPACE_LIB.get_record(uri, token);

        // Early return if record not found
        if (!record || record === false) {
            await cleanup_session(ARCHIVESSPACE_LIB, token);
            return {
                errors: ['Record not found.']
            };
        }

        // Validate metadata exists
        const metadata = record.metadata || {};

        // Validate required fields
        validate_required_field(errors, metadata.title, 'Title field is missing');
        validate_required_field(errors, metadata.uri, 'URI field is missing');
        validate_required_array(errors, metadata.identifiers, 'Identifier field is missing');

        // Validate notes
        validate_notes(errors, metadata.notes);

        // Validate dates
        validate_dates(errors, metadata.dates);

        // Validate parts
        validate_parts(errors, metadata.parts, metadata.is_compound);

        // Attach errors if any exist
        if (errors.length > 0) {
            metadata.errors = JSON.stringify(errors);
        }

        // Clean up session
        await cleanup_session(ARCHIVESSPACE_LIB, token);

        return metadata;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (process_metadata)] Unable to process metadata', {
            error: error.message,
            stack: error.stack
        });
        return {
            errors: ['An error occurred while processing metadata: ' + error.message]
        };
    }
};

// Helper function to validate required string fields
const validate_required_field = function(errors, field, error_message) {
    if (!field || (typeof field === 'string' && field.trim().length === 0)) {
        errors.push(error_message);
    }
};

// Helper function to validate required array fields
const validate_required_array = function(errors, field, error_message) {
    if (!Array.isArray(field) || field.length === 0) {
        errors.push(error_message);
    }
};

const validate_notes = function(errors, notes) {
    // Handle if notes is undefined, null, or not an array

    if (!notes) {
        errors.push('Notes field is missing - The notes field contains the abstract and rights statement');
        return;
    }

    // Handle if notes is an object with a nested array
    let notes_array = notes;
    if (!Array.isArray(notes) && typeof notes === 'object' && Array.isArray(notes.notes)) {
        notes_array = notes.notes;
    }

    // Handle if notes is a JSON string
    if (typeof notes === 'string') {
        try {
            notes_array = JSON.parse(notes);
        } catch (e) {
            errors.push('Notes field is invalid - Unable to parse notes data');
            return;
        }
    }

    // Now check if it's a valid array
    if (!Array.isArray(notes_array) || notes_array.length === 0) {
        errors.push('Notes field is missing - The notes field contains the abstract and rights statement');
        return;
    }

    let has_abstract = false;
    let has_rights = false;
    let abstract_is_empty = false;
    let rights_is_empty = false;

    for (let i = 0; i < notes_array.length; i++) {
        const note = notes_array[i];

        if (!note || typeof note !== 'object') {
            continue;
        }

        if (note.type === 'abstract') {
            has_abstract = true;
            // Handle both string and array content
            if (typeof note.content === 'string') {
                if (note.content.trim().length === 0) {
                    abstract_is_empty = true;
                }
            } else if (Array.isArray(note.content)) {
                if (note.content.length === 0) {
                    abstract_is_empty = true;
                }
            } else {
                abstract_is_empty = true;
            }
        }

        if (note.type === 'userestrict') {
            has_rights = true;
            // Handle both string and array content
            if (typeof note.content === 'string') {
                if (note.content.trim().length === 0) {
                    rights_is_empty = true;
                }
            } else if (Array.isArray(note.content)) {
                if (note.content.length === 0) {
                    rights_is_empty = true;
                }
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
};

// Helper function to validate notes
const validate_notes__ = function(errors, notes) {
    console.log(errors);
    console.log('NOTES ', notes);

    if (!Array.isArray(notes) || notes.length === 0) {
        errors.push('Notes field is missing - The notes field contains the abstract and rights statement');
        return;
    }

    let has_abstract = false;
    let has_rights = false;
    let abstract_is_empty = false;
    let rights_is_empty = false;

    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];

        if (!note || typeof note !== 'object') {
            continue;
        }

        if (note.type === 'abstract') {
            has_abstract = true;
            if (!Array.isArray(note.content) || note.content.length === 0) {
                abstract_is_empty = true;
            }
        }

        if (note.type === 'userestrict') {
            has_rights = true;
            if (!Array.isArray(note.content) || note.content.length === 0) {
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
};

// Helper function to validate dates
const validate_dates = function(errors, dates) {
    if (!Array.isArray(dates)) {
        return;
    }

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];

        if (!date || typeof date !== 'object') {
            continue;
        }

        if (!date.expression ||
            (typeof date.expression === 'string' && date.expression.trim().length === 0)) {
            errors.push('Date expression is missing');
        }
    }
};

// Helper function to validate parts
const validate_parts = function(errors, parts, is_compound) {
    // Check if compound object has sufficient parts
    if (is_compound === true) {
        if (!Array.isArray(parts) || parts.length < 2) {
            errors.push('Compound objects must have at least 2 parts');
        }
    }

    // Check if parts array exists and is valid
    if (!Array.isArray(parts) || parts.length === 0) {
        errors.push('Parts is missing');
        return;
    }

    // Validate each part
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (!part || typeof part !== 'object') {
            continue;
        }

        if (!part.type || (typeof part.type === 'string' && part.type.trim().length === 0)) {
            const part_title = part.title || 'Unknown part';
            errors.push(`Mime-type is missing (${part_title})`);
        }
    }
};

// Helper function to cleanup session
const cleanup_session = async function(archivesspace_lib, token) {

    try {

        if (!token) {
            return;
        }

        const result = await archivesspace_lib.destroy_session_token(token);

        if (result && result.data && result.data.status === 'session_logged_out') {
            LOGGER.module().info('INFO: [/astools/service (process_metadata)] ArchivesSpace session terminated');
        }
    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (process_metadata)] Failed to cleanup session', {
            error: error.message
        });
    }
};

/**
 * Retrieves metadata URI for a specific package
 * @param {string} folder_name - The folder/batch name
 * @param {string} archival_package - The archival package name
 * @returns {Promise<Object>} - Structured response with URI data
 */
const get_metadata_uri = async function(folder_name, archival_package) {

    try {

        // Validate folder_name parameter
        if (!folder_name || typeof folder_name !== 'string' || folder_name.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid folder_name parameter');
            return {
                errors: ['Invalid folder_name parameter'],
                result: null
            };
        }

        // Validate archival_package parameter
        if (!archival_package || typeof archival_package !== 'string' || archival_package.trim().length === 0) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid archival_package parameter');
            return {
                errors: ['Invalid archival_package parameter'],
                result: null
            };
        }

        // Validate configuration
        if (!CONFIG.astools_service || !CONFIG.astools_service_api_key) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Missing service configuration');
            return {
                errors: ['Service configuration is missing'],
                result: null
            };
        }

        const safe_folder_name = folder_name.trim();
        const safe_package_name = archival_package.trim();

        LOGGER.module().info('INFO: [/astools/service (get_metadata_uri)] Retrieving metadata URI', {
            folder: safe_folder_name,
            package: safe_package_name
        });

        // Construct API URL with proper encoding
        const encoded_folder = encodeURIComponent(safe_folder_name);
        const encoded_package = encodeURIComponent(safe_package_name);
        const encoded_api_key = encodeURIComponent(CONFIG.astools_service_api_key);
        const astools_url = `${CONFIG.astools_service}workspace/uri?folder=${encoded_folder}&package=${encoded_package}&api_key=${encoded_api_key}`;

        // Make HTTP request
        const response = await HTTP.get(astools_url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });

        // Validate response status
        if (!response || response.status !== 200) {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid response from API', {
                status: response?.status,
                status_text: response?.statusText,
                folder: safe_folder_name,
                package: safe_package_name
            });

            return {
                errors: [`API request failed with status ${response?.status || 'unknown'}`],
                result: null
            };
        }

        // Validate response data
        if (!response.data || typeof response.data !== 'object') {
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Invalid response data structure', {
                folder: safe_folder_name,
                package: safe_package_name
            });

            return {
                errors: ['Invalid response data structure from API'],
                result: null
            };
        }

        // Handle different response structures
        let result_data = response.data;

        // If response has nested data property
        if (response.data.data && typeof response.data.data === 'object') {
            result_data = response.data.data;
        }

        // Check for errors in response
        if (result_data.errors && Array.isArray(result_data.errors) && result_data.errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/service (get_metadata_uri)] Errors returned from API', {
                errors: result_data.errors,
                folder: safe_folder_name,
                package: safe_package_name
            });

            return {
                errors: result_data.errors,
                result: result_data.result || null
            };
        }

        // Extract URI from response
        let uri = null;

        if (result_data.result) {
            uri = result_data.result;
        } else if (result_data.uri) {
            uri = result_data.uri;
        } else if (result_data.metadata_uri) {
            uri = result_data.metadata_uri;
        }

        // Validate URI
        if (!uri || (typeof uri === 'string' && uri.trim().length === 0)) {
            LOGGER.module().warn('WARN: [/astools/service (get_metadata_uri)] Empty or missing URI in response', {
                folder: safe_folder_name,
                package: safe_package_name
            });

            return {
                errors: ['Metadata URI not found or empty'],
                result: null
            };
        }

        // Sanitize URI
        const sanitized_uri = typeof uri === 'string' ? uri.trim() : String(uri).trim();

        LOGGER.module().info('INFO: [/astools/service (get_metadata_uri)] Metadata URI retrieved successfully', {
            folder: safe_folder_name,
            package: safe_package_name,
            uri: sanitized_uri
        });

        return {
            errors: [],
            result: sanitized_uri
        };

    } catch (error) {
        // Enhanced error handling
        let error_details = {
            error: error.message,
            folder: folder_name,
            package: archival_package
        };

        let error_message = 'An error occurred while retrieving metadata URI';

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            error_details.status = error.response.status;
            error_details.status_text = error.response.statusText;

            error_message = `API error: ${error.response.status} - ${error.response.statusText}`;

            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] API response error', error_details);
        } else if (error.request) {
            // The request was made but no response was received
            error_details.request = 'No response received';

            if (error.code === 'ECONNREFUSED') {
                error_message = 'Unable to connect to ASTools service';
            } else if (error.code === 'ETIMEDOUT') {
                error_message = 'Request to ASTools service timed out';
            } else {
                error_message = 'No response received from ASTools service';
            }

            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] No response from API', error_details);
        } else {
            // Something happened in setting up the request that triggered an Error
            error_details.stack = error.stack;
            LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Request setup error', error_details);
        }

        return {
            errors: [error_message + ': ' + sanitize_error_message(error.message)],
            result: null
        };
    }
};
