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

const WEB_SERVICES_CONFIG = require('../config/webservices_config')();
// const ARCHIVEMATICA_CONFIG = require('../config/archivematica_config')();
const ARCHIVESSPACE_CONFIG = require('../config/archivesspace_config')();
// const DURACLOUD_CONFIG = require('../config/duracloud_config')();
// const CONVERT_SERVICE_CONFIG = require('../config/webservices_config')();
const VALIDATOR_CONFIG = require('../config/index_records_validator_config')();
const INDEX_RECORD = require('../libs/index_record_lib');
const INDEX_LIB = new INDEX_RECORD(VALIDATOR_CONFIG);
const HANDLES = require('../libs/handles');
const HANDLES_LIB = new HANDLES();
const ARCHIVEMATICA = require('../libs/archivematica');
// const ARCHIVEMATICA_LIB = new ARCHIVEMATICA(ARCHIVEMATICA_CONFIG);
const ARCHIVESSPACE = require('../libs/archivesspace');
const ARCHIVESSPACE_LIB = new ARCHIVESSPACE(ARCHIVESSPACE_CONFIG);
const DURACLOUD = require('../libs/duracloud');
// const DURACLOUD_LIB = new DURACLOUD(DURACLOUD_CONFIG, CONVERT_SERVICE_CONFIG);
const DB = require('../config/db_config')();
const DB_QUEUE = require('../config/dbqueue_config')();
const DB_TABLES = require('../config/db_tables_config')();
// const QA_SERVICE_TASKS = require('../ingester/tasks/qa_service_tasks');
const INGEST_SERVICE_TASKS = require('../ingester/tasks/ingest_service_tasks');
// const INGEST_TASKS = new INGEST_SERVICE_TASKS(WEB_SERVICES_CONFIG, DB, DB_QUEUE, DB_TABLES);
// const QA_TASKS = new QA_SERVICE_TASKS(WEB_SERVICES_CONFIG);
const COLLECTION_TASKS = require('../ingester/tasks/collection_tasks');
const HELPER_TASKS = require('../libs/helper');
const HELPER = new HELPER_TASKS();
const LOGGER = require('../libs/log4');

/**
 * Collection service tasks
 * @type {Collection_service}
 */
const Collection_service = class {

    constructor() {
    }

    /**
     * Gets collections
     */
    async get_collections() {

        try {

            const TASK = new COLLECTION_TASKS(DB, DB_TABLES);
            return await TASK.get_collections();

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (get_collections)] Unable to get collections ' + error.message);
        }
    }

    /**
     * Creates collection in repository
     * @param uri
     * @param is_member_of_collection
     */
    async create_collection(uri, is_member_of_collection) {

        try {

            const TASK = new COLLECTION_TASKS(DB, DB_TABLES);
            return await TASK.create_collection(HELPER, HANDLES_LIB, ARCHIVESSPACE_LIB, INDEX_LIB, uri, is_member_of_collection);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (create_collection)] Unable to create collections ' + error.message);
        }
    }

    /**
     * Gets resources tree
     * @param resource_id
     * @param resource_uri
     * @param collection_uuid
     */
    async get_resources(resource_id, resource_uri, collection_uuid) {

        try {

            const TASK = new COLLECTION_TASKS(DB, DB_TABLES);
            return await TASK.get_resources(ARCHIVESSPACE_LIB, resource_id, resource_uri, collection_uuid);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (get_resources)] Unable to get resources ' + error.message);
        }
    }

    /**
     * Reassigns records
     * @param collection_uuid
     */
    async reassign_records(collection_uuid) {

        try {

            const TASK = new COLLECTION_TASKS(DB, DB_TABLES);
            return await TASK.reassign_records(collection_uuid);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (reassign_records)] Unable to reassign records ' + error.message);
        }
    }
}

module.exports = Collection_service;
