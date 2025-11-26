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

const MODEL = require('../astools/model');
const SERVICE = require('../astools/service');
const LOGGER = require('../libs/log4');

exports.workspace = async function (req, res) {

    try {

        LOGGER.module().info('INFO: [/astools/controller (workspace)] Retrieving workspace packages');

        // Call service layer with async approach
        const response = await SERVICE.get_workspace_packages_async();

        // Validate response
        if (!response) {
            LOGGER.module().warn('WARN: [/astools/controller (workspace)] Empty response from service');
            res.status(200).send({
                data: []
            });
            return;
        }

        // Validate response structure
        if (typeof response !== 'object') {
            throw new Error('Invalid response structure from get_workspace_packages service');
        }

        LOGGER.module().info('INFO: [/astools/controller (workspace)] Workspace packages retrieved successfully', {
            package_count: Array.isArray(response) ? response.length : 'unknown'
        });
        console.log('WORKSPACE RESPONSE ', response);
        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (workspace)] Unable to get workspace packages', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).send({
            error: 'Internal server error',
            message: sanitize_error_message(error.message)
        });
    }
};

exports.make_digital_objects = async function (req, res) {

    try {

        // Validate request body exists
        if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Empty or invalid request body');
            res.status(400).send({
                error: 'Bad request',
                message: 'Request body is required'
            });
            return;
        }

        // Validate batch/folder parameter
        const batch = req.body.batch;
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Missing or invalid batch parameter');
            res.status(400).send({
                error: 'Bad request',
                message: 'batch parameter is required and must be a non-empty string'
            });
            return;
        }

        // Validate packages parameter
        const packages = req.body.packages;
        if (!packages || !Array.isArray(packages) || packages.length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Missing or invalid packages parameter');
            res.status(400).send({
                error: 'Bad request',
                message: 'packages parameter is required and must be a non-empty array'
            });
            return;
        }

        // Validate files parameter
        const files = req.body.files;
        if (!files || !Array.isArray(files) || files.length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Missing or invalid files parameter');
            res.status(400).send({
                error: 'Bad request',
                message: 'files parameter is required and must be a non-empty array'
            });
            return;
        }

        // Validate is_kaltura parameter (can be boolean, number, or string)
        const is_kaltura = req.body.is_kaltura;
        let is_kaltura_boolean = false;

        if (is_kaltura !== undefined && is_kaltura !== null) {
            if (typeof is_kaltura === 'boolean') {
                is_kaltura_boolean = is_kaltura;
            } else if (typeof is_kaltura === 'number') {
                is_kaltura_boolean = is_kaltura === 1;
            } else if (typeof is_kaltura === 'string') {
                is_kaltura_boolean = is_kaltura.toLowerCase() === 'true' || is_kaltura === '1';
            }
        }

        // Validate package structure
        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];

            if (!pkg || typeof pkg !== 'object') {
                LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Invalid package structure at index', {
                    index: i
                });
                res.status(400).send({
                    error: 'Bad request',
                    message: `Invalid package structure at index ${i}`
                });
                return;
            }
        }

        // Validate files structure
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file || typeof file !== 'object') {
                LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Invalid file structure at index', {
                    index: i
                });
                res.status(400).send({
                    error: 'Bad request',
                    message: `Invalid file structure at index ${i}`
                });
                return;
            }
        }

        // Prepare arguments object
        const args = {
            folder: batch.trim(),
            packages: packages,
            files: files,
            is_kaltura: is_kaltura_boolean
        };

        LOGGER.module().info('INFO: [/astools/controller (make_digital_objects)] Creating digital objects', {
            batch: args.folder,
            package_count: packages.length,
            file_count: files.length,
            is_kaltura: is_kaltura_boolean
        });

        // Call service layer with async approach
        const response = await SERVICE.make_digital_objects_async(args);

        // Validate response
        if (!response) {
            LOGGER.module().warn('WARN: [/astools/controller (make_digital_objects)] Empty response from service');
            res.status(200).send({
                data: {
                    success: false,
                    message: 'No response from digital object creation service'
                }
            });
            return;
        }

        // Validate response structure
        if (typeof response !== 'object') {
            throw new Error('Invalid response structure from make_digital_objects service');
        }

        LOGGER.module().info('INFO: [/astools/controller (make_digital_objects)] Digital objects created successfully', {
            batch: args.folder
        });

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (make_digital_objects)] Unable to make digital objects', {
            error: error.message,
            stack: error.stack,
            batch: req.body?.batch
        });

        res.status(500).send({
            error: 'Internal server error',
            message: sanitize_error_message(error.message)
        });
    }
};

