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
// const TOKEN = require('../libs/tokens');
const CONTROLLER = require('../astools/controller');

module.exports = async function (app) {

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/workspace`)
        .get(CONTROLLER.workspace);  //TOKEN.verify,

        app.route(`${APP_CONFIG.app_path}/api/v1/astools/make-digital-objects`)
        .post(CONTROLLER.make_digital_objects);  //TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/check-uri-txt`)
        .post(CONTROLLER.check_uri_txt);  //TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/packages`)
        .post(CONTROLLER.get_packages); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/metadata`)
        .post(CONTROLLER.check_metadata); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs`)
        .get(CONTROLLER.get_job); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs/metadata`)
        .get(CONTROLLER.get_metadata_jobs); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs/ingest`)
        .get(CONTROLLER.get_ingest_jobs); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs/history`)
        .get(CONTROLLER.get_jobs_history); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs`)
        .put(CONTROLLER.update_job); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs`)
        .post(CONTROLLER.create_job); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/astools/jobs`)
        .delete(CONTROLLER.delete_job); // TOKEN.verify,
};
