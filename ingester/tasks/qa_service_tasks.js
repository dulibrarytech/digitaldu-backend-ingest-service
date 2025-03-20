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

const HTTP = require('axios');
const KA = require('http');
const LOGGER = require('../../libs/log4');
const {response} = require("express");
const QA_ENDPOINT_PATH = '/api/v2/qa/';
const TIMEOUT = 60000 * 60;

/**
 *
 * @type {QA_service_tasks}
 */
const QA_service_tasks = class {

    constructor(CONFIG) {
        this.CONFIG = CONFIG;
    }

    /**
     * Gets collection packages
     */
    async get_collection_packages() {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'list-ready-folders?api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (get_folder_list)] request to QA server failed - ' + error.message);
        }
    }

    /**
     * Gets item packages
     * @param collection_package
     * @return {Promise<any>}
     */
    async get_item_packages(collection_package) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'package-names?folder=' + collection_package + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (get_item_packages)] request to QA server failed - ' + error.message);
        }
    }

    /**
     * Sets folder name in QA service
     */
    async set_folder_name(folder_name) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'set-collection-folder?folder=' + folder_name + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (set_folder_name)] Unable to set folder name - ' + error.message);
            return {
                is_set: false
            };
        }
    }

    /**
     * Checks folder name in QA service
     * @param folder_name
     */
    async check_folder_name(folder_name) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'check-collection-folder?folder=' + folder_name + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (check_folder_name)] Unable to check folder name - ' + error.message);
            return {
                folder_name_results: {
                    errors: error.message
                }
            }
        }
    }

    /**
     * Checks package names in QA service
     * @param folder_name
     */
    async check_package_names(folder_name) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'check-package-names?folder=' + folder_name + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                httpAgent: new KA.Agent({
                    keepAlive: true,
                    maxSockets: 1,
                    keepAliveMsecs: 3000
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (check_package_names)] Unable to check package names - ' + error.message);
            return {
                package_name_results: {
                    errors: error.message
                }
            };
        }
    }

    /**
     * Gets total batch size in QA service
     * @param folder_name
     */
    async get_total_batch_size(folder_name) {

        try {

            const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}get-total-batch-size?folder=${folder_name}&api_key=${this.CONFIG.qa_service_api_key}`;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (get_total_batch_size)] Unable to get total batch size - ' + error.message);
            return false;
        }
    }

    /**
     * Gets package file count in QA service
     * @param collection_folder
     * @param archival_package
     */
    async get_package_file_count(collection_folder, archival_package) { //

        try {

            const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}package-file-count?folder=${collection_folder}&package=${archival_package}&api_key=${this.CONFIG.qa_service_api_key}`;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (get_package_file_count)] Unable to get package file count - ' + error.message);
            return false;
        }
    }

    /**
     * Checks uri.txt in QA service
     * @param folder_name
     */
    async check_uri_txt(folder_name) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'check-uri-txt?folder=' + folder_name + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (check_uri_txt)] Unable to check uri.txt - ' + error.message);
            return false;
        }
    }

    /**
     * Moves packages to ingest folder in QA service
     * @param uuid
     * @param folder_name
     * @param archival_package
     * @param callback
     */
    move_to_ingest(uuid, folder_name, archival_package, callback) {

        (async () => {

            try {

                const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}move-to-ingest?uuid=${uuid}&folder=${folder_name}&package=${archival_package}&api_key=${this.CONFIG.qa_service_api_key}`;
                const response = await HTTP.get(QA_URL, {
                    timeout: 60000*5,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 200) {
                    return response.data;
                }

            } catch (error) {
                LOGGER.module().error('ERROR: [/ingester/tasks (move_to_ingest)] Unable to move packages to ingest folder - ' + error.message);
                return false;
            }

        })();

        callback(true);
    }

    /**
     * Moves packages to Archivematica SFTP in QA service
     * @param uuid
     * @param callback
     */
    move_to_sftp(uuid, callback) {

        (async () => {

            try {

                const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}move-to-sftp?uuid=${uuid}&api_key=${this.CONFIG.qa_service_api_key}`;
                await HTTP.get(QA_URL, {
                    timeout: 60000 * 30,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

            } catch (error) {
                LOGGER.module().error('ERROR: [/ingester/tasks (move_to_sftp)] move to sftp error occurred - ' + error.message);
            }

        })();

        callback(true);
    }

    /**
     * Gets sftp upload status
     * @param uuid
     * @param total_batch_file_count
     */
    async sftp_upload_status(uuid, total_batch_file_count) {

        try {

            const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}upload-status?uuid=${uuid}&total_batch_file_count=${total_batch_file_count}&api_key=${this.CONFIG.qa_service_api_key}`;
            const response = await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                return {
                    data: response.data
                };

            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (upload_status)] request to QA server failed - ' + error.message);
        }
    }
};

module.exports = QA_service_tasks;
