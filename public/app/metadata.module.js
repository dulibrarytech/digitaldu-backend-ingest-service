/**
 * Copyright 2025 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const metadataModule = (function () {
    'use strict';

    const obj = {};
    const nginx_path = '/repo/ingester';

    // Use common helpers
    const helpers = commonHelpers;

    // Store beforeunload handler reference at module level
    let current_before_unload_handler = null;

    /**
     * Displays metadata check batches
     */
    obj.display_metadata_check_batches = async function() {

        try {

            helpers.clear_message_area();
            helpers.show_loading_indicator('#packages-container');

            const records = await jobsModule.get_metadata_jobs();

            if (!records || !records.data || records.data.length === 0) {
                helpers.display_info_message('No archival object folders are ready for ArchivesSpace Descriptive QA');
                hide_metadata_check_table();
                return false;
            }

            const valid_batches = validate_and_store_metadata_batches(records.data);

            if (valid_batches.length === 0) {
                helpers.display_error_message('No valid batches found');
                hide_metadata_check_table();
                return false;
            }

            render_metadata_check_batches(valid_batches);
            show_metadata_check_table();
            helpers.clear_message_area();

            return true;

        } catch (error) {
            console.error('ERROR: [display_metadata_check_batches]', error.message);
            helpers.display_error_message('Unable to display metadata check batches', error.message);
            hide_metadata_check_table();
            return false;
        } finally {
            helpers.hide_loading_indicator();
        }
    };

    /**
     * Gets packages for metadata check
     */
    obj.get_packages = async function(batch) {

        try {

            if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
                helpers.display_error_message('Invalid batch parameter');
                return false;
            }

            const safe_batch_name = batch.trim();

            // Create and store beforeunload handler at module level
            current_before_unload_handler = helpers.create_before_unload_handler(
                'Processing is in progress. Are you sure you want to leave?'
            );

            window.addEventListener('beforeunload', current_before_unload_handler);

            const batch_data = helpers.get_batch_data_from_storage(safe_batch_name, '_');

            if (!batch_data || !Array.isArray(batch_data.packages)) {
                helpers.display_error_message('Unable to get packages: Batch data not found');
                remove_module_before_unload_handler();
                return false;
            }

            const job_uuid = batch_data.job_uuid;
            const package_names = batch_data.packages.map(pkg =>
                pkg.package || pkg.name || pkg.package_name
            ).filter(name => name);

            if (package_names.length === 0) {
                helpers.display_error_message('No packages found in batch');
                remove_module_before_unload_handler();
                return false;
            }

            helpers.display_info_message(`Packages retrieved for batch: ${helpers.sanitize_text(safe_batch_name)}`);
            clear_metadata_workspace_table();

            await helpers.delay(1000);
            await process_packages(safe_batch_name, package_names, job_uuid);

            return true;

        } catch (error) {
            console.error('ERROR: [get_packages]', error.message);
            helpers.display_error_message('Failed to get packages', error.message);
            remove_module_before_unload_handler();
            return false;
        }
    };

    /**
     * Initialization
     */
    obj.init = async function() {
        try {
            helpers.display_info_message('Loading...');
            await obj.display_metadata_check_batches();
        } catch (error) {
            helpers.display_error_message('Failed to initialize', error.message);
        }
    };

    // PRIVATE HELPER FUNCTIONS

    const validate_and_store_metadata_batches = function(batches) {
        if (!Array.isArray(batches) || !helpers.is_local_storage_available()) return batches || [];

        const valid_batches = [];

        batches.forEach((batch_item, i) => {
            if (!batch_item?.result?.batch || !batch_item?.result?.packages) {
                console.warn('Invalid batch at index', i);
                return;
            }

            const storage_key = batch_item.result.batch + '_';

            try {
                window.localStorage.removeItem(storage_key);
                window.localStorage.setItem(storage_key, JSON.stringify(batch_item.result));
                valid_batches.push(batch_item);
            } catch (error) {
                console.error('Failed to store batch:', error.message);
                valid_batches.push(batch_item);
            }
        });

        return valid_batches;
    };

    const render_metadata_check_batches = function(batches) {
        const container = document.getElementById('packages');
        if (!container) return;

        const fragment = document.createDocumentFragment();

        batches.forEach(batch_item => {
            const result = batch_item.result;
            const row = create_metadata_check_row(result.batch, result.packages);
            if (row) fragment.appendChild(row);
        });

        helpers.clear_element(container);
        container.appendChild(fragment);
        setup_metadata_check_listeners();
    };

    const create_metadata_check_row = function(batch_name, packages) {
        const row = document.createElement('tr');
        row.dataset.batch = batch_name;

        // Batch name cell
        const batch_cell = document.createElement('td');
        batch_cell.className = 'metadata-batch-name-cell';
        const batch_text = document.createElement('small');
        batch_text.textContent = helpers.sanitize_text(batch_name);
        batch_cell.appendChild(batch_text);
        row.appendChild(batch_cell);

        // Packages list cell
        const packages_cell = document.createElement('td');
        packages_cell.className = 'metadata-packages-cell';
        packages_cell.appendChild(helpers.create_package_list(packages));
        row.appendChild(packages_cell);

        // Actions cell
        const actions_cell = document.createElement('td');
        actions_cell.className = 'metadata-actions-cell';
        const button = create_metadata_action_button(batch_name);
        actions_cell.appendChild(button);
        row.appendChild(actions_cell);

        return row;
    };

    const create_metadata_action_button = function(batch_name) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-default run-qa metadata-start-button';
        button.dataset.batch = batch_name;

        const icon = document.createElement('i');
        icon.className = 'fa fa-cogs';
        const text = document.createElement('span');
        text.textContent = ' Start';

        button.appendChild(icon);
        button.appendChild(text);
        return button;
    };

    const setup_metadata_check_listeners = function() {
        const container = document.getElementById('packages');
        if (!container) return;

        container.removeEventListener('click', handle_metadata_check_click);
        container.addEventListener('click', handle_metadata_check_click);
    };

    const handle_metadata_check_click = function(event) {
        const button = event.target.closest('.metadata-start-button');
        if (!button) return;

        event.preventDefault();
        const batch_name = button.dataset.batch;
        if (batch_name) {
            obj.get_packages(batch_name);
        }
    };

    const show_metadata_check_table = function() {
        const table = document.getElementById('digital-object-workspace-table');
        if (table) {
            table.style.visibility = 'visible';
            table.style.display = 'table';
        }
    };

    const hide_metadata_check_table = function() {
        const table = document.getElementById('digital-object-workspace-table');
        if (table) {
            table.style.visibility = 'hidden';
            table.style.display = 'none';
        }
    };

    const clear_metadata_workspace_table = function() {
        const table = document.getElementById('digital-object-workspace-table');
        if (table) helpers.clear_element(table);
    };

    /**
     * Removes the module-level beforeunload handler
     */
    const remove_module_before_unload_handler = function() {
        try {
            if (current_before_unload_handler) {
                window.removeEventListener('beforeunload', current_before_unload_handler);
                current_before_unload_handler = null;
                console.log('Module beforeunload handler removed successfully');
            }
        } catch (error) {
            console.error('Failed to remove module beforeunload handler:', error.message);
        }
    };

    /**
     * Parses errors from check_result
     * @param {Object} check_result - Result from check_metadata
     * @param {string} package_name - Package name
     * @returns {Array} - Array of error objects
     */
    const parse_package_errors = function(check_result, package_name) {
        const parsed_errors = [];

        if (!check_result) {
            return parsed_errors;
        }

        // Check for errors array
        if (check_result.errors && Array.isArray(check_result.errors)) {
            check_result.errors.forEach(error => {
                if (error && typeof error === 'string' && error.trim().length > 0) {
                    parsed_errors.push({
                        package: package_name,
                        error: error.trim()
                    });
                } else if (error && typeof error === 'object') {
                    // Handle error objects
                    const error_text = error.message || error.error || JSON.stringify(error);
                    parsed_errors.push({
                        package: package_name,
                        error: error_text
                    });
                }
            });
        }

        // Fallback to single error field
        if (parsed_errors.length === 0 && check_result.error) {
            parsed_errors.push({
                package: package_name,
                error: check_result.error
            });
        }

        // Ultimate fallback
        if (parsed_errors.length === 0) {
            parsed_errors.push({
                package: package_name,
                error: 'Metadata check failed (no specific error message)'
            });
        }

        return parsed_errors;
    };

    /**
     * Displays errors for a specific package
     * @param {string} package_name - Package name
     * @param {Array} package_errors - Array of error objects
     */
    const display_package_errors = function(package_name, package_errors) {
        if (!Array.isArray(package_errors) || package_errors.length === 0) {
            return;
        }

        console.error(`❌ Package "${package_name}" has ${package_errors.length} error(s):`);

        // Log each error to console
        package_errors.forEach((err, index) => {
            console.error(`  ${index + 1}. ${err.error}`);
        });

        // Display in UI - create or update error panel
        display_errors_in_ui_panel(package_name, package_errors);
    };

    /**
     * Displays errors in a dedicated UI panel
     * @param {string} package_name - Package name
     * @param {Array} package_errors - Array of error objects
     */
    const display_errors_in_ui_panel = function(package_name, package_errors) {
        // Get or create error panel container
        let error_panel = document.getElementById('metadata-errors-panel');

        if (!error_panel) {
            error_panel = create_error_panel();
        }

        // Get or create package error section
        let package_section = document.getElementById(`error-section-${sanitize_id(package_name)}`);

        if (!package_section) {
            package_section = create_package_error_section(package_name, package_errors);
            error_panel.appendChild(package_section);
        } else {
            // Update existing section
            update_package_error_section(package_section, package_errors);
        }

        // Make sure panel is visible
        error_panel.style.display = 'block';
    };

    /**
     * Creates the main error panel
     * @returns {HTMLElement} - Error panel element
     */
    const create_error_panel = function() {
        const message_container = document.getElementById('message');

        if (!message_container) {
            return null;
        }

        const panel = document.createElement('div');
        panel.id = 'metadata-errors-panel';
        panel.className = 'metadata-errors-panel';
        panel.style.display = 'none';
        panel.style.marginTop = '20px';
        panel.style.marginBottom = '20px';

        const header = document.createElement('div');
        header.className = 'panel-header';
        header.style.backgroundColor = '#d9534f';
        header.style.color = 'white';
        header.style.padding = '15px';
        header.style.borderRadius = '4px 4px 0 0';
        header.style.fontWeight = 'bold';

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation-triangle';
        icon.setAttribute('aria-hidden', 'true');
        icon.style.marginRight = '10px';

        const header_text = document.createElement('span');
        header_text.textContent = 'Metadata Validation Errors Detected';

        header.appendChild(icon);
        header.appendChild(header_text);

        const content = document.createElement('div');
        content.className = 'panel-content';
        content.style.border = '1px solid #d9534f';
        content.style.borderTop = 'none';
        content.style.borderRadius = '0 0 4px 4px';
        content.style.maxHeight = '600px';
        content.style.overflowY = 'auto';

        panel.appendChild(header);
        panel.appendChild(content);

        // Insert after message container
        message_container.parentNode.insertBefore(panel, message_container.nextSibling);

        return panel;
    };

    /**
     * Creates a package error section
     * @param {string} package_name - Package name
     * @param {Array} package_errors - Array of error objects
     * @returns {HTMLElement} - Package section element
     */
    const create_package_error_section = function(package_name, package_errors) {
        const section = document.createElement('div');
        section.id = `error-section-${sanitize_id(package_name)}`;
        section.className = 'package-error-section';
        section.style.padding = '15px';
        section.style.borderBottom = '1px solid #ddd';
        section.style.backgroundColor = '#f9f9f9';

        // Package header
        const pkg_header = document.createElement('div');
        pkg_header.className = 'package-header';
        pkg_header.style.marginBottom = '10px';

        const pkg_icon = document.createElement('i');
        pkg_icon.className = 'fa fa-folder-open';
        pkg_icon.style.marginRight = '8px';
        pkg_icon.style.color = '#d9534f';

        const pkg_name = document.createElement('strong');
        pkg_name.textContent = helpers.sanitize_text(package_name);
        pkg_name.style.fontSize = '16px';

        const error_count = document.createElement('span');
        error_count.className = 'badge badge-danger';
        error_count.style.marginLeft = '10px';
        error_count.textContent = `${package_errors.length} error${package_errors.length !== 1 ? 's' : ''}`;

        pkg_header.appendChild(pkg_icon);
        pkg_header.appendChild(pkg_name);
        pkg_header.appendChild(error_count);

        // Error list
        const error_list = document.createElement('ul');
        error_list.className = 'error-list';
        error_list.style.marginTop = '10px';
        error_list.style.marginBottom = '0';
        error_list.style.paddingLeft = '30px';

        package_errors.forEach((err, index) => {
            const error_item = document.createElement('li');
            error_item.style.marginBottom = '8px';
            error_item.style.color = '#333';
            error_item.style.lineHeight = '1.5';

            const error_text = document.createElement('span');
            error_text.textContent = helpers.sanitize_text(err.error);

            error_item.appendChild(error_text);
            error_list.appendChild(error_item);
        });

        section.appendChild(pkg_header);
        section.appendChild(error_list);

        return section;
    };

    /**
     * Updates an existing package error section
     * @param {HTMLElement} section - Package section element
     * @param {Array} package_errors - Array of error objects
     */
    const update_package_error_section = function(section, package_errors) {
        // Update error count badge
        const badge = section.querySelector('.badge');
        if (badge) {
            badge.textContent = `${package_errors.length} error${package_errors.length !== 1 ? 's' : ''}`;
        }

        // Update error list
        const error_list = section.querySelector('.error-list');
        if (error_list) {
            helpers.clear_element(error_list);

            package_errors.forEach((err) => {
                const error_item = document.createElement('li');
                error_item.style.marginBottom = '8px';
                error_item.style.color = '#333';
                error_item.style.lineHeight = '1.5';

                const error_text = document.createElement('span');
                error_text.textContent = helpers.sanitize_text(err.error);

                error_item.appendChild(error_text);
                error_list.appendChild(error_item);
            });
        }
    };

    /**
     * Sanitizes a string for use as an HTML ID
     * @param {string} str - String to sanitize
     * @returns {string} - Sanitized string
     */
    const sanitize_id = function(str) {
        if (!str || typeof str !== 'string') {
            return 'unknown';
        }
        return str.replace(/[^a-zA-Z0-9_-]/g, '_');
    };

    const process_packages = async function(batch, package_names, job_uuid) {
        try {
            // Clear any existing error panel from previous run
            clear_error_panel();

            helpers.display_info_message('Starting metadata checks...');

            const errors = [];
            let processed_count = 0;

            for (let i = 0; i < package_names.length; i++) {
                const package_name = package_names[i];
                processed_count++;

                helpers.display_info_message(
                    `Checking metadata for package ${processed_count} of ${package_names.length}: ${helpers.sanitize_text(package_name)}`
                );

                try {
                    const check_result = await check_metadata(batch, package_name, job_uuid);

                    if (check_result?.has_errors) {
                        // Parse and display errors from this package
                        const package_errors = parse_package_errors(check_result, package_name);

                        if (package_errors.length > 0) {
                            // Add to errors array for final summary
                            errors.push(...package_errors);

                            // Display errors immediately for this package
                            display_package_errors(package_name, package_errors);
                        }
                    } else {
                        // Display success for this package
                        console.log(`✓ Package ${package_name}: No errors found`);
                    }
                } catch (error) {
                    console.error('Error processing package:', package_name, error.message);
                    const error_obj = { package: package_name, error: error.message };
                    errors.push(error_obj);

                    // Display the error immediately
                    helpers.display_error_message(
                        `Error checking ${helpers.sanitize_text(package_name)}: ${helpers.sanitize_text(error.message)}`
                    );
                }

                if (i < package_names.length - 1) {
                    await helpers.delay(4000);
                }
            }

            await handle_processing_completion(batch, job_uuid, errors);

            return true;

        } catch (error) {
            console.error('ERROR: [process_packages]', error.message);
            helpers.display_error_message('Failed to process packages', error.message);
            await helpers.update_job_status(job_uuid, 2);
            return false;
        }
    };

    /**
     * Clears the error panel
     */
    const clear_error_panel = function() {
        const error_panel = document.getElementById('metadata-errors-panel');

        if (error_panel) {
            error_panel.remove();
        }
    };

    const handle_processing_completion = async function(batch, job_uuid, errors) {
        // Remove beforeunload handler FIRST before any async operations
        remove_module_before_unload_handler();

        if (errors.length > 0) {
            // Format detailed error message
            const error_summary = format_error_summary(errors);

            if (helpers.is_local_storage_available()) {
                window.localStorage.setItem(batch + '_m_errors', error_summary);
            }

            await helpers.update_job_record({
                uuid: job_uuid,
                is_complete: 2,
                error: error_summary
            });

            // Display final error summary
            display_final_error_summary(errors);
        } else {
            await handle_metadata_check_success(batch, job_uuid);
        }
    };

    /**
     * Formats error summary for storage
     * @param {Array} errors - Array of error objects
     * @returns {string} - Formatted error summary
     */
    const format_error_summary = function(errors) {
        if (!Array.isArray(errors) || errors.length === 0) {
            return 'Unknown errors occurred';
        }

        const error_messages = errors.map(err => {
            const pkg = helpers.sanitize_text(err.package || 'Unknown package');
            const msg = helpers.sanitize_text(err.error || 'Unknown error');
            return `${pkg}: ${msg}`;
        });

        return error_messages.join(' | ');
    };

    /**
     * Displays final error summary
     * @param {Array} errors - Array of error objects
     */
    const display_final_error_summary = function(errors) {
        if (!Array.isArray(errors) || errors.length === 0) {
            return;
        }

        console.error('='.repeat(80));
        console.error('METADATA CHECK COMPLETED WITH ERRORS');
        console.error('='.repeat(80));
        console.error(`Total Errors: ${errors.length}`);
        console.error('');

        // Group errors by package
        const errors_by_package = {};
        errors.forEach(err => {
            const pkg = err.package || 'Unknown package';
            if (!errors_by_package[pkg]) {
                errors_by_package[pkg] = [];
            }
            errors_by_package[pkg].push(err.error);
        });

        // Log grouped errors
        Object.keys(errors_by_package).forEach(pkg => {
            console.error(`Package: ${pkg}`);
            errors_by_package[pkg].forEach((error, index) => {
                console.error(`  ${index + 1}. ${error}`);
            });
            console.error('');
        });

        console.error('='.repeat(80));

        // Calculate statistics
        const package_count = Object.keys(errors_by_package).length;
        const error_count = errors.length;

        // Add summary section to UI panel
        add_summary_to_error_panel(error_count, package_count);

        // Update message container with summary
        let summary_message = `ArchivesSpace description QA completed with ${error_count} error(s) `;
        summary_message += `across ${package_count} package(s). `;
        summary_message += 'See detailed errors below.';

        helpers.display_error_message(summary_message);
    };

    /**
     * Adds summary section to error panel
     * @param {number} error_count - Total error count
     * @param {number} package_count - Affected package count
     */
    const add_summary_to_error_panel = function(error_count, package_count) {
        const error_panel = document.getElementById('metadata-errors-panel');

        if (!error_panel) {
            return;
        }

        // Check if summary already exists
        let summary = document.getElementById('error-panel-summary');

        if (summary) {
            helpers.clear_element(summary);
        } else {
            summary = document.createElement('div');
            summary.id = 'error-panel-summary';
            summary.className = 'error-panel-summary';
            summary.style.padding = '15px';
            summary.style.backgroundColor = '#fff3cd';
            summary.style.borderTop = '2px solid #d9534f';
            summary.style.borderBottom = '1px solid #ddd';

            // Insert as first child of content area
            const content = error_panel.querySelector('.panel-content');
            if (content && content.firstChild) {
                content.insertBefore(summary, content.firstChild);
            } else if (content) {
                content.appendChild(summary);
            }
        }

        // Create summary content
        const summary_header = document.createElement('div');
        summary_header.style.marginBottom = '10px';
        summary_header.style.fontWeight = 'bold';
        summary_header.style.fontSize = '15px';
        summary_header.style.color = '#856404';

        const summary_icon = document.createElement('i');
        summary_icon.className = 'fa fa-info-circle';
        summary_icon.style.marginRight = '8px';

        const summary_text = document.createElement('span');
        summary_text.textContent = 'Validation Summary';

        summary_header.appendChild(summary_icon);
        summary_header.appendChild(summary_text);

        // Create statistics
        const stats = document.createElement('div');
        stats.style.marginTop = '10px';
        stats.style.color = '#333';

        const stat1 = document.createElement('div');
        stat1.style.marginBottom = '5px';
        stat1.innerHTML = `<strong>Total Errors:</strong> <span class="badge badge-danger" style="font-size: 13px;">${error_count}</span>`;

        const stat2 = document.createElement('div');
        stat2.style.marginBottom = '5px';
        stat2.innerHTML = `<strong>Affected Packages:</strong> <span class="badge badge-warning" style="font-size: 13px;">${package_count}</span>`;

        const instruction = document.createElement('div');
        instruction.style.marginTop = '15px';
        instruction.style.fontSize = '13px';
        instruction.style.color = '#856404';
        instruction.style.fontStyle = 'italic';
        instruction.innerHTML = '<i class="fa fa-arrow-down" style="margin-right: 5px;"></i>Review detailed errors by package below:';

        stats.appendChild(stat1);
        stats.appendChild(stat2);
        stats.appendChild(instruction);

        summary.appendChild(summary_header);
        summary.appendChild(stats);

        // Scroll to error panel
        error_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handle_metadata_check_success = async function(batch, job_uuid) {
        try {
            if (helpers.is_local_storage_available()) {
                window.localStorage.removeItem(batch + '_m_errors');
            }

            await helpers.update_job_status(job_uuid, 1);

            const api_key = helperModule.getParameterByName('api_key');
            const job_data_response = await jobsModule.get_active_job(job_uuid);
            const job_data = job_data_response?.data?.[0]?.result;

            if (!job_data) {
                throw new Error('Failed to retrieve job data');
            }

            const ingest_user = helpers.get_ingest_user_from_storage();
            if (!ingest_user) {
                throw new Error('User information not found');
            }

            const packaging_job_uuid = helpers.generate_job_uuid();

            if (helpers.is_local_storage_available()) {
                window.localStorage.setItem('job_uuid', packaging_job_uuid);
            }

            const packaging_job = {
                uuid: packaging_job_uuid,
                job_type: 'packaging_and_ingesting',
                batch_name: job_data.batch || job_data.batch_name,
                packages: job_data.packages,
                is_kaltura: job_data.is_kaltura || 0,
                log: '---',
                error: '---',
                job_run_by: ingest_user.name
            };

            await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/jobs`,
                data: packaging_job,
                headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
                timeout: helpers.get_config('REQUEST_TIMEOUT')
            });

            await helpers.delay(helpers.get_config('COMPLETION_DELAY'));
            helpers.show_success_with_reload('ArchivesSpace Description QA - Job complete.');

        } catch (error) {
            console.error('Failed to handle metadata check success:', error.message);
            throw error;
        }
    };

    const check_metadata = async function(batch, package_name, job_uuid) {

        try {

            const api_key = helperModule.getParameterByName('api_key');
            helpers.display_info_message(`Checking metadata for: ${helpers.sanitize_text(package_name)}`);

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/metadata`,
                data: { uuid: job_uuid, batch, ingest_package: package_name },
                headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
                timeout: helpers.get_config('REQUEST_TIMEOUT')
            });
            console.log('RESPONSE ', response);
            if (!response || response.status !== 200) {
                return {
                    has_errors: true,
                    error: 'Failed to retrieve metadata',
                    errors: ['Failed to retrieve metadata from server'],
                    package: package_name
                };
            }

            const metadata = response.data.data || response.data;

            // Check for errors in metadata response
            if (metadata.errors && Array.isArray(metadata.errors) && metadata.errors.length > 0) {
                console.warn(`Package ${package_name} has ${metadata.errors.length} error(s)`);

                return {
                    has_errors: true,
                    errors: metadata.errors,
                    error: `${metadata.errors.length} validation error(s) found`,
                    package: package_name
                };
            }

            // Check for error field (singular)
            if (metadata.error) {
                console.warn(`Package ${package_name} has error: ${metadata.error}`);

                return {
                    has_errors: true,
                    errors: [metadata.error],
                    error: metadata.error,
                    package: package_name
                };
            }

            // Process and store metadata results (no errors)
            await process_metadata_results(batch, package_name, metadata);
            show_metadata_workspace_table();

            return {
                has_errors: false,
                package: package_name
            };

        } catch (error) {
            console.error('ERROR: [check_metadata]', error.message, error.stack);

            return {
                has_errors: true,
                error: error.message,
                errors: [error.message],
                package: package_name
            };
        }
    };

    const process_metadata_results = async function(batch, package_name, metadata) {
        const storage_key = batch + '_m';
        const existing_records = get_metadata_records(storage_key);

        let records;
        if (existing_records === null) {
            records = [{
                batch,
                package: package_name,
                metadata,
                checked_at: new Date().toISOString()
            }];
        } else {
            const existing_index = existing_records.findIndex(r => r.package === package_name);

            const new_record = {
                batch,
                package: package_name,
                metadata,
                checked_at: new Date().toISOString()
            };

            if (existing_index >= 0) {
                existing_records[existing_index] = new_record;
                records = existing_records;
            } else {
                records = [...existing_records, new_record];
            }
        }

        store_metadata_records(storage_key, records);
        await render_metadata_table(records);
    };

    const get_metadata_records = function(storage_key) {
        try {
            if (!helpers.is_local_storage_available()) return null;

            const records_string = window.localStorage.getItem(storage_key);
            if (!records_string) return null;

            const records = JSON.parse(records_string);
            return Array.isArray(records) ? records : null;
        } catch (error) {
            console.error('Failed to get metadata records:', error.message);
            return null;
        }
    };

    const store_metadata_records = function(storage_key, records) {
        try {
            if (helpers.is_local_storage_available() && Array.isArray(records)) {
                window.localStorage.setItem(storage_key, JSON.stringify(records));
            }
        } catch (error) {
            console.error('Failed to store metadata records:', error.message);
        }
    };

    const render_metadata_table = async function(records) {
        const container = document.getElementById('metadata-results');
        if (!container) return;

        const table = create_metadata_table(records);
        helpers.clear_element(container);
        container.appendChild(table);
    };

    const create_metadata_table = function(records) {
        const fragment = document.createDocumentFragment();

        if (!Array.isArray(records) || records.length === 0) {
            const empty_p = document.createElement('p');
            empty_p.className = 'text-muted';
            empty_p.textContent = 'No metadata records found';
            fragment.appendChild(empty_p);
            return fragment;
        }

        const table = document.createElement('table');
        table.className = 'table table-striped table-bordered';

        // Header
        const thead = document.createElement('thead');
        const header_row = document.createElement('tr');
        ['Package', 'Status', 'Checked At', 'Details'].forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            header_row.appendChild(th);
        });
        thead.appendChild(header_row);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        records.forEach(record => {
            const row = create_metadata_table_row(record);
            if (row) tbody.appendChild(row);
        });
        table.appendChild(tbody);

        fragment.appendChild(table);
        return fragment;
    };

    const create_metadata_table_row = function(record) {
        const row = document.createElement('tr');

        // Package name
        const package_cell = document.createElement('td');
        package_cell.textContent = helpers.sanitize_text(record.package || 'Unknown');
        row.appendChild(package_cell);

        // Status
        const status_cell = document.createElement('td');
        const has_errors = record.metadata?.errors?.length > 0;
        const badge = document.createElement('span');
        badge.className = has_errors ? 'badge badge-danger' : 'badge badge-success';
        badge.textContent = has_errors ? 'Errors' : 'OK';
        status_cell.appendChild(badge);
        row.appendChild(status_cell);

        // Checked at
        const checked_cell = document.createElement('td');
        const date = record.checked_at ? new Date(record.checked_at).toLocaleString() : 'Unknown';
        checked_cell.textContent = date;
        row.appendChild(checked_cell);

        // Details
        const details_cell = document.createElement('td');
        if (has_errors) {
            const error_list = document.createElement('ul');
            error_list.className = 'mb-0';
            record.metadata.errors.slice(0, 3).forEach(error => {
                const li = document.createElement('li');
                li.textContent = helpers.sanitize_text(String(error));
                error_list.appendChild(li);
            });
            if (record.metadata.errors.length > 3) {
                const more_li = document.createElement('li');
                more_li.textContent = `... and ${record.metadata.errors.length - 3} more`;
                error_list.appendChild(more_li);
            }
            details_cell.appendChild(error_list);
        } else {
            details_cell.textContent = 'No issues found';
        }
        row.appendChild(details_cell);

        return row;
    };

    const show_metadata_workspace_table = function() {
        const table = document.getElementById('metadata-workspace-table');
        if (table) {
            table.style.visibility = 'visible';
            table.style.display = 'table';
        }
    };

    return obj;
}());