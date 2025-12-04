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

const astoolsModule = (function () {
    'use strict';

    const obj = {};
    const nginx_path = '/repo/ingester';

    // Use common helpers
    const helpers = commonHelpers;

    // Store beforeunload handler reference at module level
    let current_before_unload_handler = null;

    /**
     * Retrieves workspace packages from the API
     */
    obj.get_workspace_packages = async function() {

        try {

            const api_key = helperModule.getParameterByName('api_key');

            if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
                throw new Error('API key is required');
            }

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

            if (!response || response.status !== 200) {
                throw new Error('Failed to retrieve workspace packages');
            }

            if (!response.data || typeof response.data !== 'object') {
                throw new Error('Invalid response data structure');
            }

            return response.data;

        } catch (error) {
            console.error('ERROR: [get_workspace_packages]', error.message);
            helpers.display_error_message('Unable to retrieve workspace packages. Please try again.', error.message);
            return null;
        }
    };

    /**
     * Displays workspace packages in the UI
     */
    obj.display_workspace_packages = async function() {
        try {
            helpers.clear_message_area();
            helpers.show_loading_indicator('#packages-container');

            const response = await obj.get_workspace_packages();

            if (!response || !response.data || !Array.isArray(response.data)) {
                throw new Error('Failed to retrieve workspace packages');
            }

            const collection_folders = filter_collection_folders(response.data);

            if (collection_folders.length === 0) {
                helpers.display_info_message('No collection folders are ready');
                hide_workspace_table();
                return false;
            }

            store_package_data(collection_folders);
            render_workspace_packages(collection_folders);
            await initialize_kaltura_session();

            show_workspace_table();
            helpers.clear_message_area();

            return true;

        } catch (error) {
            console.error('ERROR: [display_workspace_packages]', error.message);
            helpers.display_error_message('Unable to display workspace packages. Please refresh the page.', error.message);
            hide_workspace_table();
            return false;
        } finally {
            helpers.hide_loading_indicator();
        }
    };

    /**
     * Creates digital objects for a batch
     */
    obj.make_digital_objects = async function(batch) {
        try {
            if (!batch || typeof batch !== 'string' || batch.trim().length === 0) {
                helpers.display_error_message('Invalid batch parameter');
                return false;
            }

            const safe_batch_name = batch.trim();

            // Create and store beforeunload handler at module level
            current_before_unload_handler = helpers.create_before_unload_handler(
                'Job is still running. Are you sure you want to leave?'
            );

            window.addEventListener('beforeunload', current_before_unload_handler);
            hide_workspace_table();

            const batch_data = helpers.get_batch_data_from_storage(safe_batch_name);
            if (!batch_data) {
                helpers.display_error_message('Unable to get batch data');
                remove_module_before_unload_handler();
                return false;
            }

            const api_key = helperModule.getParameterByName('api_key');
            if (!api_key) {
                helpers.display_error_message('Permission Denied: API key is required');
                remove_module_before_unload_handler();
                return false;
            }

            const ingest_user = helpers.get_ingest_user_from_storage();
            if (!ingest_user) {
                helpers.display_error_message('User information not found. Please log in again.');
                remove_module_before_unload_handler();
                return false;
            }

            const job_uuid = helpers.generate_job_uuid();
            const is_kaltura = get_kaltura_status(safe_batch_name);

            const job = {
                uuid: job_uuid,
                job_type: 'make_digital_objects',
                batch_name: safe_batch_name,
                packages: batch_data.packages,
                is_kaltura: is_kaltura,
                log: '---',
                error: '---',
                job_run_by: ingest_user.name
            };

            const job_submitted = await submit_job(job, api_key);
            if (!job_submitted) {
                helpers.display_error_message('Failed to submit job');
                remove_module_before_unload_handler();
                return false;
            }

            if (is_kaltura) {
                await process_kaltura_job(job_uuid, safe_batch_name, batch_data, api_key);
            } else {
                await process_standard_job(job_uuid, safe_batch_name, batch_data, is_kaltura);
            }

            return true;

        } catch (error) {
            console.error('ERROR: [make_digital_objects]', error.message);
            helpers.display_error_message('An error occurred while creating digital objects: ' + helpers.sanitize_text(error.message));
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
            await obj.display_workspace_packages();
        } catch (error) {
            helpers.display_error_message('Failed to initialize', error.message);
        }
    };

    // PRIVATE HELPER FUNCTIONS

    const filter_collection_folders = function(records) {
        if (!Array.isArray(records)) return [];

        return records.filter(record => {
            if (!record?.result?.batch) return false;
            const batch_name = record.result.batch;
            return batch_name.includes('new_') && batch_name.includes('-resources_');
        });
    };

    const store_package_data = function(collection_folders) {
        if (!Array.isArray(collection_folders) || !helpers.is_local_storage_available()) return;

        collection_folders.forEach(folder => {
            if (folder?.result?.batch) {
                try {
                    window.localStorage.setItem(folder.result.batch, JSON.stringify(folder.result));
                } catch (error) {
                    console.error('Failed to store package data:', error.message);
                }
            }
        });
    };

    const render_workspace_packages = function(collection_folders) {
        const container = document.getElementById('packages');
        if (!container) return;

        const fragment = document.createDocumentFragment();

        collection_folders.forEach(folder => {
            const result = folder.result;
            const row = create_workspace_row(result.batch, result.packages, result.is_kaltura);
            if (row) fragment.appendChild(row);
        });

        helpers.clear_element(container);
        container.appendChild(fragment);
        setup_workspace_listeners();
    };

    const create_workspace_row = function(batch_name, packages, is_kaltura) {
        const row = document.createElement('tr');
        row.dataset.batch = batch_name;
        row.dataset.kaltura = is_kaltura ? 'true' : 'false';

        // Batch name cell
        const batch_cell = document.createElement('td');
        batch_cell.className = 'batch-name-cell';
        const batch_text = document.createElement('small');
        batch_text.textContent = helpers.sanitize_text(batch_name);
        batch_cell.appendChild(batch_text);
        row.appendChild(batch_cell);

        // Packages list cell
        const packages_cell = document.createElement('td');
        packages_cell.className = 'packages-list-cell';
        packages_cell.appendChild(helpers.create_package_list(packages));
        row.appendChild(packages_cell);

        // Type cell
        const type_cell = document.createElement('td');
        type_cell.className = 'type-cell';
        const type_text = document.createElement('small');
        type_text.textContent = is_kaltura ? 'Kaltura Items' : 'Non Kaltura Items';
        type_cell.appendChild(type_text);
        row.appendChild(type_cell);

        // Actions cell
        const actions_cell = document.createElement('td');
        actions_cell.className = 'actions-cell';
        const button = create_action_button(batch_name);
        actions_cell.appendChild(button);
        row.appendChild(actions_cell);

        return row;
    };

    const create_action_button = function(batch_name) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-default run-qa action-start-button';
        button.dataset.batch = batch_name;

        const icon = document.createElement('i');
        icon.className = 'fa fa-cogs';
        const text = document.createElement('span');
        text.textContent = ' Start';

        button.appendChild(icon);
        button.appendChild(text);
        return button;
    };

    const setup_workspace_listeners = function() {
        const container = document.getElementById('packages');
        if (!container) return;

        container.removeEventListener('click', handle_workspace_click);
        container.addEventListener('click', handle_workspace_click);
    };

    const handle_workspace_click = function(event) {
        const button = event.target.closest('.action-start-button');
        if (!button) return;

        event.preventDefault();
        const batch_name = button.dataset.batch;
        if (batch_name) {
            obj.make_digital_objects(batch_name);
        }
    };

    const show_workspace_table = function() {
        const table = document.getElementById('digital-object-workspace-table');
        if (table) {
            table.style.visibility = 'visible';
            table.style.display = 'table';
        }
    };

    const hide_workspace_table = function() {
        const table = document.getElementById('digital-object-workspace-table');
        if (table) {
            table.style.visibility = 'hidden';
            table.style.display = 'none';
        }
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

    const initialize_kaltura_session = async function() {
        try {
            if (typeof get_ks === 'function') {
                const ks = await get_ks();
                if (ks && helpers.is_local_storage_available()) {
                    window.localStorage.setItem('ks', ks);
                }
            }
        } catch (error) {
            console.error('Failed to initialize Kaltura session:', error.message);
        }
    };

    const get_kaltura_status = function(batch_name) {
        try {
            const element = document.getElementById(batch_name);
            return (element && element.value === 'true') ? 1 : 0;
        } catch (error) {
            return 0;
        }
    };

    const submit_job = async function(job, api_key) {
        try {
            helpers.display_info_message(`Submitting job for batch: ${helpers.sanitize_text(job.batch_name)}`);

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/jobs`,
                data: job,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': api_key
                },
                timeout: helpers.get_config('REQUEST_TIMEOUT')
            });

            return response && response.status === 200;
        } catch (error) {
            console.error('Failed to submit job:', error.message);
            return false;
        }
    };

    const process_standard_job = async function(job_uuid, batch_name, batch_data, is_kaltura) {
        const files = batch_data.packages.map(pkg => pkg.files);
        await make_digital_objects_init(job_uuid, batch_name, batch_data, files, is_kaltura);
    };

    const process_kaltura_job = async function(job_uuid, batch_name, batch_data) {
        helpers.display_info_message(`(${helpers.sanitize_text(batch_name)}) Retrieving Entry IDs from Kaltura...`);

        await get_entry_ids(batch_data);
        const kaltura_files = await poll_kaltura_queue();

        if (kaltura_files) {
            await make_digital_objects_init(job_uuid, batch_name, batch_data, kaltura_files, 1);
        }
    };

    const poll_kaltura_queue = async function() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(async () => {
                try {
                    attempts++;
                    if (attempts > helpers.get_config('MAX_POLLING_ATTEMPTS')) {
                        clearInterval(interval);
                        reject(new Error('Kaltura queue polling timed out'));
                        return;
                    }

                    const response = await jobsModule.check_make_digital_objects_ks_queue();
                    if (response?.data?.length === 0) {
                        clearInterval(interval);
                        setTimeout(async () => {
                            const files = await process_kaltura_results();
                            await jobsModule.clear_ks_queue();
                            resolve(files);
                        }, helpers.get_config('KALTURA_COMPLETION_DELAY'));
                    }
                } catch (error) {
                    clearInterval(interval);
                    reject(error);
                }
            }, helpers.get_config('KALTURA_POLL_INTERVAL'));
        });
    };

    const process_kaltura_results = async function() {
        const ids_response = await jobsModule.get_ks_entry_ids();
        const files = [];
        const errors = [];

        ids_response?.data?.forEach(entry => {
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
        });

        if (errors.length > 0) {
            const error_msg = errors.map(e => `${e.file}: ${e.message}`).join('; ');
            helpers.display_error_message(error_msg);
            throw new Error('Kaltura processing completed with errors');
        }

        return files;
    };

    const make_digital_objects_init = async function(job_uuid, batch, json, files, is_kaltura) {
        try {
            const api_key = helperModule.getParameterByName('api_key');
            helpers.display_info_message('Making digital objects...');

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/make-digital-objects`,
                data: { batch, packages: json.packages, files, is_kaltura },
                headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
                timeout: helpers.get_config('REQUEST_TIMEOUT')
            });

            if (response?.status === 200) {
                const log = response.data.data;
                const has_errors = log.result.output.includes('Error:');

                await helpers.update_job_record({
                    uuid: job_uuid,
                    log: JSON.stringify(log),
                    error: has_errors ? log : '-----',
                    is_complete: has_errors ? 2 : 1
                });

                if (!has_errors) {
                    await helpers.delay(helpers.get_config('COMPLETION_DELAY'));
                    await check_uri_txt(batch, job_uuid);
                } else {
                    helpers.display_error_message('Digital objects creation completed with errors');
                }
            }
        } catch (error) {
            console.error('ERROR: [make_digital_objects_init]', error.message);
            helpers.display_error_message('Failed to create digital objects', error.message);
        }
    };

    const check_uri_txt = async function(batch, job_uuid) {
        try {
            const api_key = helperModule.getParameterByName('api_key');
            helpers.display_info_message(`Checking uri.txt files for batch: ${helpers.sanitize_text(batch)}`);

            const response = await httpModule.req({
                method: 'POST',
                url: `${nginx_path}/api/v1/astools/check-uri-txt`,
                data: { batch },
                headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
                timeout: helpers.get_config('REQUEST_TIMEOUT')
            });

            if (response?.status === 200) {
                const errors = response.data.data?.errors || [];

                if (errors.length > 0) {
                    await helpers.update_job_status(job_uuid, 2);
                    helpers.display_error_message('ArchivesSpace description errors detected');
                } else {
                    await handle_uri_check_success(batch, job_uuid, api_key);
                }
            }
        } catch (error) {
            console.error('ERROR: [check_uri_txt]', error.message);
            helpers.display_error_message('Failed to check URI text files', error.message);
        }
    };

    const handle_uri_check_success = async function(batch, job_uuid, api_key) {
        await helpers.update_job_status(job_uuid, 1);

        const batch_data = helpers.get_batch_data_from_storage(batch);
        const ingest_user = helpers.get_ingest_user_from_storage();
        const qa_job_uuid = helpers.generate_job_uuid();

        if (helpers.is_local_storage_available()) {
            window.localStorage.setItem('job_uuid', qa_job_uuid);
        }

        const qa_job = {
            uuid: qa_job_uuid,
            job_type: 'archivesspace_description_qa',
            batch_name: batch,
            packages: batch_data.packages,
            is_kaltura: batch_data.is_kaltura || 0,
            log: '---',
            error: '---',
            job_run_by: ingest_user.name
        };

        await httpModule.req({
            method: 'POST',
            url: `${nginx_path}/api/v1/astools/jobs`,
            data: qa_job,
            headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
            timeout: helpers.get_config('REQUEST_TIMEOUT')
        });

        // Remove beforeunload handler BEFORE showing success and reload
        remove_module_before_unload_handler();

        await helpers.delay(helpers.get_config('COMPLETION_DELAY'));
        helpers.show_success_with_reload('ArchivesSpace Description QA - Job complete.');
    };

    return obj;
}());