exports.check_uri_txt = async function (req, res) {

    try {
        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            LOGGER.module().warn('WARN: [/astools/controller (check_uri_txt)] Missing or invalid request body');
            res.status(400).send({
                error: 'Bad request',
                message: 'Request body is required'
            });
            return;
        }

        // Validate batch parameter
        const batch = req.body.batch;
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (check_uri_txt)] Missing or invalid batch parameter');
            res.status(400).send({
                error: 'Bad request',
                message: 'batch parameter is required and must be a non-empty string'
            });
            return;
        }

        LOGGER.module().info('INFO: [/astools/controller (check_uri_txt)] Checking URI text file', {
            batch: batch.trim()
        });

        // Call service layer with async approach
        const response = await SERVICE.check_uri_txt_async(batch.trim());

        // Validate response
        if (!response) {
            LOGGER.module().warn('WARN: [/astools/controller (check_uri_txt)] Empty response from service');
            res.status(200).send({
                data: {
                    success: false,
                    message: 'No data returned from URI text check'
                }
            });
            return;
        }

        // Validate response structure
        if (typeof response !== 'object') {
            throw new Error('Invalid response structure from check_uri_txt service');
        }

        LOGGER.module().info('INFO: [/astools/controller (check_uri_txt)] URI text file check completed', {
            batch: batch.trim(),
            success: response.success !== false
        });

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_uri_txt)] Unable to check URI text file', {
            error: error.message,
            stack: error.stack,
            batch: req.body?.batch
        });

        res.status(500).send({
            error: 'Internal server error',
            message: sanitize_error_message(error.message)
        });
    }
};

exports.get_packages = async function (req, res) {

    try {
        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            LOGGER.module().warn('WARN: [/astools/controller (get_packages)] Missing or invalid request body');
            res.status(400).send({
                error: 'Bad request',
                message: 'Request body is required'
            });
            return;
        }

        // Validate batch parameter
        const batch = req.body.batch;
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (get_packages)] Missing or invalid batch parameter');
            res.status(400).send({
                error: 'Bad request',
                message: 'batch parameter is required and must be a non-empty string'
            });
            return;
        }

        LOGGER.module().info('INFO: [/astools/controller (get_packages)] Retrieving packages', {
            batch: batch.trim()
        });

        // Call service layer with async approach
        const response = await SERVICE.get_packages_async(batch.trim());

        // Validate response
        if (!response) {
            LOGGER.module().warn('WARN: [/astools/controller (get_packages)] Empty response from service');
            res.status(200).send({
                data: []
            });
            return;
        }

        // Validate response structure
        if (typeof response !== 'object') {
            throw new Error('Invalid response structure from get_packages service');
        }

        LOGGER.module().info('INFO: [/astools/controller (get_packages)] Packages retrieved successfully', {
            batch: batch.trim(),
            package_count: Array.isArray(response) ? response.length : 'unknown'
        });

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_packages)] Unable to get packages', {
            error: error.message,
            stack: error.stack,
            batch: req.body?.batch
        });

        res.status(500).send({
            error: 'Internal server error',
            message: sanitize_error_message(error.message)
        });
    }
};

