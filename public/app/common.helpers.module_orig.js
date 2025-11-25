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

const commonHelpers = (function () {
    'use strict';

    const obj = {};

    // Configuration constants
    const CONFIG = {
        RELOAD_DELAY: 4000,
        COMPLETION_DELAY: 2000,
        KALTURA_POLL_INTERVAL: 2500,
        KALTURA_COMPLETION_DELAY: 5000,
        MAX_POLLING_ATTEMPTS: 240,
        REQUEST_TIMEOUT: 600000
    };

    /**
     * Sanitizes text to prevent XSS
     */
    obj.sanitize_text = function(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const temp_div = document.createElement('div');
        temp_div.textContent = text;
        return temp_div.textContent;
    };

    /**
     * Safely clears an element's contents
     */
    obj.clear_element = function(element) {
        if (!element) {
            return;
        }
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    };

    /**
     * Displays an error message
     * @param {string} message - User-friendly error message
     * @param {string} technical_message - Optional technical error for console
     */
    obj.display_error_message = function(message, technical_message) {
        const message_container = document.getElementById('message');

        if (!message_container) {
            console.error('Message container not found');
            return;
        }

        obj.clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-danger';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-exclamation-circle';
        icon.setAttribute('aria-hidden', 'true');

        // Handle long messages by wrapping in a scrollable container if needed
        const safe_message = obj.sanitize_text(message);

        alert_div.appendChild(icon);

        // Check if message is very long (contains multiple errors)
        if (safe_message.length > 200) {
            const message_wrapper = document.createElement('div');
            message_wrapper.style.maxHeight = '300px';
            message_wrapper.style.overflowY = 'auto';
            message_wrapper.style.marginTop = '10px';

            const message_text = document.createElement('span');
            message_text.textContent = ' ' + safe_message;
            message_wrapper.appendChild(message_text);

            alert_div.appendChild(message_wrapper);
        } else {
            const message_text = document.createTextNode(' ' + safe_message);
            alert_div.appendChild(message_text);
        }

        if (technical_message) {
            console.error('Technical error:', technical_message);
        }

        message_container.appendChild(alert_div);

        // Scroll to message
        message_container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    /**
     * Displays an info message
     */
    obj.display_info_message = function(message) {
        const message_container = document.getElementById('message');

        if (!message_container) {
            return;
        }

        obj.clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-info';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-info-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' ' + obj.sanitize_text(message));

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);

        message_container.appendChild(alert_div);
    };

    /**
     * Displays a success message
     */
    obj.display_success_message = function(message) {
        const message_container = document.getElementById('message');

        if (!message_container) {
            console.error('Message container not found');
            return;
        }

        obj.clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-success';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-check-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' ' + obj.sanitize_text(message));

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);

        message_container.appendChild(alert_div);
    };

    /**
     * Clears the message area
     */
    obj.clear_message_area = function() {
        const message_container = document.getElementById('message');
        if (message_container) {
            obj.clear_element(message_container);
        }
    };

    /**
     * Checks if localStorage is available
     */
    obj.is_local_storage_available = function() {
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
     * Checks if sessionStorage is available
     */
    obj.is_session_storage_available = function() {
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
     * Generates a job UUID
     */
    obj.generate_job_uuid = function() {
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
     * Gets ingest user from sessionStorage
     */
    obj.get_ingest_user_from_storage = function() {
        try {
            if (!obj.is_session_storage_available()) {
                console.error('sessionStorage is not available');
                return null;
            }

            const user_data_string = window.sessionStorage.getItem('ingest_user');

            if (!user_data_string) {
                console.error('User data not found in sessionStorage');
                return null;
            }

            const user_data = JSON.parse(user_data_string);

            if (!Array.isArray(user_data) || user_data.length === 0) {
                console.error('Invalid user data structure');
                return null;
            }

            const user = user_data[0];

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
     * Updates job status
     */
    obj.update_job_status = async function(job_uuid, status) {
        try {
            if (!job_uuid || !status) {
                return false;
            }

            if (jobsModule && typeof jobsModule.update_job === 'function') {
                await jobsModule.update_job({
                    uuid: job_uuid,
                    is_complete: status
                });
                return true;
            } else {
                console.error('jobsModule.update_job is not available');
                return false;
            }

        } catch (error) {
            console.error('Failed to update job status:', error.message);
            return false;
        }
    };

    /**
     * Updates job with complete information
     */
    obj.update_job_record = async function(job_data) {
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
     * Delay utility function
     */
    obj.delay = function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    /**
     * Removes beforeunload event handler
     * Can accept a specific handler or remove the common one
     */
    obj.remove_before_unload_handler = function(handler) {
        try {
            // Remove specific handler if provided
            if (handler && typeof handler === 'function') {
                window.removeEventListener('beforeunload', handler);
                console.log('Beforeunload handler removed (specific)');
                return;
            }

            // Remove helperModule.alert_user if available
            if (helperModule && typeof helperModule.alert_user === 'function') {
                window.removeEventListener('beforeunload', helperModule.alert_user);
                console.log('Beforeunload handler removed (helperModule.alert_user)');
            }
        } catch (error) {
            console.error('Failed to remove beforeunload handler:', error.message);
        }
    };

    /**
     * Creates a standard beforeunload handler
     */
    obj.create_before_unload_handler = function(message) {
        const default_message = message || 'Processing is in progress. Are you sure you want to leave?';

        return function(event) {
            event.preventDefault();
            event.returnValue = default_message;
            return default_message;
        };
    };

    /**
     * Shows success with auto-reload countdown
     */
    obj.show_success_with_reload = function(message, reload_delay) {
        const delay_ms = reload_delay || CONFIG.RELOAD_DELAY;
        const message_container = document.getElementById('message');

        if (!message_container) {
            // Remove any beforeunload handlers before reload
            obj.remove_all_before_unload_handlers();
            setTimeout(() => window.location.reload(), delay_ms);
            return;
        }

        obj.clear_element(message_container);

        const alert_div = document.createElement('div');
        alert_div.className = 'alert alert-success';
        alert_div.setAttribute('role', 'alert');

        const icon = document.createElement('i');
        icon.className = 'fa fa-check-circle';
        icon.setAttribute('aria-hidden', 'true');

        const message_text = document.createTextNode(' ' + obj.sanitize_text(message) + ' Page will reload in ');

        const countdown_span = document.createElement('span');
        countdown_span.className = 'font-weight-bold';
        let seconds_remaining = Math.ceil(delay_ms / 1000);
        countdown_span.textContent = seconds_remaining;

        const seconds_text = document.createTextNode(' seconds. ');

        const reload_link = document.createElement('a');
        reload_link.href = '#';
        reload_link.textContent = 'Reload now';
        reload_link.className = 'alert-link';

        let reload_timeout = null;
        let countdown_interval = null;

        reload_link.onclick = function(event) {
            event.preventDefault();

            if (reload_timeout) {
                clearTimeout(reload_timeout);
            }
            if (countdown_interval) {
                clearInterval(countdown_interval);
            }

            // Remove any beforeunload handlers before reload
            obj.remove_all_before_unload_handlers();
            window.location.reload();
        };

        alert_div.appendChild(icon);
        alert_div.appendChild(message_text);
        alert_div.appendChild(countdown_span);
        alert_div.appendChild(seconds_text);
        alert_div.appendChild(reload_link);

        message_container.appendChild(alert_div);

        countdown_interval = setInterval(() => {
            seconds_remaining--;
            countdown_span.textContent = seconds_remaining;

            if (seconds_remaining <= 0) {
                clearInterval(countdown_interval);
            }
        }, 1000);

        reload_timeout = setTimeout(() => {
            if (countdown_interval) {
                clearInterval(countdown_interval);
            }
            console.log('Auto-reloading page...');

            // Remove any beforeunload handlers before reload
            obj.remove_all_before_unload_handlers();
            window.location.reload();
        }, delay_ms);
    };

    /**
     * Removes all possible beforeunload handlers (safety measure)
     */
    obj.remove_all_before_unload_handlers = function() {
        try {
            // Remove helperModule.alert_user if available
            if (helperModule && typeof helperModule.alert_user === 'function') {
                window.removeEventListener('beforeunload', helperModule.alert_user);
            }
            console.log('All beforeunload handlers removed');
        } catch (error) {
            console.error('Failed to remove all beforeunload handlers:', error.message);
        }
    };

    /**
     * Shows loading indicator
     */
    obj.show_loading_indicator = function(selector) {
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
    obj.hide_loading_indicator = function() {
        const loading = document.getElementById('loading-indicator');

        if (loading && loading.parentNode) {
            loading.parentNode.removeChild(loading);
        }
    };

    /**
     * Validates job data structure
     */
    obj.validate_job_data = function(job) {
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
     * Gets batch data from localStorage
     */
    obj.get_batch_data_from_storage = function(batch_name, suffix) {
        try {
            if (!obj.is_local_storage_available()) {
                console.error('localStorage is not available');
                return null;
            }

            const storage_key = suffix ? batch_name + suffix : batch_name;
            const batch_data_string = window.localStorage.getItem(storage_key);

            if (!batch_data_string) {
                console.error('Batch data not found in localStorage');
                return null;
            }

            const batch_data = JSON.parse(batch_data_string);

            if (!batch_data || typeof batch_data !== 'object') {
                console.error('Invalid batch data structure');
                return null;
            }

            return batch_data;

        } catch (error) {
            console.error('Failed to retrieve batch data:', error.message);
            return null;
        }
    };

    /**
     * Creates a package list UL element
     */
    obj.create_package_list = function(packages) {
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
            small_text.textContent = obj.sanitize_text(package_name);
            list_item.appendChild(small_text);
            list.appendChild(list_item);
        }

        return list;
    };

    /**
     * Gets configuration value
     */
    obj.get_config = function(key) {
        return CONFIG[key];
    };

    return obj;
}());