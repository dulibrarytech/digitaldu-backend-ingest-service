/**

 Copyright 2024 University of Denver

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
const INGEST_CONTROLLER = require('../ingester/controller');
const INIT = require('../ingester/ingest_init');
const CONTROLLER = new INGEST_CONTROLLER();

module.exports = async function (app) {

    app.route(`${APP_CONFIG.app_path}/api/v1/ingest/packages`)
        .get(TOKEN.verify, await CONTROLLER.get_collection_packages);

    app.route(`${APP_CONFIG.app_path}/api/v1/ingest`)
        .post(TOKEN.verify, INIT.ingest_init);

    // bypasses automatic upload to sftp - CLI
    app.route(`${APP_CONFIG.app_path}/api/v1/start-archivematica-ingest`)
        .post(TOKEN.verify, await CONTROLLER.start_archivematica_ingest);

    app.route(`${APP_CONFIG.app_path}/api/v1/ingest/status`)
        .get(TOKEN.verify, CONTROLLER.get_status);

    app.route(`${APP_CONFIG.app_path}/dashboard/ingest`)
        .get(TOKEN.verify, CONTROLLER.get_dashboard_ingest_view);

    app.route(`${APP_CONFIG.app_path}/dashboard/ingest/status`)
        .get(TOKEN.verify, CONTROLLER.get_dashboard_ingest_status_view);

    app.route(`${APP_CONFIG.app_path}/dashboard/ingest/complete`)
        .get(CONTROLLER.get_dashboard_ingest_complete);

    app.route(`${APP_CONFIG.app_path}/dashboard/collections`)
        .get(CONTROLLER.get_dashboard_collections_view); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/collections`)
        .get(TOKEN.verify, CONTROLLER.get_collections)
        .post(TOKEN.verify, CONTROLLER.create_collection);

    app.route(`${APP_CONFIG.app_path}/api/v1/ingest/check`)
        .get(CONTROLLER.check_ingest); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/api/v1/resources/`)
        .get(TOKEN.verify, CONTROLLER.get_resources)
        .post(TOKEN.verify, CONTROLLER.reassign_records);

    app.route(`${APP_CONFIG.app_path}/dashboard/make-digital-objects`)
        .get(CONTROLLER.get_dashboard_astools_view); // TOKEN.verify,

    app.route(`${APP_CONFIG.app_path}/dashboard/workspace`)
        .get(CONTROLLER.get_dashboard_workspace_view); // TOKEN.verify,
};