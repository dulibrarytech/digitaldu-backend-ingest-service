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

const TOKEN = require('../libs/tokens');
const INGEST_CONTROLLER = require('../ingester/controller');
const INIT = require('../ingester/ingest_init');
const CONTROLLER = new INGEST_CONTROLLER();

module.exports = async function (app) {

    app.route('/api/v1/ingest/packages')
    .get(TOKEN.verify, await CONTROLLER.get_collection_packages);

    app.route('/api/v1/ingest')
    .post(TOKEN.verify, INIT.ingest_init);

    app.route('/api/v1/ingest/status')
    .get(TOKEN.verify, CONTROLLER.get_status);

    app.route('/api/v1/process_metadata')
    .post(TOKEN.verify, CONTROLLER.process_metadata);

    app.route('/dashboard/ingest')
    .get(TOKEN.verify, CONTROLLER.get_dashboard_ingest_view);

    app.route('/dashboard/ingest/status')
    .get(TOKEN.verify, CONTROLLER.get_dashboard_ingest_status_view);

    app.route('/dashboard/ingest/complete')
    .get(CONTROLLER.get_dashboard_ingest_complete);
};