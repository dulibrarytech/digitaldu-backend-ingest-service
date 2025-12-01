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

const jobsModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/repo/ingester';
    const endpoint = '/api/v1/astools/jobs';

    /**
     * Fetches an active job by UUID
     * @param {string} job_uuid - The UUID of the job to fetch
     * @returns {Promise<{data: Array}>} Job data response object
     * @throws {Error} When job UUID or API key is missing, or request fails
     */
    obj.get_active_job = async function (job_uuid) {
        const REQUEST_TIMEOUT_MS = 600000;

        /**
         * Safely parses JSON string
         * @param {string} json_string - JSON string to parse
         * @returns {Array} Parsed array or empty array on failure
         */
        function safe_parse_json(json_string) {
            try {
                const parsed = JSON.parse(json_string);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        try {
            // Validate job_uuid parameter
            if (!job_uuid || typeof job_uuid !== 'string' || job_uuid.trim() === '') {
                throw new Error('Job UUID is required');
            }

            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode parameters to prevent injection and handle special characters
            const encoded_uuid = encodeURIComponent(job_uuid.trim());
            const encoded_api_key = encodeURIComponent(api_key.trim());

            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '?uuid=' + encoded_uuid + '&api_key=' + encoded_api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes
            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            // Validate response structure
            if (!response.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
                throw new Error('Job not found');
            }

            const job_record = response.data.data[0];

            // Build response object
            const data = {
                result: {
                    batch: job_record.batch_name || '',
                    packages: safe_parse_json(job_record.packages),
                    is_kaltura: Boolean(job_record.is_kaltura)
                }
            };

            return {
                data: [data]
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            console.error('get_active_job error:', error_message);

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.get_active_job__ = async function (job_uuid) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '?uuid=' + job_uuid + '&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                console.log(response.data.data);
                let record = [];
                let is_kalture = false;

                if (response.data.data[0].is_kaltura === 1) {
                    is_kalture = true;
                }

                let data = {
                    result: {
                        batch: response.data.data[0].batch_name,
                        packages: JSON.parse(response.data.data[0].packages),
                        is_kaltura: is_kalture
                    }
                };

                record.push(data);

                return {
                    data: record
                };
            }

        } catch (error) {
            console.log(error);
        }
    };

     */

    /**
     * Fetches metadata jobs from the API
     * @returns {Promise<{data: Array}>} Metadata jobs response object
     * @throws {Error} When API key is missing or request fails
     */
    obj.get_metadata_jobs = async function () {
        const REQUEST_TIMEOUT_MS = 600000;

        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        /**
         * Safely parses JSON string
         * @param {string} json_string - JSON string to parse
         * @returns {Array} Parsed array or empty array on failure
         */
        function safe_parse_json(json_string) {
            try {
                const parsed = JSON.parse(json_string);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        /**
         * Transforms a job record into the expected format
         * @param {Object} job - Raw job record from API
         * @returns {Object} Transformed job object
         */
        function transform_job_record(job) {
            return {
                result: {
                    job_uuid: job.uuid || '',
                    batch: job.batch_name || '',
                    packages: safe_parse_json(job.packages),
                    is_kaltura: Boolean(job.is_kaltura)
                }
            };
        }

        try {
            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode API key to prevent injection and handle special characters
            const encoded_api_key = encodeURIComponent(api_key.trim());

            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/metadata?api_key=' + encoded_api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes
            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            // Validate response structure
            if (!response.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }

            const jobs_data = response.data.data;

            // Return early for empty results
            if (jobs_data.length === 0) {
                return { data: [] };
            }

            // Transform all job records
            const transformed_data = jobs_data.map(transform_job_record);

            return {
                data: transformed_data
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.get_metadata_jobs__ = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/metadata?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.length === 0) {
                    return {
                        data: []
                    };
                }

                let record = [];
                let is_kaltura = false;

                if (response.data.data.length > 0) {

                    for (let i = 0; i < response.data.data.length; i++) {

                        if (response.data.data[i].is_kaltura === 1) {
                            is_kaltura = true;
                        }

                        record.push({
                            result: {
                                job_uuid: response.data.data[i].uuid,
                                batch: response.data.data[i].batch_name,
                                packages: JSON.parse(response.data.data[i].packages),
                                is_kaltura: is_kaltura
                            }
                        });
                    }

                    return {
                        data: record
                    };
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };
    */

    /**
     * Fetches ingest jobs from the API
     * @returns {Promise<{data: Array}>} Ingest jobs response object
     * @throws {Error} When API key is missing or request fails
     */
    obj.get_ingest_jobs = async function () {
        const REQUEST_TIMEOUT_MS = 600000;

        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        /**
         * Safely parses JSON string
         * @param {string} json_string - JSON string to parse
         * @returns {Array} Parsed array or empty array on failure
         */
        function safe_parse_json(json_string) {
            try {
                const parsed = JSON.parse(json_string);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        /**
         * Transforms a job record into the expected format
         * @param {Object} job - Raw job record from API
         * @returns {Object} Transformed job object
         */
        function transform_job_record(job) {
            return {
                result: {
                    job_uuid: job.uuid || '',
                    batch: job.batch_name || '',
                    packages: safe_parse_json(job.packages),
                    is_kaltura: Boolean(job.is_kaltura)
                }
            };
        }

        try {
            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode API key to prevent injection and handle special characters
            const encoded_api_key = encodeURIComponent(api_key.trim());

            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/ingest?api_key=' + encoded_api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes
            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            // Validate response structure
            if (!response.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }

            const jobs_data = response.data.data;

            // Return early for empty results
            if (jobs_data.length === 0) {
                return { data: [] };
            }

            // Transform all job records
            const transformed_data = jobs_data.map(transform_job_record);

            return {
                data: transformed_data
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.get_ingest_jobs__ = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/ingest?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.length === 0) {
                    return {
                        data: []
                    };
                }

                let record = [];
                let is_kaltura = false;

                if (response.data.data.length > 0) {

                    for (let i = 0; i < response.data.data.length; i++) {

                        if (response.data.data[i].is_kaltura === 1) {
                            is_kaltura = true;
                        }

                        record.push({
                            result: {
                                job_uuid: response.data.data[i].uuid,
                                batch: response.data.data[i].batch_name,
                                packages: JSON.parse(response.data.data[i].packages),
                                is_kaltura: is_kaltura
                            }
                        });
                    }

                    return {
                        data: record
                    };
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };
    */

    /**
     * Fetches job history from the API
     * @returns {Promise<{data: Array}>} Job history response object
     * @throws {Error} When API key is missing or request fails
     */
    obj.get_jobs_history = async function () {
        const REQUEST_TIMEOUT_MS = 600000;

        try {
            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode API key to prevent injection and handle special characters
            const encoded_api_key = encodeURIComponent(api_key);

            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/history?api_key=' + encoded_api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes
            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            // Validate response structure
            if (!response.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }

            const jobs_data = response.data.data;

            // Return early for empty results
            if (jobs_data.length === 0) {
                return { data: [] };
            }

            // Transform is_kaltura to boolean values
            const transformed_data = jobs_data.map(function (job) {
                return Object.assign({}, job, {
                    is_kaltura: Boolean(job.is_kaltura)
                });
            });

            return {
                data: transformed_data
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            // Sanitize error message to prevent XSS
            const sanitized_message = error_message
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            domModule.html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitized_message +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.get_jobs_history__ = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + endpoint + '/history?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.length === 0) {
                    return {
                        data: []
                    };
                }

                if (response.data.data.length > 0) {

                    for (let i = 0; i < response.data.data.length; i++) {

                        if (response.data.data[i].is_kaltura === 1) {
                            response.data.data[i].is_kaltura = true;
                        } else {
                            response.data.data[i].is_kaltura = false;
                        }
                    }

                    return response.data;
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };
    */

    /**
     * Updates a job via the API
     * @param {Object} job - Job data to update
     * @returns {Promise<{success: boolean, data: Object}>} Update result
     * @throws {Error} When job data or API key is missing, or request fails
     */
    obj.update_job = async function (job) {
        const REQUEST_TIMEOUT_MS = 60000;

        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        try {
            // Validate job parameter
            if (!job || typeof job !== 'object' || Array.isArray(job)) {
                throw new Error('Valid job data is required');
            }

            // Validate job has required identifier
            if (!job.uuid && !job.id) {
                throw new Error('Job must have a uuid or id');
            }

            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode API key to prevent injection and handle special characters
            const encoded_api_key = encodeURIComponent(api_key.trim());

            const response = await httpModule.req({
                method: 'PUT',
                url: nginx_path + '/api/v1/astools/jobs?api_key=' + encoded_api_key,
                data: job,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes
            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            return {
                success: true,
                data: response.data || {}
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.update_job__ = async function (job) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'PUT',
                url: nginx_path + '/api/v1/astools/jobs?api_key=' + api_key,
                data: job,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                console.log('job updated');
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }
    */

    /**
     * Displays job history in a DataTable
     * @returns {Promise<boolean>} False if no records found, undefined otherwise
     */
    obj.display_jobs_history = async function () {
        const STATUS_MAP = {
            0: 'PENDING',
            1: 'SUCCESSFUL',
            2: 'FAILED'
        };

        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        /**
         * Safely parses JSON string
         * @param {string} json_string - JSON string to parse
         * @returns {Array} Parsed array or empty array on failure
         */
        function safe_parse_json(json_string) {
            try {
                const parsed = JSON.parse(json_string);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        /**
         * Builds HTML for package list
         * @param {string} packages_json - JSON string of packages
         * @returns {string} HTML string for package list
         */
        function build_package_list(packages_json) {
            const packages = safe_parse_json(packages_json);

            if (packages.length === 0) {
                return '<ul><li><small>No packages</small></li></ul>';
            }

            const list_items = packages.map(function (pkg) {
                return '<li><small>' + sanitize_html(pkg.package) + '</small></li>';
            }).join('');

            return '<ul>' + list_items + '</ul>';
        }

        /**
         * Builds table row HTML for a single job record
         * @param {Object} record - Job record object
         * @returns {string} HTML string for table row
         */
        function build_table_row(record) {
            const status = STATUS_MAP[record.is_complete] || 'UNKNOWN';
            const package_list = build_package_list(record.packages);

            return '<tr>' +
                '<td style="vertical-align: middle; width: 15%"><small>' + sanitize_html(record.uuid) + '</small></td>' +
                '<td style="vertical-align: middle; width: 15%"><small>' + sanitize_html(record.job_type) + '</small></td>' +
                '<td style="vertical-align: middle; width: 10%"><small>' + sanitize_html(status) + '</small></td>' +
                '<td style="vertical-align: middle; width: 30%"><small>' + sanitize_html(record.batch_name) + '</small></td>' +
                '<td style="text-align: left; vertical-align: middle; width: 30%;">' + package_list + '</td>' +
                '<td style="vertical-align: middle;">' + sanitize_html(record.job_run_by) + '</td>' +
                '<td style="vertical-align: middle;">' + sanitize_html(record.job_date) + '</td>' +
                '</tr>';
        }

        try {
            const records = await jobsModule.get_jobs_history();

            // Validate response structure
            if (!records || !Array.isArray(records.data)) {
                throw new Error('Invalid response format');
            }

            if (records.data.length === 0) {
                set_element_html(
                    '#message',
                    '<div class="alert alert-info"><i class="fa fa-exclamation-circle"></i> No jobs found</div>'
                );
                return false;
            }

            const table_html = records.data.map(build_table_row).join('');

            set_element_html('#jobs-history', table_html);

            // Initialize DataTable
            new DataTable('#jobs-history-table', {
                paging: true,
                rowReorder: true
            });

            const table_element = document.querySelector('#jobs-history-table');

            if (table_element) {
                table_element.style.visibility = 'visible';
            }

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );
        }
    };

    /*
    obj.display_jobs_history__ = async function () {

        try {

            let records = await jobsModule.get_jobs_history();

            if (records.data.length === 0) {
                domModule.html('#message', '<div class="alert alert-info"><i class="fa fa-exclamation-circle"></i> No jobs found</div>');
                return false;
            }

            let html = '';

            for (let i = 0; i < records.data.length; i++) {

                let status;
                let package_list = '<ul>';

                let packages = JSON.parse(records.data[i].packages);

                for (let j = 0; j < packages.length; j++) {
                    package_list += '<li><small>' + packages[j].package + '</small></li>';
                }

                package_list += '</ul>';


                if (records.data[i].is_complete === 1) {
                    status = 'SUCCESSFUL';
                } else if (records.data[i].is_complete === 0) {
                    status = 'PENDING';
                } else if (records.data[i].is_complete === 2) {
                    status = 'FAILED';
                }

                html += '<tr>';

                // job uuid
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + records.data[i].uuid + '</small>';
                html += '</td>';

                // job type
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + records.data[i].job_type + '</small>';
                html += '</td>';

                // is complete
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + status + '</small>';
                html += '</td>';

                // collection folder
                html += '<td style="vertical-align: middle;">';
                html += '<small>' + records.data[i].batch_name + '</small>';
                html += '</td>';

                // packages
                html += '<td style="text-align: left;vertical-align: middle; width: 20%">';
                html += package_list;
                html += '</td>';

                // jobs run by
                html += '<td style="vertical-align: middle;">';
                html += records.data[i].job_run_by;
                html += '</td>';
                // html += '</tr>';

                // job date
                html += '<td style="vertical-align: middle;">';
                html += records.data[i].job_date;
                html += '</td>';
                html += '</tr>';
            }

            domModule.html('#jobs-history', html);

            const JOB_HISTORY = new DataTable('#jobs-history-table', {
                paging: true,
                rowReorder: true
            });

            document.querySelector('#jobs-history-table').style.visibility = 'visible';

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }
    */

    /**
     * Checks the Kaltura queue for digital objects
     * @param {string} batch - Batch identifier (reserved for future use)
     * @returns {Promise<Object>} Queue data response
     * @throws {Error} When API key is missing or request fails
     */
    obj.check_make_digital_objects_ks_queue = async function () {
        const REQUEST_TIMEOUT_MS = 600000;

        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        try {
            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode API key to prevent injection and handle special characters
            const encoded_api_key = encodeURIComponent(api_key.trim());

            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/kaltura/queue?api_key=' + encoded_api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes
            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            // Validate response has data
            if (!response.data) {
                throw new Error('Invalid response format');
            }

            return response.data;

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.check_make_digital_objects_ks_queue__ = async function (batch) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/kaltura/queue?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }
    */

    obj.get_ks_entry_ids = async function (batch) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'GET',
                url: nginx_path + '/api/v1/kaltura/queue/entry_ids?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

    /**
     * Clears the Kaltura queue
     * @returns {Promise<{success: boolean}>} Result indicating if queue was cleared
     * @throws {Error} When API key is missing or request fails
     */
    obj.clear_ks_queue = async function () {
        const REQUEST_TIMEOUT_MS = 600000;

        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        try {
            const api_key = helperModule.getParameterByName('api_key');

            // Validate API key exists and has expected format
            if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
                throw new Error('API key is required');
            }

            // URL-encode API key to prevent injection and handle special characters
            const encoded_api_key = encodeURIComponent(api_key.trim());

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/queue/clear?api_key=' + encoded_api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: REQUEST_TIMEOUT_MS
            });

            // Handle non-success status codes (204 No Content is expected for clear operations)
            if (response.status !== 204) {
                throw new Error('Request failed with status ' + response.status);
            }

            // 204 responses have no body, return success indicator
            return {
                success: true
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    /*
    obj.clear_ks_queue__ = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/queue/clear?&api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 204) {
                return response.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }
    */

    /**
     * Initializes the workspace packages display
     * @returns {Promise<void>}
     * @throws {Error} When initialization fails
     */
    obj.init = async function () {
        /**
         * Sanitizes a string for safe HTML insertion
         * @param {*} value - Value to sanitize
         * @returns {string} Sanitized string
         */
        function sanitize_html(value) {
            const string_value = value === null || value === undefined ? '' : String(value);
            return string_value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Safely sets innerHTML of an element
         * @param {string} selector - CSS selector
         * @param {string} html - HTML content to set
         * @returns {boolean} True if element found and updated, false otherwise
         */
        function set_element_html(selector, html) {
            const element = document.querySelector(selector);

            if (!element) {
                console.warn('Element not found: ' + selector);
                return false;
            }

            element.innerHTML = html;
            return true;
        }

        try {
            // Display loading message
            const loading_displayed = set_element_html(
                '#message',
                '<div class="alert alert-info"><i class="fa fa-spinner fa-spin"></i> Loading...</div>'
            );

            if (!loading_displayed) {
                console.warn('Unable to display loading message');
            }

            await astoolsModule.display_workspace_packages();

            // Clear loading message on success
            set_element_html('#message', '');

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';

            set_element_html(
                '#message',
                '<div class="alert alert-danger"><i class="fa fa-exclamation-circle"></i> ' +
                sanitize_html(error_message) +
                '</div>'
            );

            // Re-throw for upstream error handling
            throw error;
        }
    };

    return obj;

}());
