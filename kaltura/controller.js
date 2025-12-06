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

const SERVICE = require('../kaltura/service');
const DB_QUEUE = require('../config/dbqueue_config')();
const DB_TABLES = require('../config/db_tables_config')();
const KALTURA_TASKS = require('../astools/tasks/kaltra_package_tasks');
const KALTURA_TASK = new KALTURA_TASKS(DB_QUEUE, DB_TABLES);

/**
 * Get Kaltura session token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_ks_session = async function (req, res) {

    try {

        const api_key = typeof req.query.api_key === 'string'
            ? req.query.api_key.trim()
            : null;

        if (!api_key || api_key.length === 0) {
            res.status(400).send({
                error: true,
                message: 'Bad request. API key is required.'
            });
            return;
        }

        const api_key_pattern = /^[a-zA-Z0-9_-]+$/;

        if (!api_key_pattern.test(api_key)) {
            res.status(400).send({
                error: true,
                message: 'Bad request. Invalid API key format.'
            });
            return;
        }

        const session = await SERVICE.get_ks_session();

        if (!session) {
            res.status(500).send({
                error: true,
                message: 'Unable to get session token. Empty session returned.'
            });
            return;
        }

        res.status(200).send({
            error: false,
            ks: session
        });

    } catch (error) {
        console.error('get_ks_session error:', error.message);
        res.status(500).send({
            error: true,
            message: 'Unable to get session token.'
        });
    }
};

/**
 * Get Kaltura metadata - Express route handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.get_ks_metadata = async function (req, res) {

    try {

        const session = typeof req.query.session === 'string'
            ? req.query.session.trim()
            : null;

        const data = req.body;

        if (!session || session.length === 0) {
            res.status(400).send({
                error: true,
                message: 'Bad request. Session is required.'
            });
            return;
        }

        if (!is_valid_request_body(data)) {
            res.status(400).send({
                error: true,
                message: 'Bad request. Invalid or missing packages data.'
            });
            return;
        }

        const result = await process_metadata(data, session);

        if (!result || result.length === 0) {
            res.status(404).send({
                error: true,
                message: 'No metadata found.',
                data: []
            });
            return;
        }

        res.status(200).send({
            error: false,
            data: result
        });

    } catch (error) {
        console.error('get_ks_metadata error:', error.message);
        res.status(500).send({
            error: true,
            message: 'Unable to get metadata.'
        });
    }
};

/**
 * Validate request body structure
 * @param {Object} data - Request body
 * @returns {boolean} True if valid
 */
function is_valid_request_body(data) {

    if (!data || typeof data !== 'object') {
        return false;
    }

    if (!Array.isArray(data.packages) || data.packages.length === 0) {
        return false;
    }

    return data.packages.every(pkg =>
        pkg &&
        typeof pkg.package === 'string' &&
        Array.isArray(pkg.files)
    );
}

/**
 * Process metadata for archival packages
 * @param {Object} data - Request data containing packages
 * @param {string} session - Kaltura session token
 * @returns {Promise<Object>} Processing result
 */
async function process_metadata(data, session) {

    const archival_packages = data.packages;
    const updated_archival_packages = archival_packages.map(pkg => ({
        files: JSON.stringify(pkg.files),
        package: pkg.package
    }));

    await KALTURA_TASK.queue_kaltura_packages(updated_archival_packages);

    const processing_results = await process_all_packages(session);

    return {
        status: 200,
        message: 'Entry ID processing complete.',
        results: processing_results
    };
}

/**
 * Process all queued packages
 * @param {string} session - Kaltura session token
 * @returns {Promise<Array>} All processing results
 */
async function process_all_packages(session) {

    const all_results = [];
    const max_packages = 1000;
    let packages_processed = 0;

    while (packages_processed < max_packages) {

        const kaltura_package_data = await KALTURA_TASK.get_kaltura_package();

        if (!kaltura_package_data || kaltura_package_data.length === 0) {
            console.log('Package processing complete.');
            break;
        }

        const kaltura_package = kaltura_package_data.pop();
        const package_results = await process_single_package(kaltura_package, session);

        all_results.push(...package_results);
        packages_processed++;

        await delay(500);
    }

    return all_results;
}

/**
 * Process a single package and its files
 * @param {Object} kaltura_package - Package data from queue
 * @param {string} session - Kaltura session token
 * @returns {Promise<Array>} Processing results for package
 */
