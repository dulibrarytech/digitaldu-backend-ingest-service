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

'use strict';

const APP_CONFIG = require('../config/app_config')();
const TOKEN = require('../libs/tokens');
const CONTROLLER = require('../astools/controller');

module.exports = async function (app) {

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/workspace`)
        .get(TOKEN.verify, CONTROLLER.workspace);

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/make-digital-objects`)
        .post(TOKEN.verify, CONTROLLER.make_digital_objects);

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/check-uri-txt`)
        .post(TOKEN.verify, CONTROLLER.check_uri_txt);

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/packages`)
        .post(TOKEN.verify, CONTROLLER.get_packages);

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/metadata`)
        .post(TOKEN.verify, CONTROLLER.check_metadata);

    // TODO: remove
    /*
    app.route(`${APP_CONFIG.app_path}/api/v1/astools/move-to-ready`)
        .post(TOKEN.verify, CONTROLLER.move_to_ready);

     */
};