exports.check_metadata = async function (req, res) {

    try {

        const batch = req.body.batch;
        const job_uuid = req.body.uuid;
        const ingest_package = req.body.ingest_package;

        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (check_metadata)] Missing or invalid batch parameter');
            res.status(400).send({
                error: 'Bad request: batch parameter is required'
            });
            return;
        }

        if (!job_uuid || typeof job_uuid !== 'string' || job_uuid.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (check_metadata)] Missing or invalid job_uuid parameter');
            res.status(400).send({
                error: 'Bad request: uuid parameter is required'
            });
            return;
        }

        if (!ingest_package || typeof ingest_package !== 'string' || ingest_package.trim().length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (check_metadata)] Missing or invalid ingest_package parameter');
            res.status(400).send({
                error: 'Bad request: ingest_package parameter is required'
            });
            return;
        }

        LOGGER.module().info('INFO: [/astools/controller (check_metadata)] Processing metadata check', {
            batch: batch,
            job_uuid: job_uuid,
            ingest_package: ingest_package
        });

        // Call service layer with promisified approach
        const response = await SERVICE.check_metadata_async(batch, ingest_package);

        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response from check_metadata service');
        }

        // Check metadata parts
        const parts_result = await check_metadata_parts(batch, ingest_package, job_uuid, response);

        if (parts_result !== true) {
            response.errors = parts_result;
        } else {
            response.errors = false;
        }

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_metadata)] Unable to check metadata', {
            error: error.message,
            stack: error.stack
        });

        res.status(500).send({
            error: 'Internal server error',
            message: sanitize_error_message(error.message)
        });
    }
};

// Helper function to sanitize error messages for client response
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

