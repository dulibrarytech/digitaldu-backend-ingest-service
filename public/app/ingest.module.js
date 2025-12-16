/**

 Copyright 2023 University of Denver

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

const ingestModule = (function () {
    'use strict';

    const obj = {};
    let ingest_in_progress = 0;
    let status_timer = null;
    const NGINX_PATH = '/repo/ingester';
    const STATUS_CHECK_INTERVAL = 5000;
    const RELOAD_DELAY = 7000;

    /**
     * Sanitizes HTML string to prevent XSS attacks
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML
     */
    function sanitize_html(html) {
        const temp_div = document.createElement('div');
        temp_div.textContent = html;
        return temp_div.innerHTML;
    }

    /**
     * Validates batch name format
     * @param {string} batch - Batch name to validate
     * @returns {boolean} True if valid
     */
    function is_valid_batch(batch) {
        if (!batch || typeof batch !== 'string') {
            return false;
        }
        return batch.includes('new_') && batch.includes('-resources_');
    }

    /**
     * Safely gets element by selector
     * @param {string} selector - CSS selector
     * @returns {Element|null} DOM element or null
     */
    function get_element(selector) {
        try {
            return document.querySelector(selector);
        } catch (error) {
            console.error(`Invalid selector: ${selector}`, error);
            return null;
        }
    }

    /**
     * Creates package list HTML
     * @param {Array} packages - Array of package objects
     * @returns {string} HTML string for package list
     */
    function create_package_list_html(packages) {
        if (!Array.isArray(packages) || packages.length === 0) {
            return '<ul><li><small>No packages</small></li></ul>';
        }

        const items = packages
            .map(pkg => `<li><small>${sanitize_html(pkg.package)}</small></li>`)
            .join('');

        return `<ul>${items}</ul>`;
    }

    /**
     * Creates button HTML for ingest action
     * @param {string} batch - Batch identifier
     * @param {string} job_uuid - Job UUID
     * @param {number} ingest_status - Current ingest status (0 or 1)
     * @returns {string} HTML string for button
     */
    function create_action_button_html(batch, job_uuid, ingest_status) {
        if (ingest_status === 1) {
            return '<i class="fa fa-ban"></i>';
        }

        return `<button type="button" 
                        class="btn btn-sm btn-default run-qa" 
                        data-batch="${sanitize_html(batch)}" 
                        data-job-uuid="${sanitize_html(job_uuid)}"
                        aria-label="Start ingest for ${sanitize_html(batch)}">
                    <i class="fa fa-cogs"></i> 
                    <span>Start</span>
                </button>&nbsp;<button type="button" 
                        class="btn btn-sm btn-default delete-job" 
                        data-job-uuid="${sanitize_html(job_uuid)}"
                        aria-label="Delete job record ${sanitize_html(batch)}">
                    <i class="fa fa-trash"></i> 
                    <span>Delete</span>
                </button>`;
    } // // data-batch="${sanitize_html(batch)}"

    /**
     * Displays collection packages for ingest
     */
    async function display_packages() {

        try {

            await status_checks();

            // Clear localStorage safely
            if (typeof window.localStorage !== 'undefined') {
                window.localStorage.clear();
            }

            const records = await jobsModule.get_ingest_jobs();

            if (!records || !Array.isArray(records.data) || records.data.length === 0) {
                domModule.html('#message',
                    '<div class="alert alert-info">' +
                    '<i class="fa fa-exclamation-circle"></i> ' +
                    'No archival object folders are ready for <strong>Packaging and Ingesting</strong>' +
                    '</div>'
                );
                return false;
            }

            domModule.html('#message',
                '<div class="alert alert-info">' +
                '<i class="fa fa-exclamation-circle"></i> ' +
                'Checking for active ingests...' +
                '</div>'
            );

            const rows = [];

            for (const record of records.data) {
                const batch = record.result?.batch;
                const job_uuid = record.result?.job_uuid;
                const packages = record.result?.packages || [];

                if (!batch || !job_uuid) {
                    console.warn('Missing batch or job_uuid in record', record);
                    continue;
                }

                if (!is_valid_batch(batch)) {
                    console.log('Skipping invalid batch:', batch);
                    continue;
                }

                // Store in localStorage if available
                if (typeof window.localStorage !== 'undefined') {
                    const key = `${batch}_`;
                    try {
                        window.localStorage.setItem(key, JSON.stringify(record.result));
                    } catch (error) {
                        console.warn('Failed to store in localStorage:', error);
                    }
                }

                const package_list_html = create_package_list_html(packages);
                const action_button_html = create_action_button_html(batch, job_uuid, ingest_in_progress);

                rows.push(`
                    <tr>
                        <td style="text-align: left; vertical-align: middle; width: 40%">
                            <small>${sanitize_html(batch)}</small>
                        </td>
                        <td style="text-align: left; vertical-align: middle; width: 25%">
                            ${package_list_html}
                        </td>
                        <td style="text-align: left; vertical-align: middle; width: 5%">
                            <small>${packages.length}</small>
                        </td>
                        <td style="text-align: center; vertical-align: middle; width: 20%">
                            ${action_button_html}
                        </td>
                    </tr>
                `);
            }

            domModule.html('#packages', rows.join(''));

            const import_table = get_element('#import-table');
            if (import_table) {
                import_table.style.visibility = 'visible';
            }

        } catch (error) {
            console.error('Error in display_packages:', error);
            const error_message = sanitize_html(error.message || 'An unexpected error occurred');
            domModule.html('#message',
                `<div class="alert alert-danger">` +
                `<i class="fa fa-exclamation-circle"></i> ${error_message}` +
                `</div>`
            );
        }
    }

    /**
     * Starts ingest process
     * @param {string} batch - Batch identifier
     * @param {string} job_uuid - Job UUID
     */
    obj.start_ingest = async function (batch, job_uuid) {

        try {
            // Validate inputs
            if (!batch || typeof batch !== 'string') {
                throw new Error('Invalid batch parameter');
            }

            if (!job_uuid || typeof job_uuid !== 'string') {
                throw new Error('Invalid job_uuid parameter');
            }

            console.log('Starting ingest for batch:', batch);
            console.log('job_uuid ', job_uuid);

            // Store job UUID safely
            if (typeof window.localStorage !== 'undefined') {
                try {
                    window.localStorage.setItem('job_uuid', job_uuid);
                } catch (error) {
                    console.warn('Failed to store job_uuid:', error);
                }
            }

            domModule.html('#message',
                '<div class="alert alert-info">' +
                '<strong><i class="fa fa-info-circle"></i>&nbsp; Starting Ingest...</strong>' +
                '</div>'
            );

            // Get API key
            const api_key = helperModule.getParameterByName('api_key');
            if (!api_key) {
                throw new Error('API key is required');
            }

            // Sanitize parameters for URL
            const encoded_batch = encodeURIComponent(batch);
            const encoded_job_uuid = encodeURIComponent(job_uuid);
            const encoded_api_key = encodeURIComponent(api_key);

            const url = `${NGINX_PATH}/api/v1/ingest?batch=${encoded_batch}&job_uuid=${encoded_job_uuid}&api_key=${encoded_api_key}`;
            const response = await httpModule.req({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                const ingest_user = JSON.parse(window.sessionStorage.getItem('repo_user'));

                if (ingest_user && ingest_user.name) {
                    await jobsModule.update_job({
                        uuid: job_uuid,
                        job_run_by: ingest_user.name
                    });
                }

                await status_checks();
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }

        } catch (error) {
            console.error('Error in start_ingest:', error);
            const error_message = sanitize_html(error.message || 'An unexpected error occurred');
            domModule.html('#message',
                `<div class="alert alert-danger">` +
                `<strong><i class="fa fa-exclamation-circle"></i>&nbsp; ${error_message}</strong>` +
                `</div>`
            );
        }
    };

    /**
     * Clears the status check interval
     */
    function clear_status_timer() {
        if (status_timer !== null) {
            clearInterval(status_timer);
            status_timer = null;
        }
    }

    /**
     * Checks queue to determine ingest status
     */
    async function status_checks() {

        // Clear any existing timer first
        clear_status_timer();

        domModule.html('#message',
            '<div class="alert alert-info">' +
            '<strong><i class="fa fa-info-circle"></i>&nbsp; Checking ingest status...</strong>' +
            '</div>'
        );

        status_timer = setInterval(async () => {
            try {
                const data = await get_ingest_status();

                if (!Array.isArray(data)) {
                    console.error('Invalid data from get_ingest_status');
                    return;
                }

                domModule.html('#message', '');

                if (data.length > 0) {
                    let message = '';

                    for (const item of data) {
                        if (item.error !== null && item.is_complete === 0) {
                            clear_status_timer();
                            message = '<div class="alert alert-danger">' +
                                '<strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' +
                                'An ingest error occurred.</strong>' +
                                '</div>';
                            break;
                        } else if (item.error === null && item.is_complete === 0) {
                            ingest_in_progress = 1;
                            document.querySelector('#import-table').style.visibility = 'hidden';
                            message = '&nbsp;&nbsp;<div class="alert alert-info">' +
                                '<strong><i class="fa fa-info-circle"></i>&nbsp;&nbsp; ' +
                                'An ingest is in progress.</strong>' +
                                '<button id="stop-ingest" class="btn btn-default" type="button">' +
                                'Stop Ingest</button>' +
                                '</div>';
                        }
                    }

                    if (message) {

                        domModule.html('#message', message);

                        // Add event listener to stop button if it exists
                        const stop_button = get_element('#stop-ingest');

                        if (stop_button) {
                            // Remove existing listeners to prevent duplicates
                            const new_stop_button = stop_button.cloneNode(true);
                            stop_button.parentNode.replaceChild(new_stop_button, stop_button);

                            new_stop_button.addEventListener('click', () => {
                                const is_confirmed = confirm('Are you sure you want to stop the ingest and clear the queue? Stopping the Ingest will require you to restart the digital preservation workflow in it\'s entirety.');

                                if (is_confirmed) {
                                    ingestModule.clear_ingest_queue();
                                }
                            });
                        }
                    }

                    /*
                    if (message) {

                        domModule.html('#message', message);

                        // Add event listener to stop button if it exists
                        const stop_button = get_element('#stop-ingest');

                        if (stop_button) {
                            // Remove existing listeners to prevent duplicates
                            const new_stop_button = stop_button.cloneNode(true);
                            stop_button.parentNode.replaceChild(new_stop_button, stop_button);

                            new_stop_button.addEventListener('click', () => {
                                ingestModule.clear_ingest_queue();
                            });
                        }
                    }

                     */

                    const status_table = get_element('#ingest-status-table');
                    if (status_table) {
                        display_status_records(data);
                    }

                } else {
                    // No active ingests
                    clear_status_timer();
                    ingest_in_progress = 0;

                    const status_table = get_element('#ingest-status-table');
                    if (status_table) {
                        status_table.style.visibility = 'hidden';
                    }

                    domModule.html('#message',
                        '<div class="alert alert-info">' +
                        '<strong><i class="fa fa-info-circle"></i>&nbsp; ' +
                        'No Ingests are currently in progress.</strong>' +
                        '</div>'
                    );
                    domModule.html('#batch', '');
                }

            } catch (error) {
                console.error('Error in status_checks interval:', error);
            }

        }, STATUS_CHECK_INTERVAL);
    }

    /**
     * Gets ingest status from API
     * @returns {Promise<Array>} Array of status records
     */
    async function get_ingest_status() {

        try {

            const api_key = helperModule.getParameterByName('api_key');

            if (!api_key) {
                throw new Error('API key is required');
            }

            const encoded_api_key = encodeURIComponent(api_key);
            const url = `${NGINX_PATH}/api/v1/ingest/status?api_key=${encoded_api_key}`;

            const response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return Array.isArray(response.data) ? response.data : [];
            }

            throw new Error(`Server responded with status: ${response.status}`);

        } catch (error) {
            console.error('Error in get_ingest_status:', error);
            const error_message = sanitize_html(error.message || 'Failed to get ingest status');
            domModule.html('#message',
                `<div class="alert alert-danger">` +
                `<strong><i class="fa fa-exclamation-circle"></i>&nbsp; ${error_message}</strong>` +
                `</div>`
            );
            return [];
        }
    }

    /**
     * Displays status records in table
     * @param {Array} data - Array of status records
     */
    function display_status_records(data) {

        try {

            if (!Array.isArray(data) || data.length === 0) {
                return;
            }

            const status_table = get_element('#ingest-status-table');
            if (status_table) {
                status_table.style.visibility = 'visible';
            }

            const rows = [];

            for (const item of data) {
                if (!item || typeof item !== 'object') {
                    continue;
                }

                console.log('STATUS:', item.status);

                // Handle halted status
                if (item.status === 'INGEST HALTED') {
                    handle_halted_ingest().catch(error => {
                        console.error('Error handling halted ingest:', error);
                    });
                }

                // Handle complete status
                if (item.status === 'COMPLETE' && data.length === 1) {
                    handle_complete_ingest().catch(error => {
                        console.error('Error handling complete ingest:', error);
                    });
                    return;
                }

                // Build table row for non-pending items
                if (item.status !== 'PENDING') {
                    const error_text = item.error !== null ? sanitize_html(String(item.error)) : 'NONE';

                    rows.push(`
                        <tr>
                            <td>${sanitize_html(item.batch || '')}</td>
                            <td>${sanitize_html(item.package || '')}</td>
                            <td>${sanitize_html(item.status || '')}</td>
                            <td>${sanitize_html(item.micro_service || '')}</td>
                            <td>${error_text}</td>
                        </tr>
                    `);
                }
            }

            domModule.html('#batch', rows.join(''));

        } catch (error) {
            console.error('Error in display_status_records:', error);
            const error_message = sanitize_html(error.message || 'Failed to display status records');
            domModule.html('#message',
                `<div class="alert alert-danger">` +
                `<strong><i class="fa fa-exclamation-circle"></i>&nbsp; ${error_message}</strong>` +
                `</div>`
            );
        }
    }

    /**
     * Handles halted ingest status
     */
    async function handle_halted_ingest() {

        try {

            const job_uuid = typeof window.localStorage !== 'undefined'
                ? window.localStorage.getItem('job_uuid')
                : null;

            if (job_uuid) {
                await jobsModule.update_job({
                    uuid: job_uuid,
                    is_complete: 0
                });
            }

            const message_element = get_element('#message');
            if (message_element) {
                const clear_button = document.createElement('button');
                clear_button.textContent = 'Clear Ingest Queue';
                clear_button.className = 'btn btn-warning';
                clear_button.addEventListener('click', () => {
                    ingestModule.clear_ingest_queue();
                });

                message_element.innerHTML = '';
                const alert_div = document.createElement('div');
                alert_div.className = 'alert alert-info';
                alert_div.innerHTML = '<strong><i class="fa fa-exclamation-circle"></i>&nbsp; </strong>';
                alert_div.appendChild(clear_button);
                message_element.appendChild(alert_div);
            }

        } catch (error) {
            console.error('Error in handle_halted_ingest:', error);
        }
    }

    /**
     * Handles complete ingest status
     */
    async function handle_complete_ingest() {

        try {

            setTimeout(async () => {
                const job_uuid = typeof window.localStorage !== 'undefined'
                    ? window.localStorage.getItem('job_uuid')
                    : null;

                if (job_uuid) {
                    await jobsModule.update_job({
                        uuid: job_uuid,
                        is_complete: 1
                    });
                }

                window.location.reload();
            }, RELOAD_DELAY);

        } catch (error) {
            console.error('Error in handle_complete_ingest:', error);
        }
    }

    /**
     * Clears the ingest queue
     */
    obj.clear_ingest_queue = async function () {

        try {

            const api_key = helperModule.getParameterByName('api_key');

            if (!api_key) {
                throw new Error('API key is required');
            }

            const encoded_api_key = encodeURIComponent(api_key);
            const clear_queue_url = `${NGINX_PATH}/api/v1/ingest/queue/clear?api_key=${encoded_api_key}`;

            const response = await httpModule.req({
                method: 'POST',
                url: clear_queue_url,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                console.log('Queue cleared successfully:', response);
                domModule.html('#message',
                    '<div class="alert alert-info">' +
                    '<strong><i class="fa fa-exclamation-circle"></i>&nbsp; ' +
                    'Ingest Queue Cleared</strong>' +
                    '</div>'
                );

                // Reset ingest status and refresh
                ingest_in_progress = 0;
                await display_packages();
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }

        } catch (error) {
            console.error('Error in clear_ingest_queue:', error);
            const error_message = sanitize_html(error.message || 'Failed to clear ingest queue');
            domModule.html('#message',
                `<div class="alert alert-danger">` +
                `<strong><i class="fa fa-exclamation-circle"></i>&nbsp; ${error_message}</strong>` +
                `</div>`
            );
        }
    };

    /**
     * Cleanup function to be called when module is no longer needed
     */
    obj.cleanup = function () {
        clear_status_timer();
        console.log('Ingest module cleaned up');
    };

    /**
     * Initializes the ingest module
     */
    obj.init = async function () {

        try {

            console.log('Initializing ingest module');

            await display_packages();

            // Use event delegation for dynamically created buttons
            const packages_container = get_element('#packages');
            if (packages_container) {
                packages_container.addEventListener('click', function(event) {
                    const button = event.target.closest('.run-qa');
                    if (button) {
                        const batch = button.dataset.batch;
                        const job_uuid = button.dataset.jobUuid;

                        if (batch && job_uuid) {
                            ingestModule.start_ingest(batch, job_uuid);
                        } else {
                            console.error('Missing batch or job_uuid data attributes');
                        }
                    }
                });

                packages_container.addEventListener('click', async function(event) {
                    const button = event.target.closest('.delete-job');
                    if (button) {

                        const job_uuid = button.dataset.jobUuid;

                        if (job_uuid) {

                            let is_deleted = await jobsModule.delete_job(job_uuid);

                            if (is_deleted.success === true) {
                                window.location.reload();
                            } else {
                                console.log('unable to delete job');
                            }

                        } else {
                            console.error('Missing job_uuid data attributes');
                        }
                    }
                });

            }

        } catch (error) {
            console.error('Error in init:', error);
        }
    };

    return obj;

}());