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

const LOGGER = require('../../libs/log4');

const Job_tasks = class {

    constructor(DB, DB_TABLES) {
        this.DB = DB;
        this.TABLES = DB_TABLES;
    }

    async create_job(job) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(job)
                    .into(this.TABLES.repo_jobs)
                    .transacting(trx)
                    .then(trx.commit)
                    .catch(trx.rollback);
            });

            if (result.length !== 1) {
                LOGGER.module().info('INFO: [/astools/tasks (save_job)] Unable to save job.');
                return false;
            } else {
                LOGGER.module().info('INFO: [/astools/tasks (save_job)] ' + result.length + ' Packages added to queue.');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (save_job)] Unable to save job ' + error.message);
        }
    }

    async update_job(job) {

        try {

            await this.DB(this.TABLES.repo_jobs)
                .where({
                    uuid: job.uuid
                })
                .update(job);

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (update_job)] Unable to get job ' + error.message);
        }
    }

    async get_job(job_uuid) {

        try {

            return await this.DB(this.TABLES.repo_jobs)
                .select('*')
                .where({
                    uuid: job_uuid
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (get_jobs)] unable to get job record ' + error.message);
        }
    }

}

module.exports = Job_tasks;
