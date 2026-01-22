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

const astoolsModule = (function () {

    'use strict';

    let obj = {};
    const nginx_path = '/repo/ingester';

    /**
     * Retrieves workspace packages from the API
     * @returns {Promise<Object|null>} - Package data or null on error
     */
    obj.get_workspace_packages = async function() {

        try {

            // Validate API key exists (use original module name)
            const api_key = helperModule.getParameterByName('api_key');

            if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
                throw new Error('API key is required');
            }

            // Make request with API key in header (more secure than URL)
            const response = await httpModule.req({
                method: 'GET',
                url: `${nginx_path}/api/v1/astools/workspace`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-API-Key': api_key.trim()
                },
                timeout: 30000
            });

            // Validate response
            if (!response) {
                throw new Error('Empty response from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            // Validate response data structure
            if (!response.data || typeof response.data !== 'object') {
                throw new Error('Invalid response data structure');
            }

            return response.data;

        } catch (error) {
            console.error('ERROR: [get_workspace_packages]', error.message);

            // Display user-friendly error message
            display_error_message(
                'Unable to retrieve workspace packages. Please try again.',
                error.message
            );

            return null;
        }
    };

    /**
     * Displays workspace packages in the UI
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    obj.display_workspace_packages = async function() {

        try {
            // Clear any existing messages
            clear_message_area();

            // Show loading indicator
            show_loading_indicator('#packages-container');

            // Get workspace packages
            const response = await astoolsModule.get_workspace_packages();

            // Validate response
            if (!response) {
                throw new Error('Failed to retrieve workspace packages');
            }

            if (!response.data || !Array.isArray(response.data)) {
                throw new Error('Invalid response data structure');
            }

            const records = response.data;

            // Filter valid collection folders
            const collection_folders = filter_collection_folders(records);

            // Check if any folders are ready
            if (collection_folders.length === 0) {
                display_info_message('No collection folders are ready');
                hide_workspace_table();
                return false;
            }

            // Store and render packages
            store_package_data(collection_folders);
            render_workspace_packages(collection_folders);

            // Get and store Kaltura session
            await initialize_kaltura_session();

            // Show the workspace table
            show_workspace_table();
            clear_message_area();

            return true;

        } catch (error) {
            console.error('ERROR: [display_workspace_packages]', error.message);

            display_error_message(
                'Unable to display workspace packages. Please refresh the page.',
                error.message
            );

            hide_workspace_table();
            return false;
        } finally {
            // Always hide loading indicator
            hide_loading_indicator();
        }
    };

    /**
     * Filters collection folders based on naming conventions
     * @param {Array} records - Array of package records
     * @returns {Array} - Filtered collection folders
     */
    const filter_collection_folders = function(records) {
        if (!Array.isArray(records)) {
            return [];
        }

        const collection_folders = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];

            // Validate record structure
            if (!record || typeof record !== 'object') {
                continue;
            }

            // Check for result object
            if (!record.result || typeof record.result !== 'object') {
                continue;
            }

            // Check for batch name
            if (!record.result.batch || typeof record.result.batch !== 'string') {
                continue;
            }

            const batch_name = record.result.batch;

            // Filter based on naming convention
            // Must contain 'new_' AND '-resources_'
            if (batch_name.includes('new_') && batch_name.includes('-resources_')) {
                collection_folders.push(record);
            } else {
                console.info('Filtering out batch:', batch_name);
            }
        }

        return collection_folders;
    };

    /**
     * Stores package data in localStorage with validation
     * @param {Array} collection_folders - Array of collection folder objects
     */
    const store_package_data = function(collection_folders) {

        if (!Array.isArray(collection_folders)) {
            return;
        }

        // Check if localStorage is available
        if (!is_local_storage_available()) {
            console.warn('localStorage is not available');
            return;
        }

        for (let i = 0; i < collection_folders.length; i++) {
            const folder = collection_folders[i];

            if (!folder || !folder.result || !folder.result.batch) {
                continue;
            }

            const batch_name = sanitize_batch_name(folder.result.batch);

            try {
                // Store the package data
                window.localStorage.setItem(
                    batch_name,
                    JSON.stringify(folder.result)
                );
            } catch (error) {
                console.error('Failed to store package data in localStorage:', error.message);
            }
        }
    };

    /**
     * Renders workspace packages in the DOM using safe methods
     * @param {Array} collection_folders - Array of collection folder objects
     */
    const render_workspace_packages = function(collection_folders) {
        if (!Array.isArray(collection_folders) || collection_folders.length === 0) {
            return;
        }

        const packages_container = document.getElementById('packages');

        if (!packages_container) {
            console.error('Packages container not found');
            return;
        }

        // Create document fragment for efficient DOM operations
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < collection_folders.length; i++) {
            const folder = collection_folders[i];

            if (!folder || !folder.result) {
                continue;
            }

            const result = folder.result;
            const batch_name = result.batch || 'Unknown';
            const is_kaltura = result.is_kaltura === true;
            const packages = result.packages || [];

            // Create table row
            const row = create_package_row(batch_name, packages, is_kaltura);

            if (row) {
                fragment.appendChild(row);
            }
        }

        // Clear existing content safely and append new content
        clear_element(packages_container);
        packages_container.appendChild(fragment);

        // Set up event delegation for action buttons
        setup_action_button_listeners();
    };

    /**
     * Creates a table row element for a package
     * @param {string} batch_name - The batch folder name
     * @param {Array} packages - Array of package objects
     * @param {boolean} is_kaltura - Whether this is a Kaltura item
     * @returns {HTMLElement|null} - Table row element or null
     */
    const create_package_row = function(batch_name, packages, is_kaltura) {

        try {

            // Sanitize batch name
            const safe_batch_name = sanitize_text(batch_name);

            // Create row
            const row = document.createElement('tr');
            row.dataset.batch = safe_batch_name;
            row.dataset.kaltura = is_kaltura ? 'true' : 'false';

            // Create batch name cell
            const batch_cell = document.createElement('td');
            batch_cell.className = 'batch-name-cell';
            const batch_text = document.createElement('small');
            batch_text.textContent = safe_batch_name;
            batch_cell.appendChild(batch_text);
            row.appendChild(batch_cell);

            // Create packages list cell
            const packages_cell = document.createElement('td');
            packages_cell.className = 'packages-list-cell';
            const package_list = create_package_list(packages);
            packages_cell.appendChild(package_list);
            row.appendChild(packages_cell);

            // Create type cell
            const type_cell = document.createElement('td');
            type_cell.className = 'type-cell';
            const type_text = document.createElement('small');
            type_text.textContent = is_kaltura ? 'Kaltura Items' : 'Non Kaltura Items';
            type_cell.appendChild(type_text);
            row.appendChild(type_cell);

            // Create actions cell
            const actions_cell = document.createElement('td');
            actions_cell.className = 'actions-cell';
            const action_button = create_action_button(safe_batch_name);
            actions_cell.appendChild(action_button);
            row.appendChild(actions_cell);

            return row;

        } catch (error) {
            console.error('Error creating package row:', error.message);
            return null;
        }
    };

    /**
     * Creates a package list element
     * @param {Array} packages - Array of package objects
     * @returns {HTMLElement} - UL element with package list
     */
    const create_package_list = function(packages) {
        const list = document.createElement('ul');
        list.className = 'package-list';

        if (!Array.isArray(packages) || packages.length === 0) {
            const empty_item = document.createElement('li');
            empty_item.textContent = 'No packages';
            list.appendChild(empty_item);
            return list;
        }

        for (let i = 0; i < packages.length; i++) {
            const package_data = packages[i];

            if (!package_data || typeof package_data !== 'object') {
                continue;
            }

            const package_name = package_data.package ||
                package_data.name ||
                package_data.package_name ||
                'Unknown package';

            const list_item = document.createElement('li');
            const small_text = document.createElement('small');
            small_text.textContent = sanitize_text(package_name);
            list_item.appendChild(small_text);
            list.appendChild(list_item);
        }

        return list;
    };

    /**
     * Creates an action button element
     * @param {string} batch_name - The batch name
     * @returns {HTMLElement} - Button element
     */
    const create_action_button = function(batch_name) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-default run-qa action-start-button';
        button.dataset.batch = batch_name;

        // Create icon
        const icon = document.createElement('i');
        icon.className = 'fa fa-cogs';
        icon.setAttribute('aria-hidden', 'true');

        // Create text span
        const text = document.createElement('span');
        text.textContent = ' Start';

        button.appendChild(icon);
        button.appendChild(text);

        return button;
    };

    /**
     * Sets up event delegation for action buttons
     */
    const setup_action_button_listeners = function() {
        const packages_container = document.getElementById('packages');

        if (!packages_container) {
            return;
        }

        // Remove any existing listener
        packages_container.removeEventListener('click', handle_action_button_click);

        // Add event listener with delegation
        packages_container.addEventListener('click', handle_action_button_click);
    };

    /**
     * Handles action button clicks
     * @param {Event} event - Click event
     */
    const handle_action_button_click = function(event) {
        const button = event.target.closest('.action-start-button');

        if (!button) {
            return;
        }

        event.preventDefault();

        const batch_name = button.dataset.batch;

        if (!batch_name || typeof batch_name !== 'string' || batch_name.trim().length === 0) {
            display_error_message('Invalid batch name');
            return;
        }

        // Call the make_digital_objects function
        if (astoolsModule && typeof astoolsModule.make_digital_objects === 'function') {
            astoolsModule.make_digital_objects(batch_name);
        } else {
            display_error_message('Unable to start digital object creation');
        }
    };

    /**
     * Initializes Kaltura session
     * @returns {Promise<void>}
     */
    const initialize_kaltura_session = async function() {

        try {

            if (typeof get_ks !== 'function') {
                console.warn('get_ks function not available');
                return;
            }

            const ks = await get_ks();

            if (ks && is_local_storage_available()) {
                window.localStorage.setItem('ks', ks);
            }
        } catch (error) {
            console.error('Failed to initialize Kaltura session:', error.message);
        }
    };

    /**
     * Sanitizes text to prevent XSS
     * @param {string} text - Text to sanitize
     * @returns {string} - Sanitized text
     */
    const sanitize_text = function(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        const temp_div = document.createElement('div');
        temp_div.textContent = text;
        return temp_div.textContent;
    };

    /**
     * Sanitizes batch name for use in data attributes
     * @param {string} batch_name - Batch name to sanitize
     * @returns {string} - Sanitized batch name
     */
    const sanitize_batch_name = function(batch_name) {
        if (!batch_name || typeof batch_name !== 'string') {
            return '';
        }

        return batch_name.trim();
    };

    /**
     * Checks if localStorage is available
     * @returns {boolean} - True if available, false otherwise
     */
    const is_local_storage_available = function() {
        try {
            const test_key = '__localStorage_test__';
            window.localStorage.setItem(test_key, 'test');
            window.localStorage.removeItem(test_key);
            return true;
        } catch (error) {
            return false;
        }
    };

    /**
     * Safely clears an element's contents
     * @param {HTMLElement} element - Element to clear
     */
    const clear_element = function(element) {
        if (!element) {
            return;
        }

        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    };

    /**
     * Displays an error message to the user
     * @param {string} user_message - User-friendly message
     * @param {string} [technical_message] - Technical error details
     */
    const display_error_message = function(user_message, technical_message) {
        const message_container = document.getElementById('message');

        if (!message_container) {
            console.error('Message container not found');
            return;
        }

        clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' ' + sanitize_text(user_message));

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);

        if (technical_message) {
            console.error('Technical error:', technical_message);
        }

        message_container.appendChild(alert_div);
    };

    /**
     * Displays an info message to the user
     * @param {string} message - Info message
     */
    const display_info_message = function(message) {
        const message_container = document.getElementById('message');

        if (!message_container) {
            return;
        }

        clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-info';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-info-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' ' + sanitize_text(message));

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);

        message_container.appendChild(alert_div);
    };

    /**
     * Clears the message area
     */
    const clear_message_area = function() {
        const message_container = document.getElementById('message');

        if (message_container) {
            clear_element(message_container);
        }
    };

    /**
     * Shows the workspace table
     */
    const show_workspace_table = function() {
        const table = document.getElementById('digital-object-workspace-table');

        if (table) {
            table.style.visibility = 'visible';
            table.style.display = 'table';
        }
    };

    /**
     * Hides the workspace table
     */
    const hide_workspace_table = function() {
        const table = document.getElementById('digital-object-workspace-table');

        if (table) {
            table.style.visibility = 'hidden';
            table.style.display = 'none';
        }
    };

    /**
     * Shows loading indicator
     * @param {string} selector - Container selector
     */
    const show_loading_indicator = function(selector) {
        const container = document.querySelector(selector || '#packages-container');

        if (container) {
            const loading_div = document.createElement('div');
            loading_div.id = 'loading-indicator';
            loading_div.className = 'loading-indicator';
            loading_div.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Loading...';
            container.appendChild(loading_div);
        }
    };

    /**
     * Hides loading indicator
     */
    const hide_loading_indicator = function() {
        const loading = document.getElementById('loading-indicator');

        if (loading && loading.parentNode) {
            loading.parentNode.removeChild(loading);
        }
    };

    async function get_ks() {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/session?api_key=' + api_key,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data.ks;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    async function get_entry_ids(data) {

        try {

            const ks = localStorage.getItem('ks');

            if (ks === null) {
                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Unable to get Kaltura session token.</div>');
                return false;
            }

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/kaltura/metadata?&session=' + ks,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: data
            });

            if (response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-info"><i class=""></i> ' + error.message + '</div>');
        }
    }

    /**
     * Constants for the digital objects creation process
     */
    const DIGITAL_OBJECTS_CONFIG = {
        POLLING_INTERVAL: 2500,
        COMPLETION_DELAY: 5000,
        REQUEST_TIMEOUT: 600000,
        MAX_POLLING_ATTEMPTS: 240 // 10 minutes at 2.5 second intervals
    };

    /**
     * Creates digital objects for a batch
     * @param {string} batch - The batch name
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    obj.make_digital_objects = async function(batch) {
        let before_unload_handler = null;
        let polling_interval = null;

        try {
            // Validate batch parameter
            if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
                display_error_message('Invalid batch parameter');
                return false;
            }

            const safe_batch_name = batch.trim();

            // Set up beforeunload handler
            before_unload_handler = function(event) {
                const message = 'Job is still running. Are you sure you want to leave?';
                event.preventDefault();
                event.returnValue = message;
                return message;
            };

            window.addEventListener('beforeunload', before_unload_handler);

            // Hide workspace table
            hide_workspace_table();

            // Retrieve and validate batch data
            const batch_data = get_batch_data_from_storage(safe_batch_name);
            if (!batch_data) {
                display_error_message('Unable to get batch data');
                return false;
            }

            // Get API key
            const api_key = helperModule.getParameterByName('api_key');
            if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
                display_error_message('Permission Denied: API key is required');
                return false;
            }

            // Get user information
            const ingest_user = get_ingest_user_from_storage();
            if (!ingest_user) {
                display_error_message('User information not found. Please log in again.');
                return false;
            }

            // Generate job UUID
            const job_uuid = generate_job_uuid();

            // Determine if this is a Kaltura job
            const is_kaltura = get_kaltura_status(safe_batch_name);

            // Prepare job data
            const job = create_job_object(
                job_uuid,
                safe_batch_name,
                batch_data.packages,
                is_kaltura,
                ingest_user.name
            );

            // Submit job
            const job_submitted = await submit_digital_objects_job(job, api_key);
            if (!job_submitted) {
                display_error_message('Failed to submit job');
                return false;
            }

            // Process based on job type
            if (is_kaltura) {
                await process_kaltura_job(job_uuid, safe_batch_name, batch_data, api_key);
            } else {
                await process_standard_job(job_uuid, safe_batch_name, batch_data, is_kaltura);
            }

            return true;

        } catch (error) {
            console.error('ERROR: [make_digital_objects]', error.message, error.stack);
            display_error_message('An error occurred while creating digital objects: ' + sanitize_text(error.message));
            return false;

        } finally {
            // Cleanup: remove event listener and clear any polling intervals
            if (before_unload_handler) {
                window.removeEventListener('beforeunload', before_unload_handler);
            }

            if (polling_interval) {
                clearInterval(polling_interval);
            }
        }
    };

    /**
     * Retrieves batch data from localStorage with validation
     * @param {string} batch_name - The batch name
     * @returns {Object|null} - Parsed batch data or null
     */
    const get_batch_data_from_storage = function(batch_name) {

        try {

            if (!is_local_storage_available()) {
                console.error('localStorage is not available');
                return null;
            }

            const batch_data_string = window.localStorage.getItem(batch_name);

            if (!batch_data_string) {
                console.error('Batch data not found in localStorage');
                return null;
            }

            const batch_data = JSON.parse(batch_data_string);

            // Validate batch data structure
            if (!batch_data || typeof batch_data !== 'object') {
                console.error('Invalid batch data structure');
                return null;
            }

            if (!Array.isArray(batch_data.packages) || batch_data.packages.length === 0) {
                console.error('Batch data missing packages array');
                return null;
            }

            return batch_data;

        } catch (error) {
            console.error('Failed to retrieve batch data:', error.message);
            return null;
        }
    };

    /**
     * Retrieves ingest user from sessionStorage with validation
     * @returns {Object|null} - User object or null
     */

    const get_ingest_user_from_storage = function() {

        try {

            if (!is_session_storage_available()) {
                console.error('sessionStorage is not available');
                return null;
            }

            const user_data_string = window.sessionStorage.getItem('repo_user');

            if (!user_data_string) {
                console.error('User data not found in sessionStorage');
                return null;
            }

            const user_data = JSON.parse(user_data_string);

            // Validate user data structure
            if (!typeof user_data === 'object' || user_data.length === 0) {
                console.error('Invalid user data structure');
                return null;
            }

            const user = user_data;

            if (!user || !user.name) {
                console.error('User data missing name field');
                return null;
            }

            return user;

        } catch (error) {
            console.error('Failed to retrieve user data:', error.message);
            return null;
        }
    };

    /**
     * Generates a job UUID
     * @returns {string} - UUID string
     */
    const generate_job_uuid = function() {
        if (self.crypto && typeof self.crypto.randomUUID === 'function') {
            return self.crypto.randomUUID();
        }

        // Fallback UUID generation for older browsers
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    /**
     * Gets Kaltura status for a batch
     * @param {string} batch_name - The batch name
     * @returns {number} - 1 for Kaltura, 0 for non-Kaltura
     */
    const get_kaltura_status = function (batch_name) {
        console.log('get_kaltura_status', batch_name);

        try {
            // Find the <tr> that matches the batch name
            const row = document.querySelector(
                `tr[data-batch="${CSS.escape(batch_name)}"]`
            );

            console.log('get_kaltura_status row', row);

            if (!row) {
                return 0;
            }

            // Access data-kaltura via dataset
            // data-kaltura="true" -> row.dataset.kaltura === "true"
            return row.dataset.kaltura === 'true' ? 1 : 0;

        } catch (error) {
            console.error('get_kaltura_status error', error);
            return 0;
        }
    };

    /**
     * Creates a job object
     * @param {string} job_uuid - Job UUID
     * @param {string} batch_name - Batch name
     * @param {Array} packages - Packages array
     * @param {number} is_kaltura - Kaltura flag (1 or 0)
     * @param {string} user_name - User name
     * @returns {Object} - Job object
     */
    const create_job_object = function(job_uuid, batch_name, packages, is_kaltura, user_name) {
        return {
            uuid: job_uuid,
            job_type: 'make_digital_objects',
            batch_name: batch_name,
            packages: packages,
            is_kaltura: is_kaltura,
            log: '---',
            error: '---',
            job_run_by: user_name
        };
    };

    /**
     * Submits digital objects job to the API
     * @param {Object} job - Job object
     * @param {string} api_key - API key
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const submit_digital_objects_job = async function(job, api_key) {

        try {
            // Validate job object
            if (!job || typeof job !== 'object') {
                console.error('Invalid job object');
                return false;
            }

            display_info_message(`Submitting job for batch: ${sanitize_text(job.batch_name)}`);

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/jobs`,
                data: job,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-API-Key': api_key
                },
                timeout: DIGITAL_OBJECTS_CONFIG.REQUEST_TIMEOUT
            });

            // Validate response
            if (!response || response.status !== 200) {
                console.error('Job submission failed:', response?.status);
                return false;
            }

            console.log('Job submitted successfully:', response.data);
            return true;

        } catch (error) {
            console.error('Failed to submit job:', error.message);
            display_error_message('Failed to submit job to server');
            return false;
        }
    };

    /**
     * Processes a Kaltura job
     * @param {string} job_uuid - Job UUID
     * @param {string} batch_name - Batch name
     * @param {Object} batch_data - Batch data
     * @param {string} api_key - API key
     * @returns {Promise<void>}
     */
    const process_kaltura_job = async function(job_uuid, batch_name, batch_data, api_key) {

        try {
            console.log('job_uuid', job_uuid);
            console.log('batch_name', batch_name);
            console.log('batch_data', batch_data);

            display_info_message(`(${sanitize_text(batch_name)}) Retrieving Entry IDs from Kaltura...`);

            // Get entry IDs from Kaltura
            const entry_ids_retrieved = await get_entry_ids(batch_data);

            console.log('entry_ids_retrieved', entry_ids_retrieved);

            if (!entry_ids_retrieved) {
                throw new Error('Failed to retrieve Kaltura entry IDs');
            }

            // Poll for completion
            const kaltura_files = await poll_kaltura_queue(job_uuid, batch_name);

            if (!kaltura_files) {
                throw new Error('Failed to process Kaltura queue');
            }
            console.log('kaltura_files retrieved', kaltura_files);

            // Initialize digital objects creation
            await make_digital_objects_init(job_uuid, batch_name, batch_data, kaltura_files, 1);

        } catch (error) {
            console.error('Kaltura job processing failed:', error.message);

            // Update job status to failed
            await update_job_status(job_uuid, 2);

            display_error_message('Kaltura job failed: ' + sanitize_text(error.message));
            throw error;
        }
    };

    /**
     * Polls the Kaltura queue until complete
     * @param {string} job_uuid - Job UUID
     * @param {string} batch_name - Batch name
     * @returns {Promise<Array|null>} - Array of files or null on error
     */
    const poll_kaltura_queue = async function(job_uuid, batch_name) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const max_attempts = DIGITAL_OBJECTS_CONFIG.MAX_POLLING_ATTEMPTS;

            const polling_interval = setInterval(async () => {
                try {
                    attempts++;

                    // Check if max attempts reached
                    if (attempts > max_attempts) {
                        clearInterval(polling_interval);
                        reject(new Error('Kaltura queue polling timed out'));
                        return;
                    }

                    // Check queue status
                    const response = await jobsModule.check_make_digital_objects_ks_queue();

                    if (!response || !response.data) {
                        console.warn('Invalid response from queue check');
                        return;
                    }

                    // Queue still has items, continue polling
                    if (response.data.length > 0) {
                        console.log(`Kaltura queue status: ${response.data.length} items remaining`);
                        return;
                    }

                    // Queue is empty, processing complete
                    clearInterval(polling_interval);
                    console.log('Kaltura queue processing complete');

                    // Wait a bit before getting final results
                    setTimeout(async () => {
                        try {
                            const files = await process_kaltura_results(job_uuid);
                            await jobsModule.clear_ks_queue();
                            resolve(files);
                        } catch (error) {
                            reject(error);
                        }
                    }, DIGITAL_OBJECTS_CONFIG.COMPLETION_DELAY);

                } catch (error) {
                    clearInterval(polling_interval);
                    reject(error);
                }
            }, DIGITAL_OBJECTS_CONFIG.POLLING_INTERVAL);
        });
    };

    /**
     * Processes Kaltura results and handles errors
     * @param {string} job_uuid - Job UUID
     * @returns {Promise<Array>} - Array of valid files
     */
    const process_kaltura_results = async function(job_uuid) {

        try {
            // Get entry IDs
            const ids_response = await jobsModule.get_ks_entry_ids();
            console.log('KALTURA IDs ', ids_response);
            if (!ids_response || !ids_response.data || !Array.isArray(ids_response.data)) {
                throw new Error('Invalid entry IDs response');
            }

            const files = [];
            const errors = [];

            // Process each entry
            for (let i = 0; i < ids_response.data.length; i++) {
                const entry = ids_response.data[i];

                if (!entry || typeof entry !== 'object') {
                    continue;
                }

                const entry_data = {
                    status: entry.status,
                    file: entry.file || 'Unknown file',
                    message: entry.message || '',
                    entry_id: entry.entry_id || ''
                };

                if (entry.status !== 1) {
                    errors.push(entry_data);
                } else {
                    files.push(entry_data);
                }
            }

            // Handle errors
            if (errors.length > 0) {
                const error_message = format_kaltura_errors(errors);

                // Update job status to failed
                await update_job_status(job_uuid, 2);

                display_error_message(error_message);
                throw new Error('Kaltura processing completed with errors');
            }

            return files;

        } catch (error) {
            console.error('Failed to process Kaltura results:', error.message);
            throw error;
        }
    };

    /**
     * Formats Kaltura errors for display
     * @param {Array} errors - Array of error objects
     * @returns {string} - Formatted error message
     */
    const format_kaltura_errors = function(errors) {
        if (!Array.isArray(errors) || errors.length === 0) {
            return 'Unknown Kaltura error occurred';
        }

        const error_messages = [];

        for (let i = 0; i < errors.length; i++) {
            const error = errors[i];
            let message = `${sanitize_text(error.file)}: ${sanitize_text(error.message)}`;

            // Handle multiple entry ID errors
            if (error.status === 2 && error.entry_id) {
                try {
                    const id_errors = JSON.parse(error.entry_id);
                    if (Array.isArray(id_errors)) {
                        message += ` Entry IDs: ${id_errors.map(id => sanitize_text(String(id))).join(', ')}`;
                    }
                } catch (parse_error) {
                    console.error('Failed to parse entry ID errors:', parse_error.message);
                }
            }

            error_messages.push(message);
        }

        return error_messages.join('; ');
    };

    /**
     * Processes a standard (non-Kaltura) job
     * @param {string} job_uuid - Job UUID
     * @param {string} batch_name - Batch name
     * @param {Object} batch_data - Batch data
     * @param {number} is_kaltura - Kaltura flag (0 for standard)
     * @returns {Promise<void>}
     */
    const process_standard_job = async function(job_uuid, batch_name, batch_data, is_kaltura) {

        try {

            // Extract files from packages
            const files = extract_files_from_packages(batch_data.packages);

            if (files.length === 0) {
                throw new Error('No files found in packages');
            }

            // Initialize digital objects creation
            await make_digital_objects_init(job_uuid, batch_name, batch_data, files, is_kaltura);

        } catch (error) {
            console.error('Standard job processing failed:', error.message);
            display_error_message('Job failed: ' + sanitize_text(error.message));
            throw error;
        }
    };

    /**
     * Extracts files from packages
     * @param {Array} packages - Packages array
     * @returns {Array} - Array of file arrays
     */
    const extract_files_from_packages = function(packages) {
        if (!Array.isArray(packages)) {
            return [];
        }

        const files = [];

        for (let i = 0; i < packages.length; i++) {
            const package_item = packages[i];

            if (!package_item || typeof package_item !== 'object') {
                continue;
            }

            if (Array.isArray(package_item.files)) {
                files.push(package_item.files);
            }
        }

        return files;
    };

    /**
     * Updates job status
     * @param {string} job_uuid - Job UUID
     * @param {number} status - Status code (2 = failed)
     * @returns {Promise<void>}
     */
    const update_job_status = async function(job_uuid, status) {

        try {

            if (jobsModule && typeof jobsModule.update_job === 'function') {
                await jobsModule.update_job({
                    uuid: job_uuid,
                    is_complete: status
                });
            }
        } catch (error) {
            console.error('Failed to update job status:', error.message);
        }
    };

    /**
     * Checks if sessionStorage is available
     * @returns {boolean} - True if available, false otherwise
     */
    const is_session_storage_available = function() {
        try {
            const test_key = '__sessionStorage_test__';
            window.sessionStorage.setItem(test_key, 'test');
            window.sessionStorage.removeItem(test_key);
            return true;
        } catch (error) {
            return false;
        }
    };

    /**
     * Constants for digital objects initialization
     */
    const DIGITAL_OBJECTS_INIT_CONFIG = {
        REQUEST_TIMEOUT: 600000, // 10 minutes
        URI_CHECK_DELAY: 3000    // 3 seconds
    };

    /**
     * Initializes digital objects creation process
     * @param {string} job_uuid - Job UUID
     * @param {string} batch - Batch name
     * @param {Object} json - JSON data containing packages
     * @param {Array} files - Files array
     * @param {number} is_kaltura - Kaltura flag (1 or 0)
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const make_digital_objects_init = async function(job_uuid, batch, json, files, is_kaltura) {
        try {
            // Validate parameters
            if (!job_uuid || typeof job_uuid !== 'string' || job_uuid.trim().length === 0) {
                display_error_message('Invalid job UUID');
                return false;
            }

            if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
                display_error_message('Invalid batch name');
                return false;
            }

            if (!json || typeof json !== 'object' || !Array.isArray(json.packages)) {
                display_error_message('Invalid JSON data structure');
                return false;
            }

            if (!Array.isArray(files) || files.length === 0) {
                display_error_message('Invalid or empty files array');
                return false;
            }

            if (typeof is_kaltura !== 'number' || (is_kaltura !== 0 && is_kaltura !== 1)) {
                display_error_message('Invalid Kaltura flag');
                return false;
            }

            const safe_batch_name = batch.trim();
            const safe_job_uuid = job_uuid.trim();

            // Get API key
            const api_key = helperModule.getParameterByName('api_key');
            if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
                display_error_message('API key is required');
                return false;
            }

            // Prepare request data
            const request_data = {
                batch: safe_batch_name,
                packages: json.packages,
                files: files,
                is_kaltura: is_kaltura
            };

            // Validate packages structure
            if (!validate_packages_structure(request_data.packages)) {
                display_error_message('Invalid packages data structure');
                return false;
            }

            // Display progress message
            display_info_message('Making digital objects...');

            // Make API request
            const response = await make_digital_objects_request(request_data, api_key);

            if (!response) {
                display_error_message('Failed to create digital objects');
                return false;
            }

            // Process response
            const process_result = await process_digital_objects_response(
                response,
                safe_job_uuid,
                safe_batch_name
            );

            if (!process_result) {
                return false;
            }

            // Schedule URI check
            await schedule_uri_check(safe_batch_name, safe_job_uuid);

            return true;

        } catch (error) {
            console.error('ERROR: [make_digital_objects_init]', error.message, error.stack);
            display_error_message('Failed to initialize digital objects creation: ' + sanitize_text(error.message));

            // Update job with error
            await update_job_with_error(job_uuid, error.message);

            return false;
        }
    };

    /**
     * Validates packages structure
     * @param {Array} packages - Packages array
     * @returns {boolean} - True if valid, false otherwise
     */
    const validate_packages_structure = function(packages) {
        if (!Array.isArray(packages) || packages.length === 0) {
            return false;
        }

        for (let i = 0; i < packages.length; i++) {
            const package_item = packages[i];

            if (!package_item || typeof package_item !== 'object') {
                console.error('Invalid package at index', i);
                return false;
            }

            // Validate required package fields
            if (!package_item.package && !package_item.name && !package_item.package_name) {
                console.error('Package missing name field at index', i);
                return false;
            }

            if (!Array.isArray(package_item.files)) {
                console.error('Package missing files array at index', i);
                return false;
            }
        }

        return true;
    };

    /**
     * Makes digital objects creation request
     * @param {Object} request_data - Request data
     * @param {string} api_key - API key
     * @returns {Promise<Object|null>} - Response object or null
     */
    const make_digital_objects_request = async function(request_data, api_key) {

        try {

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/make-digital-objects`,
                data: request_data,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-API-Key': api_key.trim()
                },
                timeout: DIGITAL_OBJECTS_INIT_CONFIG.REQUEST_TIMEOUT
            });

            // Validate response
            if (!response) {
                console.error('Empty response from server');
                return null;
            }

            if (response.status !== 200) {
                console.error('Request failed with status:', response.status);
                return null;
            }

            // Validate response data structure
            if (!response.data || typeof response.data !== 'object') {
                console.error('Invalid response data structure');
                return null;
            }

            return response;

        } catch (error) {
            console.error('Request failed:', error.message);

            if (error.response) {
                console.error('Server responded with status:', error.response.status);
            } else if (error.request) {
                console.error('No response received from server');
            }

            return null;
        }
    };

    /**
     * Processes digital objects creation response
     * @param {Object} response - HTTP response
     * @param {string} job_uuid - Job UUID
     * @param {string} batch_name - Batch name
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const process_digital_objects_response = async function(response, job_uuid, batch_name) {

        try {
            // Extract response data
            let response_data = response.data.data || response.data;

            if (!response_data) {
                console.error('Empty response data');
                return false;
            }

            // Convert to string for processing
            const response_text = typeof response_data === 'string'
                ? response_data
                : JSON.stringify(response_data);

            // Check for errors in response
            const has_errors = detect_errors_in_response(response_text);

            // Prepare job update data
            const job_update = {
                uuid: job_uuid,
                log: response_text,
                error: has_errors ? response_text : '-----',
                is_complete: has_errors ? 2 : 1 // 2 = failed, 1 = completed
            };

            // Update job record
            const job_updated = await update_job_record(job_update);

            if (!job_updated) {
                console.error('Failed to update job record');
            }

            // Display appropriate message
            if (has_errors) {
                display_error_message(`Digital objects creation completed with errors for batch: ${sanitize_text(batch_name)}`);
                return false;
            } else {
                display_success_message(`Digital objects created for batch: ${sanitize_text(batch_name)}`);
                return true;
            }

        } catch (error) {
            console.error('Failed to process response:', error.message);
            return false;
        }
    };

    /**
     * Detects errors in response text
     * @param {string} response_text - Response text to check
     * @returns {boolean} - True if errors detected, false otherwise
     */
    const detect_errors_in_response = function(response_text) {

        if (!response_text || typeof response_text !== 'string') {
            return false;
        }

        const error_indicators = [
            'Error:',
            'ERROR:',
            'error:',
            'Exception:',
            'EXCEPTION:',
            'Failed:',
            'FAILED:'
        ];

        for (let i = 0; i < error_indicators.length; i++) {
            if (response_text.includes(error_indicators[i])) {
                return true;
            }
        }

        return false;
    };

    /**
     * Updates job record
     * @param {Object} job_data - Job data to update
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const update_job_record = async function(job_data) {

        try {

            if (!jobsModule || typeof jobsModule.update_job !== 'function') {
                console.error('jobsModule.update_job is not available');
                return false;
            }

            await jobsModule.update_job(job_data);
            return true;

        } catch (error) {
            console.error('Failed to update job:', error.message);
            return false;
        }
    };

    /**
     * Updates job with error information
     * @param {string} job_uuid - Job UUID
     * @param {string} error_message - Error message
     * @returns {Promise<void>}
     */
    const update_job_with_error = async function(job_uuid, error_message) {

        try {

            if (!job_uuid || !error_message) {
                return;
            }

            await update_job_record({
                uuid: job_uuid,
                error: error_message,
                is_complete: 2 // Failed status
            });

        } catch (error) {
            console.error('Failed to update job with error:', error.message);
        }
    };

    /**
     * Schedules URI check after a delay
     * @param {string} batch_name - Batch name
     * @param {string} job_uuid - Job UUID
     * @returns {Promise<void>}
     */
    const schedule_uri_check = async function(batch_name, job_uuid) {

        try {
            // Display waiting message
            display_info_message('Waiting to check package updates...');

            // Wait for the specified delay
            await delay(DIGITAL_OBJECTS_INIT_CONFIG.URI_CHECK_DELAY);

            // Display checking message
            display_info_message(`Checking package updates for batch: ${sanitize_text(batch_name)}`);

            // Perform URI check
            await check_uri_txt(batch_name, job_uuid);

        } catch (error) {
            console.error('Failed to schedule URI check:', error.message);
            display_error_message('Failed to check package updates');
        }
    };

    /**
     * Delay utility function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    const delay = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    /**
     * Displays a success message
     * @param {string} message - Success message
     */
    const display_success_message = function(message) {
        const message_container = document.getElementById('message');

        if (!message_container) {
            console.error('Message container not found');
            return;
        }

        clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-success';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-check-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' ' + sanitize_text(message));

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);

        message_container.appendChild(alert_div);
    };

    /**
     * Constants for URI text checking
     */
    const URI_CHECK_CONFIG = {
        REQUEST_TIMEOUT: 600000, // 10 minutes
        COMPLETION_DELAY: 5000   // 5 seconds
    };

    /**
     * Checks that uri.txt files were created in the packages
     * @param {string} batch - Batch name
     * @param {string} job_uuid - Job UUID
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const check_uri_txt = async function(batch, job_uuid) {

        try {
            // Validate parameters
            if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
                display_error_message('Invalid batch parameter');
                return false;
            }

            if (!job_uuid || typeof job_uuid !== 'string' || job_uuid.trim().length === 0) {
                display_error_message('Invalid job UUID');
                return false;
            }

            const safe_batch_name = batch.trim();
            const safe_job_uuid = job_uuid.trim();

            // Get API key
            const api_key = helperModule.getParameterByName('api_key');
            if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
                display_error_message('API key is required');
                return false;
            }

            // Display checking message
            display_info_message(`Checking uri.txt files for batch: ${sanitize_text(safe_batch_name)}`);

            // Check URI text files
            const uri_check_result = await check_uri_txt_files(safe_batch_name, api_key);

            if (!uri_check_result) {
                await update_job_status(safe_job_uuid, 2); // Failed
                return false;
            }

            // Handle check results
            if (uri_check_result.has_errors) {
                await handle_uri_check_errors(uri_check_result.errors, safe_batch_name, safe_job_uuid);
                return false;
            }

            // URI check successful - proceed with next steps
            await handle_uri_check_success(safe_batch_name, safe_job_uuid, api_key);

            return true;

        } catch (error) {
            console.error('ERROR: [check_uri_txt]', error.message, error.stack);
            display_error_message('Failed to check URI text files: ' + sanitize_text(error.message));

            // Update job with error status
            await update_job_status(job_uuid, 2);

            return false;
        }
    };

    /**
     * Checks URI text files via API
     * @param {string} batch_name - Batch name
     * @param {string} api_key - API key
     * @returns {Promise<Object|null>} - Check result or null on error
     */
    const check_uri_txt_files = async function(batch_name, api_key) {

        try {
            const request_data = {
                batch: batch_name
            };

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/check-uri-txt`,
                data: request_data,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-API-Key': api_key.trim()
                },
                timeout: URI_CHECK_CONFIG.REQUEST_TIMEOUT
            });

            // Validate response
            if (!response || response.status !== 200) {
                console.error('URI check request failed with status:', response?.status);
                return null;
            }

            // Validate response data structure
            if (!response.data || typeof response.data !== 'object') {
                console.error('Invalid response data structure');
                return null;
            }

            // Extract response data
            const response_data = response.data.data || response.data;

            // Check for errors
            const has_errors = response_data.errors &&
                Array.isArray(response_data.errors) &&
                response_data.errors.length > 0;

            return {
                has_errors: has_errors,
                errors: has_errors ? response_data.errors : [],
                data: response_data
            };

        } catch (error) {
            console.error('URI check request failed:', error.message);

            if (error.response) {
                console.error('Server responded with status:', error.response.status);
            } else if (error.request) {
                console.error('No response received from server');
            }

            return null;
        }
    };

    /**
     * Handles URI check errors
     * @param {Array} errors - Array of error messages
     * @param {string} batch_name - Batch name
     * @param {string} job_uuid - Job UUID
     * @returns {Promise<void>}
     */
    const handle_uri_check_errors = async function(errors, batch_name, job_uuid) {

        try {
            // Format error messages
            const error_message = format_uri_check_errors(errors, batch_name);

            // Display error message
            display_error_message(error_message);

            // Update job status to failed
            await update_job_status(job_uuid, 2);

            console.error('URI check failed for batch:', batch_name, 'Errors:', errors);

        } catch (error) {
            console.error('Failed to handle URI check errors:', error.message);
        }
    };

    /**
     * Formats URI check errors for display
     * @param {Array} errors - Array of error messages
     * @param {string} batch_name - Batch name
     * @returns {string} - Formatted error message
     */
    const format_uri_check_errors = function(errors, batch_name) {
        if (!Array.isArray(errors) || errors.length === 0) {
            return `URI check failed for batch: ${sanitize_text(batch_name)}`;
        }

        const error_messages = [];

        for (let i = 0; i < errors.length; i++) {
            const error = errors[i];
            if (error && typeof error === 'string' && error.trim().length > 0) {
                error_messages.push(sanitize_text(error.trim()));
            }
        }

        if (error_messages.length === 0) {
            return `URI check failed for batch: ${sanitize_text(batch_name)}`;
        }

        return `URI check errors: ${error_messages.join('; ')}`;
    };

    /**
     * Handles successful URI check
     * @param {string} batch_name - Batch name
     * @param {string} job_uuid - Job UUID
     * @param {string} api_key - API key
     * @returns {Promise<void>}
     */
    const handle_uri_check_success = async function(batch_name, job_uuid, api_key) {

        try {
            // Update current job status to completed
            await update_job_status(job_uuid, 1);

            // Get batch data from storage
            const batch_data = get_batch_data_from_storage(batch_name);

            if (!batch_data) {
                throw new Error('Failed to retrieve batch data from storage');
            }

            // Get user information
            const ingest_user = get_ingest_user_from_storage();

            if (!ingest_user) {
                throw new Error('User information not found');
            }

            // Create and submit QA job
            await create_qa_job(batch_name, batch_data, ingest_user, api_key);

            // Display success message
            display_success_message(`${sanitize_text(batch_name)} - Job Successful`);

            // Remove beforeunload handler
            remove_before_unload_handler();

            // Schedule completion actions
            schedule_completion_actions();

        } catch (error) {
            console.error('Failed to handle URI check success:', error.message);
            throw error;
        }
    };

    /**
     * Creates and submits QA job
     * @param {string} batch_name - Batch name
     * @param {Object} batch_data - Batch data
     * @param {Object} user - User object
     * @param {string} api_key - API key
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    const create_qa_job = async function(batch_name, batch_data, user, api_key) {

        try {
            // Generate new job UUID
            const qa_job_uuid = generate_job_uuid();

            // Store job UUID for reference
            if (is_local_storage_available()) {
                window.localStorage.setItem('job_uuid', qa_job_uuid);
            }

            // Prepare QA job data
            const qa_job = {
                uuid: qa_job_uuid,
                job_type: 'archivesspace_description_qa',
                batch_name: batch_name,
                packages: batch_data.packages,
                is_kaltura: batch_data.is_kaltura || 0,
                log: '---',
                error: '---',
                job_run_by: user.name
            };

            // Validate job data
            if (!validate_job_data(qa_job)) {
                throw new Error('Invalid QA job data structure');
            }

            // Submit QA job
            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/jobs`,
                data: qa_job,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-API-Key': api_key.trim()
                },
                timeout: URI_CHECK_CONFIG.REQUEST_TIMEOUT
            });

            // Validate response
            if (!response || response.status !== 200) {
                console.error('QA job submission failed with status:', response?.status);
                return false;
            }

            console.log('QA job submitted successfully:', qa_job_uuid);
            return true;

        } catch (error) {
            console.error('Failed to create QA job:', error.message);
            throw error;
        }
    };

    /**
     * Validates job data structure
     * @param {Object} job - Job object
     * @returns {boolean} - True if valid, false otherwise
     */
    const validate_job_data = function(job) {
        if (!job || typeof job !== 'object') {
            console.error('Job data is not an object');
            return false;
        }

        const required_fields = ['uuid', 'job_type', 'batch_name', 'packages', 'job_run_by'];

        for (let i = 0; i < required_fields.length; i++) {
            const field = required_fields[i];

            if (!job[field]) {
                console.error(`Job missing required field: ${field}`);
                return false;
            }
        }

        if (!Array.isArray(job.packages) || job.packages.length === 0) {
            console.error('Job packages must be a non-empty array');
            return false;
        }

        return true;
    };

    /**
     * Removes beforeunload event handler
     */
    const remove_before_unload_handler = function() {
        try {
            if (helperModule && typeof helperModule.alert_user === 'function') {
                window.removeEventListener('beforeunload', helperModule.alert_user);
                console.log('Beforeunload handler removed');
            }
        } catch (error) {
            console.error('Failed to remove beforeunload handler:', error.message);
        }
    };

    /**
     * Schedules completion actions
     */
    const schedule_completion_actions = function() {
        setTimeout(() => {
            console.log('Job complete');

            // Optional: Reload page or redirect
            // Uncomment if needed:
            // window.location.reload();

            // Or show option to continue:
            show_completion_actions();

        }, URI_CHECK_CONFIG.COMPLETION_DELAY);
    };

    /**
     * Shows completion actions to user
     */
    const show_completion_actions = function() {
        const message_container = document.getElementById('message');

        if (!message_container) {
            return;
        }

        clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-success';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-check-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' Job completed successfully. Page will reload in 4 seconds. ');

        const refresh_link = document.createElement('a');
        refresh_link.href = '#';
        refresh_link.textContent = 'Reload now';
        refresh_link.className = 'alert-link';

        // Store timeout ID so it can be cleared if user clicks link
        let reload_timeout = null;

        refresh_link.onclick = function(event) {
            event.preventDefault();

            // Clear the automatic reload timeout
            if (reload_timeout) {
                clearTimeout(reload_timeout);
            }

            // Reload immediately
            window.location.reload();
        };

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        alert_div.appendChild(refresh_link);

        message_container.appendChild(alert_div);

        // Schedule automatic reload after 4 seconds
        reload_timeout = setTimeout(() => {
            console.log('Auto-reloading page...');
            window.location.reload();
        }, 4000);
    };

    obj.init = async function () {

        try {

            document.querySelector('#message').innerHTML = '<div class="alert alert-info"><i class=""></i> Loading...</div>';
            await astoolsModule.display_workspace_packages();

            const user = JSON.parse(window.sessionStorage.getItem('repo_user'));
            let user_id = user.id;

            if (user_id !== undefined && name !== undefined) {

                let profile = [];

                profile.push({
                    uid: user_id,
                    name: user.name,
                    job_type: 'make_digital_objects',
                    run_date: new Date()
                });

                // window.sessionStorage.setItem('ingest_user', JSON.stringify(profile));
                // console.log('ingest user ', window.sessionStorage.getItem('ingest_user'));
            } else {
                // console.log('test ', window.sessionStorage.getItem('ingest_user'));
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    };

    return obj;

}());

