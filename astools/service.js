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

const HTTP = require('axios');
const QA_SERVICE_TASKS = require("../ingester/tasks/qa_service_tasks");
const CONFIG = require('../config/webservices_config')();
const WEB_SERVICES_CONFIG = require('../config/webservices_config')();
// const QA_TASKS = new QA_SERVICE_TASKS(WEB_SERVICES_CONFIG);
const LOGGER = require('../libs/log4');

'use strict';

exports.get_workspace_packages = function (callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'workspace?api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.get(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                let packages = [];
                let package_files = [];

                if (response.data.errors.length > 0) {
                    callback(response.data);
                } else {

                    for (let package_name in response.data.result) {
                        packages.push(package_name);
                    }

                    let timer = setInterval(() => {

                        if (packages.length === 0) {
                            clearInterval(timer);
                            console.log('complete');
                            callback(package_files);
                            return false;
                        }

                        const package_name = packages.pop();

                        get_package_files(package_name, (result) => {
                            package_files.push(result);
                        });

                    }, 1000);
                }
            }

        } catch (error) {
            console.error(error);
        }

    })();
};

const get_package_files = function (package_name, callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'workspace/packages/files?package_name=' + package_name + '&api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.get(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                callback(response.data);
            } else {
                return false;
            }

        } catch (error) {
            console.error(error);
        }

    })();
}

exports.make_digital_objects = function (args, callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'make-digital-objects?api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.post(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: args
            });

            if (response.status === 200) {
                callback(response.data);
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Unable to make digital objects - ' + error.message);
        }

    })();
};

/**
 * Checks uri txt files
 * @param batch
 * @param callback
 */
exports.check_uri_txt = function (batch, callback) {

    (async function () {

        try {

            let uri_txts_checked = await check_uri_txts(batch);

            LOGGER.module().info('INFO: [/astools/service module (check_uri_txt)] ' + uri_txts_checked.uri_results.result);
            callback(uri_txts_checked.uri_results);

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Unable to check uri txt - ' + error.message);
        }

    })();
};

/**
 * Moves batch to ready folder
 * @param batch
 * @param callback
 */
exports.move_to_ready = function (batch, callback) {

    (async function () {

        try {

            let is_moved = await move_to_ready_folder(batch);
            LOGGER.module().info('INFO: [/astools/service module (move_to_ready)] ');
            callback(is_moved);

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (move_to_ready)] Unable to move batch to ready folder - ' + error.message);
        }

    })();
};

/**
 * Checks uri.txt in QA service
 * @param folder_name
 */
async function check_uri_txts(folder_name) {

    try {

        const ASTOOLS_URL = CONFIG.astools_service + 'check-uri-txt?folder=' + folder_name + '&api_key=' + CONFIG.astools_service_api_key;
        const response = await HTTP.get(ASTOOLS_URL, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            return response.data;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (check_uri_txts)] Unable to check uri.txt - ' + error.message);
        return false;
    }
}

async function move_to_ready_folder(folder_name) {

    try {

        const ASTOOLS_URL = CONFIG.astools_service + 'move-to-ready?folder=' + folder_name + '&api_key=' + CONFIG.astools_service_api_key;
        const response = await HTTP.get(ASTOOLS_URL, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            return response.data;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (move_to_ready_folder)] Unable to move batch to ready folder - ' + error.message);
        return false;
    }
}
