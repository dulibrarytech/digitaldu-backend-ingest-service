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
const CONFIG = require('../config/webservices_config')();

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
                callback(response.data);
            }

        } catch (error) {
            console.error(error);
        }
    })();
};

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
            console.log(error);
        }

    })();
};