/*
    obj.make_digital_objects__ = async function (batch) {

        try {

            window.addEventListener('beforeunload', helperModule.alert_user);
            document.querySelector('#digital-object-workspace-table').style.visibility = 'hidden';
            const batch_data = window.localStorage.getItem(batch);

            if (batch_data === null || batch_data === undefined) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Unable to get batch data</div>');
                return false;
            }

            const job_uuid = self.crypto.randomUUID();
            const json = JSON.parse(batch_data);
            const api_key = helperModule.getParameterByName('api_key');
            let is_kaltura = document.querySelector('#' + batch).value;
            let files = [];

            if (api_key === null) {
                domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> Permission Denied</div>');
                return false;
            }

            let ingest_user = JSON.parse(window.sessionStorage.getItem('ingest_user'));

            if (is_kaltura === 'true') {
                is_kaltura = 1;
            } else {
                is_kaltura = 0;
            }

            const job = {
                uuid: job_uuid,
                job_type: 'make_digital_objects',
                batch_name: batch,
                packages: json.packages,
                is_kaltura: is_kaltura,
                log: '---',
                error: '---',
                job_run_by: ingest_user[0].name
            };

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/jobs?api_key=' + api_key,
                data: job,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {
                console.log('RESPONSE ', response);
            }

            if (is_kaltura === 1) {

                domModule.html('#message', '<div class="alert alert-info"><i class=""></i> (' + batch + ') Retrieving Entry IDs from Kaltura...</div>');
                await get_entry_ids(json);
                let timer = setInterval(async () => {

                    let response = await jobsModule.check_make_digital_objects_ks_queue();

                    if (response.data.length === 0) {

                        clearInterval(timer);
                        console.log('done');

                        setTimeout(async () => {

                            // get ks pairs
                            let ids = await jobsModule.get_ks_entry_ids();
                            let files = [];
                            let errors = [];
                            for (let i = 0; i < ids.data.length; i++) {

                                if (ids.data[i].status !== 1) {
                                    errors.push({
                                        status: ids.data[i].status,
                                        file: ids.data[i].file,
                                        message: ids.data[i].message,
                                        entry_id: ids.data[i].entry_id
                                    });
                                } else {
                                    files.push({
                                        status: ids.data[i].status,
                                        file: ids.data[i].file,
                                        message: ids.data[i].message,
                                        entry_id: ids.data[i].entry_id
                                    });
                                }
                            }

                            if (errors.length > 0) {
                                let error = '';
                                for (let i = 0; i < errors.length; i++) {
                                    error += `${errors[i].file} ${errors[i].message}`;
                                    if (errors[i].status === 2) {
                                        let id_errors = JSON.parse(errors[i].entry_id);
                                        error += ` EntryIDs ${id_errors.toString()}`;
                                    }
                                }

                                await jobsModule.update_job({
                                    uuid: job_uuid,
                                    is_complete: 2
                                });

                                domModule.html('#message', `<div class="alert alert-danger"><i class=""></i>${error}</div>`);

                            } else {
                                await make_digital_objects_init(job_uuid, batch, json, files, is_kaltura);
                            }

                            await jobsModule.clear_ks_queue();

                        }, 5000);

                        return false;
                    }

                }, 2500);

                return false;

            } else {

                for (let i = 0; i < json.packages.length; i++) {
                    files.push(json.packages[i].files);
                }

                await make_digital_objects_init(job_uuid, batch, json, files, is_kaltura);
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }

        return false;
    };
    */