async function process_single_package(kaltura_package, session) {

    const package_results = [];

    let files;

    try {
        files = JSON.parse(kaltura_package.files);
    } catch (error) {
        console.error('Failed to parse files JSON:', error.message);
        return package_results;
    }

    if (!Array.isArray(files)) {
        console.error('Invalid files format for package:', kaltura_package.package);
        return package_results;
    }

    await KALTURA_TASK.update_queue_status(kaltura_package.package);

    for (const file of files) {

        const file_result = await process_single_file(file, kaltura_package.package, session);
        package_results.push(...file_result);

        await delay(250);
    }

    console.log('Files processing complete for package:', kaltura_package.package);

    return package_results;
}

/**
 * Process a single file and retrieve entry IDs
 * @param {string} file - File name
 * @param {string} package_name - Package name
 * @param {string} session - Kaltura session token
 * @returns {Promise<Array>} Entry ID pairs
 */
async function process_single_file(file, package_name, session) {

    if (typeof file !== 'string' || file.length === 0) {
        return [{
            package: package_name,
            file: file || 'unknown',
            entry_id: '0_0',
            status: 0,
            message: 'Invalid file name.'
        }];
    }

    const term = file.slice(0, -4);

    try {

        const file_response = await SERVICE.get_ks_metadata(file, session);

        if (file_response && file_response.totalCount > 0) {
            const pairs = get_entry_ids(file_response, file, package_name);
            await KALTURA_TASK.save_kaltura_ids(pairs);
            return pairs;
        }

        const term_response = await SERVICE.get_ks_metadata(term, session);

        if (term_response && term_response.totalCount > 0) {
            const pairs = get_entry_ids(term_response, file, package_name);
            await KALTURA_TASK.save_kaltura_ids(pairs);
            return pairs;
        }

        const not_found_pair = [{
            package: package_name,
            file: file,
            entry_id: '0_0',
            status: 0,
            message: 'File does not have an Entry ID. Please check Kaltura record for all required fields.'
        }];

        await KALTURA_TASK.save_kaltura_ids(not_found_pair);

        return not_found_pair;

    } catch (error) {
        console.error('Error processing file:', file, error.message);
        return [{
            package: package_name,
            file: file,
            entry_id: '0_0',
            status: 0,
            message: `Processing error: ${error.message}`
        }];
    }
}

/**
 * Extract entry IDs from metadata response
 * @param {Object} metadata - Kaltura metadata response
 * @param {string} file - File name
 * @param {string} package_name - Package name
 * @returns {Array} Entry ID pairs
 */
function get_entry_ids(metadata, file, package_name) {

    const pairs = [];

    if (!metadata || !metadata.objects || !Array.isArray(metadata.objects)) {
        return pairs;
    }

    const total_count = metadata.totalCount || 0;

    if (total_count > 1) {

        const entry_ids = metadata.objects
            .filter(obj => obj && obj.object && obj.object.id)
            .map(obj => obj.object.id);

        pairs.push({
            package: package_name,
            file: file,
            entry_id: JSON.stringify(entry_ids),
            status: 2,
            message: 'File has more than 1 Entry ID. Please check Kaltura record(s).'
        });

    } else if (total_count === 1 && metadata.objects[0]?.object?.id) {

        pairs.push({
            package: package_name,
            file: file,
            entry_id: metadata.objects[0].object.id,
            status: 1,
            message: 'Success.'
        });
    }

    return pairs;
}

/**
 * Async delay utility
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.check_ks_queue = async function (req, res) {

    try {

       let response = await KALTURA_TASK.check_queue_status();
       res.status(200).send({
            data: response
        });

    } catch (error) {
        res.status(500).send({message: `Unable to check ks queue. ${error.message}`});
    }
};

exports.get_ks_entry_ids = async function (req, res) {

    try {

        let response = await KALTURA_TASK.get_ks_entry_ids();
        res.status(200).send({
            data: response
        });

    } catch (error) {
        res.status(500).send({message: `Unable to get ks entry ids. ${error.message}`});
    }
};

exports.clear_ks_queue = async function (req, res) {

    try {

        await KALTURA_TASK.clear_ks_queue();
        res.status(204).send({
            data: 'cleared'
        });

    } catch (error) {
        res.status(500).send({message: `Unable to clear ks queue ${error.message}`});
    }
};

///////////////////////////////////////////////////////////////////////

exports.export_data = function (req, res) {

    try {

        const session = req.query.session;
        const identifier = req.query.identifier;

        if (session === undefined || session.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        /*
        const api_key = req.query.api_key;

        if (api_key === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }
         */

        /*

        Description - search api
        tags - search api

        PublicVideoData -> reference id
        PublicVideoData -> Originalfilename

        publishing schedule (scheduling) - always - date and times
        source file format - flavors - AssetID
        Category
        Users
        */

        SERVICE.export_data(session,() => {});

        res.status(200).send({
            message: 'Exporting data'
        });

    } catch (error) {
        res.status(500).send({message: `Unable to export data. ${error.message}`});
    }
}