const check_metadata_parts = async function(batch, ingest_package, job_uuid, response) {

    try {

        // Input validation
        if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
            return ['Invalid batch parameter'];
        }

        if (!ingest_package || typeof ingest_package !== 'string' || ingest_package.trim().length === 0) {
            return ['Invalid ingest_package parameter'];
        }

        if (!job_uuid || typeof job_uuid !== 'string' || job_uuid.trim().length === 0) {
            return ['Invalid job_uuid parameter'];
        }

        if (!response || typeof response !== 'object') {
            return ['Invalid metadata object'];
        }

        LOGGER.module().info('INFO: [/astools/controller (check_metadata_parts)] Checking metadata parts', {
            batch: batch,
            job_uuid: job_uuid,
            ingest_package: ingest_package
        });

        // Retrieve job from database
        const job = await MODEL.get_job(job_uuid);

        if (!job || !Array.isArray(job) || job.length === 0) {
            return ['Job not found for UUID: ' + job_uuid];
        }

        const job_record = job[0];

        if (!job_record || typeof job_record !== 'object') {
            return ['Invalid job record structure'];
        }

        // Parse packages
        let packages;
        try {
            packages = JSON.parse(job_record.packages || '[]');
        } catch (parse_error) {
            LOGGER.module().error('ERROR: [/astools/controller (check_metadata_parts)] Failed to parse packages JSON', {
                error: parse_error.message,
                job_uuid: job_uuid
            });
            return ['Failed to parse job packages data'];
        }

        if (!Array.isArray(packages)) {
            return ['Invalid packages data structure'];
        }

        const errors = [];
        const part_files = [];

        // Validate metadata parts
        if (!Array.isArray(response.metadata.parts) || response.metadata.parts.length === 0) {
            return ['Metadata parts array is missing or empty'];
        }

        // Check Kaltura IDs if required and collect part filenames
        const is_kaltura = job_record.is_kaltura === 1 || job_record.is_kaltura === true;

        for (let i = 0; i < response.metadata.parts.length; i++) {
            const part = response.metadata.parts[i];

            if (!part || typeof part !== 'object') {
                errors.push(`Invalid part structure at index ${i}`);
                continue;
            }

            // Validate Kaltura ID if this is a Kaltura job
            if (is_kaltura) {
                if (!part.kaltura_id ||
                    (typeof part.kaltura_id === 'string' && part.kaltura_id.trim().length === 0)) {
                    const part_title = part.title || `Part ${i + 1}`;
                    errors.push(`${part_title} is missing its kaltura_id`);
                }
            }

            // Collect part filenames
            if (part.title && typeof part.title === 'string' && part.title.trim().length > 0) {
                part_files.push(part.title.trim());
            } else {
                errors.push(`Part at index ${i} is missing a valid title`);
            }
        }

        // Early return if we already have errors
        if (errors.length > 0) {
            return errors;
        }

        // Extract package files
        let package_files = [];

        if (packages.length === 0) {
            LOGGER.module().warn('WARN: [/astools/controller (check_metadata_parts)] No packages found in job record', {
                job_uuid: job_uuid
            });
            return ['No packages found in job record'];
        }

        // Get files from the matching package
        let matching_package = null;
        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            console.log('PKG ', pkg);
            if (!pkg || typeof pkg !== 'object') {
                continue;
            }

            // Match by ingest_package name if available
            if (pkg.package === ingest_package) {
                matching_package = pkg;
                break;
            }
        }

        // If no specific match found, use the last package (legacy behavior)
        if (!matching_package && packages.length > 0) {
            matching_package = packages[packages.length - 1];
        }

        if (!matching_package) {
            return ['No matching package found'];
        }

        if (!Array.isArray(matching_package.files)) {
            return ['Package files data is invalid or missing'];
        }

        // Extract and clean package filenames
        package_files = matching_package.files
            .filter(file => file && typeof file === 'string')
            .map(file => file.trim())
            .sort();

        // Sort part files for comparison
        const sorted_part_files = part_files.slice().sort();

        // Check if arrays have the same length
        if (package_files.length !== sorted_part_files.length) {
            errors.push(`File count mismatch: Package has ${package_files.length} files, but metadata has ${sorted_part_files.length} parts`);
            LOGGER.module().warn('WARN: [/astools/controller (check_metadata_parts)] File count mismatch', {
                job_uuid: job_uuid,
                package_files_count: package_files.length,
                part_files_count: sorted_part_files.length
            });
        }

        // Compare files
        const missing_from_metadata = [];
        const missing_from_package = [];

        // Find files in package but not in metadata
        for (let i = 0; i < package_files.length; i++) {
            if (!sorted_part_files.includes(package_files[i])) {
                missing_from_metadata.push(package_files[i]);
            }
        }

        // Find files in metadata but not in package
        for (let i = 0; i < sorted_part_files.length; i++) {
            if (!package_files.includes(sorted_part_files[i])) {
                missing_from_package.push(sorted_part_files[i]);
            }
        }

        if (missing_from_metadata.length > 0) {
            errors.push(`Files in package but missing from metadata: ${missing_from_metadata.join(', ')}`);
        }

        if (missing_from_package.length > 0) {
            errors.push(`Files in metadata but missing from package: ${missing_from_package.join(', ')}`);
        }

        // Return results
        if (errors.length > 0) {
            LOGGER.module().warn('WARN: [/astools/controller (check_metadata_parts)] Metadata parts validation failed', {
                job_uuid: job_uuid,
                error_count: errors.length
            });
            return errors;
        }

        LOGGER.module().info('INFO: [/astools/controller (check_metadata_parts)] Metadata parts validation successful', {
            job_uuid: job_uuid,
            file_count: part_files.length
        });

        return true;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_metadata_parts)] Unable to check metadata parts', {
            error: error.message,
            stack: error.stack,
            job_uuid: job_uuid,
            batch: batch
        });

        return ['Error checking metadata parts: ' + sanitize_error_message(error.message)];
    }
};