/*
async function make_digital_objects_init__(job_uuid, batch, json, files, is_kaltura) {

        // data used to create job record
        const data = {
            'batch': batch,
            'packages': json.packages,
            'files': files,
            'is_kaltura': is_kaltura
        };

        domModule.html('#message', '<div class="alert alert-info"><i class=""></i> Making digital objects...</div>');
        const api_key = helperModule.getParameterByName('api_key');
        const response = await httpModule.req({
            method: 'POST',
            url: nginx_path + '/api/v1/astools/make-digital-objects?api_key=' + api_key,
            data: data,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 600000
        });

        if (response.status === 200) {

            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Digital objects created for "${batch}" batch</div>`);

            let log = response.data.data;
            let error = response.data.data.search('Error:');

            if (error !== -1) {
                error = log;
            } else {
                error = '-----'
            }

            await jobsModule.update_job({
                uuid: job_uuid,
                log: response.data.data,
                error: error
            });

            setTimeout(async () => {
                domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking package updates for "${batch}" batch</div>`);
                await check_uri_txt(batch, job_uuid);
            }, 3000);
        }
    }

 */

/*
// confirms that a uri.txt file was created in the packages
    async function check_uri_txt(batch, job_uuid) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Checking uri txt files for "${batch}" batch</div>`);

            const data = {
                'batch': batch
            };

            const response = await httpModule.req({
                method: 'POST',
                url: nginx_path + '/api/v1/astools/check-uri-txt?api_key=' + api_key,
                data: data,
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 600000
            });

            if (response.status === 200) {

                if (response.data.data.errors.length > 0) {

                    // TODO: display specific package missing uri.txt file
                    domModule.html('#message', `<div class="alert alert-danger"><i class=""></i> "${response.data.data.errors.toString()}"</div>`);

                    await jobsModule.update_job({
                        uuid: job_uuid,
                        is_complete: 2
                    });

                    return false;

                } else {

                    await jobsModule.update_job({
                        uuid: job_uuid,
                        is_complete: 1
                    });

                    const batch_ = JSON.parse(window.localStorage.getItem(batch));
                    const job_uuid_m = self.crypto.randomUUID();
                    window.localStorage.setItem('job_uuid', job_uuid_m);

                    let packages = [];

                    for (let i = 0; i < batch_.packages.length; i++) {
                        packages.push(batch_.packages[i].package);
                    }

                    // domModule.html('#message', `<div class="alert alert-info"><i class=""></i> Packages retrieved for "${batch}" batch</div>`);

                    let ingest_user = JSON.parse(window.sessionStorage.getItem('ingest_user'));

                    const job = {
                        uuid: job_uuid_m,
                        job_type: 'archivesspace_description_qa',
                        batch_name: batch,
                        packages: batch_.packages,
                        is_kaltura: batch_.is_kaltura,
                        log: '---',
                        error: '---',
                        job_run_by: ingest_user[0].name
                    }

                    const response = await httpModule.req({
                        method: 'POST',
                        url: nginx_path + '/api/v1/astools/jobs?api_key=' + api_key,
                        data: job,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        timeout: 600000
                    });

                    if (response.status === 200) {
                        console.log('RESPONSE ', response);
                    }

                    domModule.html('#message', `<div class="alert alert-info"><i class=""></i> ${batch} <strong>Job Successful</strong></div>`);
                    window.removeEventListener('beforeunload', helperModule.alert_user);

                    setTimeout(() => {
                        console.log('Job complete');
                        // window.location.reload();
                    }, 5000);
                }
            }

        } catch (error) {
            domModule.html('#message', '<div class="alert alert-danger"><i class=""></i> ' + error.message + '</div>');
        }
    }

 */