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

const DB_QUEUE = require('../config/dbqueue_config')();
const DB_TABLES = require('../config/db_tables_config')();
const JOB_TASKS = require('../astools/tasks/job_tasks');
const TASKS = new JOB_TASKS(DB_QUEUE, DB_TABLES);
const LOGGER = require('../libs/log4');

exports.create_job = async function (job) {

    try {

        return await TASKS.create_job(job);

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/task (create_job)] unable to create job ' + error.message);
        return false;
    }
};

exports.update_job = async function (job) {

    try {

        return await TASKS.update_job(job);

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/task (create_job)] unable to update job ' + error.message);
        return false;
    }
};

exports.get_job = async function (job_uuid) {

    try {

        return await TASKS.get_job(job_uuid);

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/task (get_job)] unable to get job ' + error.message);
        return false;
    }
};

exports.get_metadata_jobs = async function () {

    try {

        return await TASKS.get_metadata_jobs();

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/task (get_metadata_jobs)] unable to get metadata jobs ' + error.message);
        return false;
    }
};