exports.create_job = async function (req, res) {

    try {

        const job_uuid = req.body.uuid;
        const job_type = req.body.job_type;
        const batch_name = req.body.batch_name;
        const packages = JSON.stringify(req.body.packages);
        const is_kaltura = req.body.is_kaltura;
        const job_run_by = req.body.job_run_by;
        let is_make_digital_objects_complete = 0;

        const job = {
            uuid: job_uuid,
            job_type: job_type,
            batch_name: batch_name,
            packages: packages,
            is_kaltura: is_kaltura,
            is_make_digital_objects_complete: is_make_digital_objects_complete,
            log: '---',
            error: '---',
            job_run_by: job_run_by
        };

        let response = await MODEL.create_job(job);
        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (create_job)] unable to create job ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
}

exports.get_job = async function (req, res) {

    try {

        const job_uuid = req.query.uuid;
        const response = await MODEL.get_job(job_uuid);

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_job)] unable to get job ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.get_metadata_jobs = async function (req, res) {

    try {

        const response = await MODEL.get_metadata_jobs();
        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_metadata_jobs)] unable to get metadata jobs ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.get_ingest_jobs = async function (req, res) {

    try {

        const response = await MODEL.get_ingest_jobs();

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_ingest_jobs)] unable to get ingest jobs ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.get_jobs_history = async function (req, res) {

    try {

        const response = await MODEL.get_jobs_history();

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_ingest_jobs)] unable to get ingest jobs ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.update_job = async function (req, res) {

    try {

        const job = req.body;
        const response = await MODEL.update_job(job);

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (update_job)] unable to get update job ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};


/*
exports.workspace__ = function (req, res) {

    try {

        SERVICE.get_workspace_packages((response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (workspace)] unable to get workspace packages ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};
*/

/*
exports.make_digital_objects__ = function (req, res) {

    try {

        if (Object.keys(req.body).length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        // data is sent to astools script
        const args = {
            folder: req.body.batch,
            packages: req.body.packages,
            files: req.body.files,
            is_kaltura: req.body.is_kaltura
        }

        SERVICE.make_digital_objects(args, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (make_digital_objects)] unable to make digital objects ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};
*/

/*
exports.check_uri_txt__ = function (req, res) {

    try {

        const batch = req.body.batch;

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.check_uri_txt(batch, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_uri_txt)] unable to check uri txt ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};
*/

/*
async function check_metadata_parts__(batch, ingest_package, job_uuid, metadata) {

    try {

        const job = await MODEL.get_job(job_uuid);
        let packages = JSON.parse(job[0].packages);
        let package_files;
        let part_files = [];
        let errors = [];

        for (let i = 0; i < metadata.parts.length; i++) {

            if (job[0].is_kaltura === 1) {
                if (metadata.parts[i].kaltura_id === undefined) {
                    errors.push(metadata.parts[i].title + ' is missing its kaltura_id');
                }
            }

            part_files.push(metadata.parts[i].title);
        }

        if (packages.length > 0) {

            for (let i = 0; i < packages.length; i++) {
                package_files = packages[i].files.sort();
            }
        }

        const packagef = package_files.concat().sort();
        const partf = part_files.concat().sort();

        for (let i = 0; i < packagef.length; i++) {

            if (packagef[i] !== partf[i]) {
                errors.push('Package files do not match ArchivesSpace record.');
                return false;
            }
        }

        if (errors.length > 0) {
            return JSON.stringify(errors);
        } else {
            return true;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_metadata_parts)] unable to check metadata parts ' + error.message);
    }
}
*/

/*
exports.check_metadata__ = function (req, res) {

    try {

        const batch = req.body.batch;
        const job_uuid = req.body.uuid;
        const ingest_package = req.body.ingest_package;

        if (batch === undefined || job_uuid === undefined || ingest_package === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.check_metadata(batch, ingest_package, (response) => {

            (async function() {

                const result = await check_metadata_parts(batch, ingest_package, job_uuid, response);

                if (result !== true) {
                    response.errors = result;
                } else {
                    response.errors = false;
                }

                res.status(200).send({
                    data: response
                });

            })();
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_metadata)] unable to check metadata ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};
*/

/*
exports.get_packages__ = function (req, res) {

    try {

        const batch = req.body.batch;

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.get_packages(batch, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_packages)] unable to get packages ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};
*/