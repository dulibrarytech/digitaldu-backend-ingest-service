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

    const obj = {};
    const NGINX_PATH = '/repo/ingester';
    const ENDPOINT = '/api/v1/astools/jobs';
    const REQUEST_TIMEOUT_MS = 600000;

    /**
     * Status code to display text mapping
     * @type {Object<number, string>}
     */
    const STATUS_MAP = Object.freeze({
        0: 'PENDING',
        1: 'SUCCESSFUL',
        2: 'FAILED'
    });

    /**
     * Status code to CSS class mapping
     * @type {Object<number, string>}
     */
    const STATUS_CLASS_MAP = Object.freeze({
        0: 'jobs-status-pending',
        1: 'jobs-status-successful',
        2: 'jobs-status-failed'
    });

    // =========================================================================
    // Utility Functions (Centralized)
    // =========================================================================

    /**
     * Sanitizes a string using DOMPurify if available, falls back to manual escaping
     * @param {*} value - Value to sanitize
     * @returns {string} Sanitized string
     */
    function sanitize_text(value) {
        const string_value = value === null || value === undefined ? '' : String(value);

        if (typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
            return DOMPurify.sanitize(string_value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
        }

        return string_value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Creates a text node with sanitized content
     * @param {*} value - Value to create text node from
     * @returns {Text} Text node
     */
    function create_text_node(value) {
        const sanitized = sanitize_text(value);
        return document.createTextNode(sanitized);
    }

    /**
     * Creates an element with optional attributes and children
     * @param {string} tag_name - HTML tag name
     * @param {Object} [attributes={}] - Element attributes
     * @param {Array<Node|string>} [children=[]] - Child nodes or text content
     * @returns {HTMLElement} Created element
     */
    function create_element(tag_name, attributes, children) {
        attributes = attributes || {};
        children = children || [];

        const element = document.createElement(tag_name);

        Object.keys(attributes).forEach(function(key) {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'dataset') {
                Object.keys(attributes[key]).forEach(function(data_key) {
                    element.dataset[data_key] = attributes[key][data_key];
                });
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });

        children.forEach(function(child) {
            if (typeof child === 'string') {
                element.appendChild(create_text_node(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });

        return element;
    }

    /**
     * Safely clears an element's content
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null} The element if found
     */
    function clear_element(selector) {
        const element = document.querySelector(selector);

        if (!element) {
            console.warn('Element not found: ' + selector);
            return null;
        }

        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }

        return element;
    }

    /**
     * Displays a message in the specified element using DOM methods
     * @param {string} selector - CSS selector
     * @param {string} type - Alert type (info, danger, success, warning)
     * @param {string} message - Message text
     * @param {string} [icon='fa-exclamation-circle'] - Font Awesome icon class
     * @returns {boolean} True if displayed successfully
     */
    function display_message(selector, type, message, icon) {
        icon = icon || 'fa-exclamation-circle';

        const container = clear_element(selector);

        if (!container) {
            return false;
        }

        const icon_element = create_element('i', { className: 'fa ' + icon });
        const text_node = document.createTextNode(' ' + sanitize_text(message));
        const alert_div = create_element('div', { className: 'alert alert-' + type }, [icon_element, text_node]);

        container.appendChild(alert_div);
        return true;
    }

    /**
     * Safely parses JSON string
     * @param {string} json_string - JSON string to parse
     * @returns {Array} Parsed array or empty array on failure
     */
    function safe_parse_json(json_string) {
        if (!json_string || typeof json_string !== 'string') {
            return [];
        }

        try {
            const parsed = JSON.parse(json_string);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Validates and encodes API key
     * @returns {string} Encoded API key
     * @throws {Error} If API key is missing or invalid
     */
    function get_encoded_api_key() {
        const api_key = helperModule.getParameterByName('api_key');

        if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
            throw new Error('API key is required');
        }

        return encodeURIComponent(api_key.trim());
    }

    // =========================================================================
    // API Functions
    // =========================================================================

    /**
     * Fetches an active job by UUID
     * @param {string} job_uuid - The UUID of the job to fetch
     * @returns {Promise<{data: Array}>} Job data response object
     * @throws {Error} When job UUID or API key is missing, or request fails
     */
    obj.get_active_job = async function (job_uuid) {
        try {
            if (!job_uuid || typeof job_uuid !== 'string' || job_uuid.trim() === '') {
                throw new Error('Job UUID is required');
            }

            const encoded_uuid = encodeURIComponent(job_uuid.trim());
            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'GET',
                url: NGINX_PATH + ENDPOINT + '?uuid=' + encoded_uuid + '&api_key=' + encoded_api_key,
                headers: { 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            if (!response.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
                throw new Error('Job not found');
            }

            const job_record = response.data.data[0];

            return {
                data: [{
                    result: {
                        batch: job_record.batch_name || '',
                        packages: safe_parse_json(job_record.packages),
                        is_kaltura: Boolean(job_record.is_kaltura)
                    }
                }]
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            console.error('get_active_job error:', error_message);
            throw error;
        }
    };

    /**
     * Fetches metadata jobs from the API
     * @returns {Promise<{data: Array}>} Metadata jobs response object
     * @throws {Error} When API key is missing or request fails
     */
    obj.get_metadata_jobs = async function () {
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
            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'GET',
                url: NGINX_PATH + ENDPOINT + '/metadata?api_key=' + encoded_api_key,
                headers: { 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            if (!response.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }

            const jobs_data = response.data.data;

            if (jobs_data.length === 0) {
                return { data: [] };
            }

            return {
                data: jobs_data.map(transform_job_record)
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    /**
     * Fetches ingest jobs from the API
     * @returns {Promise<{data: Array}>} Ingest jobs response object
     * @throws {Error} When API key is missing or request fails
     */
    obj.get_ingest_jobs = async function () {
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
            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'GET',
                url: NGINX_PATH + ENDPOINT + '/ingest?api_key=' + encoded_api_key,
                headers: { 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            if (!response.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }

            const jobs_data = response.data.data;

            if (jobs_data.length === 0) {
                return { data: [] };
            }

            return {
                data: jobs_data.map(transform_job_record)
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    /**
     * Fetches job history from the API
     * @returns {Promise<{data: Array}>} Job history response object
     * @throws {Error} When API key is missing or request fails
     */
    obj.get_jobs_history = async function () {
        try {
            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'GET',
                url: NGINX_PATH + ENDPOINT + '/history?api_key=' + encoded_api_key,
                headers: { 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            if (!response.data || !Array.isArray(response.data.data)) {
                throw new Error('Invalid response format');
            }

            const jobs_data = response.data.data;

            if (jobs_data.length === 0) {
                return { data: [] };
            }

            const transformed_data = jobs_data.map(function (job) {
                return Object.assign({}, job, {
                    is_kaltura: Boolean(job.is_kaltura)
                });
            });

            return { data: transformed_data };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    /**
     * Updates a job via the API
     * @param {Object} job - Job data to update
     * @returns {Promise<{success: boolean, data: Object}>} Update result
     * @throws {Error} When job data or API key is missing, or request fails
     */
    obj.update_job = async function (job) {
        try {
            if (!job || typeof job !== 'object' || Array.isArray(job)) {
                throw new Error('Valid job data is required');
            }

            if (!job.uuid && !job.id) {
                throw new Error('Job must have a uuid or id');
            }

            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'PUT',
                url: NGINX_PATH + '/api/v1/astools/jobs?api_key=' + encoded_api_key,
                data: job,
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            });

            if (response.status !== 200) {
                throw new Error('Request failed with status ' + response.status);
            }

            return {
                success: true,
                data: response.data || {}
            };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    /**
     * Gets Kaltura entry IDs
     * @returns {Promise<Object>} Kaltura entry IDs data
     */
    obj.get_ks_entry_ids = async function () {
        try {
            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'GET',
                url: NGINX_PATH + '/api/v1/kaltura/queue/entry_ids?api_key=' + encoded_api_key,
                headers: { 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (response.status === 200) {
                return response.data;
            }

            throw new Error('Request failed with status ' + response.status);

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    /**
     * Clears the Kaltura queue
     * @returns {Promise<{success: boolean}>} Result indicating if queue was cleared
     * @throws {Error} When API key is missing or request fails
     */
    obj.clear_ks_queue = async function () {
        try {
            const encoded_api_key = get_encoded_api_key();

            const response = await httpModule.req({
                method: 'POST',
                url: NGINX_PATH + '/api/v1/kaltura/queue/clear?api_key=' + encoded_api_key,
                headers: { 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            });

            if (response.status !== 204) {
                throw new Error('Request failed with status ' + response.status);
            }

            return { success: true };

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    // =========================================================================
    // Display Functions
    // =========================================================================

    /**
     * Builds a package list element using DOM methods
     * @param {string} packages_json - JSON string of packages
     * @returns {HTMLUListElement} Unordered list element containing packages
     */
    function build_package_list_element(packages_json) {
        const packages = safe_parse_json(packages_json);
        const ul = create_element('ul', { className: 'jobs-package-list' });

        if (packages.length === 0) {
            const li = create_element('li', {}, ['No packages']);
            ul.appendChild(li);
            return ul;
        }

        packages.forEach(function(pkg) {
            const package_name = pkg && pkg.package ? pkg.package : '';
            const li = create_element('li', { title: package_name }, [package_name]);
            ul.appendChild(li);
        });

        return ul;
    }

    /**
     * Creates a status badge element
     * @param {number} status_code - Status code (0, 1, or 2)
     * @returns {HTMLSpanElement} Status badge element
     */
    function create_status_badge(status_code) {
        const status_text = STATUS_MAP[status_code] || 'UNKNOWN';
        const status_class = STATUS_CLASS_MAP[status_code] || 'jobs-status-unknown';

        return create_element('span', { className: 'jobs-status ' + status_class }, [status_text]);
    }

    /**
     * Creates a table cell with text content
     * @param {string} content - Cell text content
     * @param {string} [additional_class] - Additional CSS class
     * @returns {HTMLTableCellElement} Table cell element
     */
    function create_text_cell(content, additional_class) {
        const span = create_element('span', {
            className: 'jobs-cell-text',
            title: content || ''
        }, [content || '']);

        const td = create_element('td');

        if (additional_class) {
            td.className = additional_class;
        }

        td.appendChild(span);
        return td;
    }

    /**
     * Builds table row element for a single job record using DOM methods
     * @param {Object} record - Job record object
     * @returns {HTMLTableRowElement} Table row element
     */
    function build_table_row_element(record) {
        const tr = create_element('tr');

        // Job ID
        tr.appendChild(create_text_cell(record.uuid));

        // Job Type
        tr.appendChild(create_text_cell(record.job_type));

        // Status (with badge)
        const status_td = create_element('td');
        status_td.appendChild(create_status_badge(record.is_complete));
        tr.appendChild(status_td);

        // Collection Folder
        tr.appendChild(create_text_cell(record.batch_name));

        // Packages
        const packages_td = create_element('td', { className: 'jobs-packages-cell' });
        packages_td.appendChild(build_package_list_element(record.packages));
        tr.appendChild(packages_td);

        // Job Run By
        tr.appendChild(create_text_cell(record.job_run_by));

        // Date
        tr.appendChild(create_text_cell(record.job_date));

        return tr;
    }

    /**
     * Displays job history in a DataTable
     * @returns {Promise<boolean>} False if no records found, true otherwise
     */
    obj.display_jobs_history = async function () {
        try {
            const records = await jobsModule.get_jobs_history();

            if (!records || !Array.isArray(records.data)) {
                throw new Error('Invalid response format');
            }

            if (records.data.length === 0) {
                display_message('#message', 'info', 'No jobs found');
                return false;
            }

            // Get tbody element and clear existing content
            const tbody = clear_element('#jobs-history');

            if (!tbody) {
                throw new Error('Table body element not found');
            }

            // Use DocumentFragment for efficient batch DOM insertion
            const fragment = document.createDocumentFragment();

            records.data.forEach(function(record) {
                fragment.appendChild(build_table_row_element(record));
            });

            tbody.appendChild(fragment);

            // Initialize DataTable with optimized configuration
            new DataTable('#jobs-history-table', {
                paging: true,
                pageLength: 25,
                lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, 'All']],
                ordering: true,
                order: [[6, 'desc']], // Sort by date descending
                searching: true,
                info: true,
                autoWidth: false, // Respect CSS column widths
                responsive: false,
                language: {
                    emptyTable: 'No jobs available',
                    loadingRecords: 'Loading...',
                    processing: 'Processing...',
                    search: 'Filter:',
                    zeroRecords: 'No matching jobs found'
                },
                columnDefs: [
                    {
                        targets: [0, 1, 2, 3, 5, 6],
                        className: 'dt-head-left dt-body-left'
                    },
                    {
                        targets: 4, // Packages column
                        orderable: false,
                        className: 'dt-head-left dt-body-left'
                    }
                ]
            });

            // Show table after DataTable initialization
            const table_element = document.querySelector('#jobs-history-table');

            if (table_element) {
                table_element.style.visibility = 'visible';
            }

            // Clear any loading messages
            clear_element('#message');

            return true;

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    /**
     * Initializes the workspace packages display
     * @returns {Promise<void>}
     * @throws {Error} When initialization fails
     */
    obj.init = async function () {
        try {
            display_message('#message', 'info', 'Loading...', 'fa-spinner fa-spin');

            await astoolsModule.display_workspace_packages();

            clear_element('#message');

        } catch (error) {
            const error_message = error instanceof Error ? error.message : 'An unexpected error occurred';
            display_message('#message', 'danger', error_message);
            throw error;
        }
    };

    return obj;

}());
