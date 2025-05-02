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

const HELPER = require('../libs/helper');
const WEBSERVICES_CONFIG = {
    convert_service: process.env.CONVERT_SERVICE,
    convert_service_api_key: process.env.CONVERT_SERVICE_API_KEY,
    transcript_service: process.env.TRANSCRIPT_SERVICE,
    transcript_service_api_key: process.env.TRANSCRIPT_SERVICE_API_KEY,
    qa_service: process.env.QA_SERVICE,
    qa_service_api_key: process.env.QA_SERVICE_API_KEY,
    handle_update_service_host: process.env.HANDLE_UPDATE_SERVICE_HOST,
    handle_update_service_endpoint: process.env.HANDLE_UPDATE_SERVICE_ENDPOINT,
    handle_update_service_api_key: process.env.HANDLE_UPDATE_SERVICE_API_KEY,
    astools_service: process.env.ASTOOLS_SERVICE,
    astools_service_api_key: process.env.ASTOOLS_SERVICE_API_KEY,
};

module.exports = function () {
    const HELPER_TASK = new HELPER();
    return HELPER_TASK.check_config(WEBSERVICES_CONFIG);
};