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

const CONFIG = require('../config/app_config')();
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const SERVICE = require('../ingester/service');
const COLLECTION_TASKS = require('../ingester/tasks/collection_tasks');
const INGEST_SERVICE = new SERVICE();

/**
 *
 * @type {Ingest_controller}
 */
const Ingest_controller = class {

    constructor() {
    }

    /**
     * Gets ingest status
     * @param req
     * @param res
     */
    async get_status(req, res) {
        const data = await INGEST_SERVICE.get_status();
        res.status(data.status).send(data.data);
    }

    /**
     * Gets collection packages
     * @param req
     * @param res
     */
    async get_collection_packages(req, res) {
        const data = await INGEST_SERVICE.get_collection_packages();
        res.status(data.status).send(data.data);
    }

    /**
     * Starts ingest process
     * @param req
     */
    async start_ingest(req) {
        const batch = req.query.batch; // batch === collection folder name
        await INGEST_SERVICE.queue_packages(batch);
    }

    /**
     * Gets repository collections
     * @param req
     * @param res
     */
    async get_collections(req, res) {
        const TASK = new COLLECTION_TASKS(DB, DB_TABLES);
        const collections = await TASK.get_collections();
        res.status(200).send(collections);
    }

    /**
     * Renders ingest dashboard view
     * @param req
     * @param res
     */
    get_dashboard_ingest_view(req, res) {
        res.render('dashboard-ingest', {
            host: CONFIG.host,
            appname: CONFIG.app_name,
            appversion: CONFIG.app_version,
            organization: CONFIG.organization,
            app_path: CONFIG.app_path
        });
    };

    /**
     * Renders ingest status dashboard view
     * @param req
     * @param res
     */
    get_dashboard_ingest_status_view(req, res) {
        res.render('dashboard-ingest-status', {
            host: CONFIG.host,
            appname: CONFIG.app_name,
            appversion: CONFIG.app_version,
            organization: CONFIG.organization,
            app_path: CONFIG.app_path
        });
    };

    /**
     * Renders collections view
     * @param req
     * @param res
     */
    get_dashboard_collections_view(req, res) {
        res.render('dashboard-collections', {
            host: CONFIG.host,
            appname: CONFIG.app_name,
            appversion: CONFIG.app_version,
            organization: CONFIG.organization,
            app_path: CONFIG.app_path
        });
    };

    /**
     * Redirects to repo completed ingests view
     * @param req
     * @param res
     */
    get_dashboard_ingest_complete(req, res) {
        res.redirect(CONFIG.repo + '/dashboard/import/complete');
    }
}

module.exports = Ingest_controller;
