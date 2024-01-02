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

'use strict';

const CONFIG = require('../config/handle_config')();
const LOGGER = require('../libs/log4');
const HTTP = require('axios');

/**
 * Creates and updates Handles
 * @type {Handles}
 */
const Handles = class {

    constructor() {
        this.HANDLE_SERVICE = CONFIG.handle_service;
        this.HANDLE_PREFIX = CONFIG.handle_prefix;
        this.HANDLE_SERVER = CONFIG.handle_server;
        this.HANDLE_API_KEY = CONFIG.handle_api_key;
        this.TIMEOUT = 30000;
    }

    /**
     * Creates handle
     * @param uuid
     * @return {Promise<string>}
     */
    async create_handle(uuid) {

        try {

            let handle_url = `${this.HANDLE_SERVICE}?uuid=${uuid}&api_key=${this.HANDLE_API_KEY}`;
            let response = await HTTP.post(handle_url, '', {
                timeout: this.TIMEOUT
            });

            if (response.status === 201) {
                LOGGER.module().info('INFO: [/libs/handles lib (create_handle)] Handle for object: ' + uuid + ' had been created.');
                return this.HANDLE_SERVER + this.HANDLE_PREFIX + '/' + uuid;
            }

        } catch(error) {
            LOGGER.module().error('ERROR: [/libs/handles lib (create_handle)] Unable to create new handle ' + error.message);
            return false;
        }
    }

    /**
     * Updates handle
     * @param uuid
     */
    async update_handle(uuid) {

        try {

            let handle_url = `${this.HANDLE_SERVICE}?uuid=${uuid}&api_key=${this.HANDLE_API_KEY}`;
            let response = await HTTP.put(handle_url, '', {
                timeout: this.TIMEOUT
            });

            if (response.status === 201) {
                LOGGER.module().info('INFO: [/libs/handles lib (update_handle)] Handle for object: ' + uuid + ' had been updated.');
                return this.HANDLE_SERVER + this.HANDLE_PREFIX + '/' + uuid;
            }

        } catch(error) {
            LOGGER.module().error('ERROR: [/libs/handles lib (update_handle)] Unable to update handle ' + error.message);
            return false;
        }
    }
};

module.exports = Handles;
