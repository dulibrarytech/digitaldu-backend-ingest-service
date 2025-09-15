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
const CONTROLLER = require('../kaltura/controller');

module.exports = async function (app) {

    app.route(`${APP_CONFIG.app_path}/api/v1/kaltura/session`)
        .post(TOKEN.verify, CONTROLLER.get_ks_session);

    app.route(`${APP_CONFIG.app_path}/api/v1/kaltura/metadata`)
        .post(CONTROLLER.get_ks_metadata); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/kaltura/queue`)
        .get(CONTROLLER.check_ks_queue); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/kaltura/queue/entry_ids`)
        .get(CONTROLLER.get_ks_entry_ids); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/kaltura/queue/clear`)
        .post(CONTROLLER.clear_ks_queue); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/kaltura/export`)
        .post(CONTROLLER.export_data); // TOKEN.verify,
};
