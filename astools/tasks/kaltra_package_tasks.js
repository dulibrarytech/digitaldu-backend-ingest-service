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

const Kaltura_package_tasks = class {

    constructor(DB, DB_TABLES) {
        this.DB = DB;
        this.TABLES = DB_TABLES;
    }

    async get_kaltura_package() {

        try {

            return await this.DB('tbl_kaltura_package_queue')
                .select('*')
                .where({
                    is_processed: 0
                })
                .limit(1);

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (get_jobs)] unable to get kaltura package record ' + error.message);
        }
    }

    async queue_kaltura_packages(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                    .into('tbl_kaltura_package_queue')
                    .transacting(trx)
                    .then(trx.commit)
                    .catch(trx.rollback);
            });

            if (result.length !== 1) {
                LOGGER.module().info('INFO: [/astools/tasks (queue_kaltura_packages)] Unable to queue packages.');
                return false;
            } else {
                LOGGER.module().info('INFO: [/astools/tasks (queue_kaltura_packages)] ' + result.length + ' Packages added to queue.');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (queue_kaltura_packages)] Unable to create package queue ' + error.message);
        }
    }

    async save_kaltura_ids(data) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data)
                    .into('tbl_kaltura_ids')
                    .transacting(trx)
                    .then(trx.commit)
                    .catch(trx.rollback);
            });

            if (result.length !== 1) {
                LOGGER.module().info('INFO: [/astools/tasks (save_kaltura_ids)] Unable to queue packages.');
                return false;
            } else {
                LOGGER.module().info('INFO: [/astools/tasks (save_kaltura_ids)] ' + result.length + ' Packages added to queue.');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (save_kaltura_ids)] Unable to create package queue ' + error.message);
        }
    }

    /*
    async update_queue_data(package_name, pairs) {

        try {
            console.log('QUEUE DATA ', pairs);
            await this.DB('tbl_kaltura_package_queue')
                .where({
                    package: package_name
                })
                .update({
                    pairs: JSON.stringify(pairs)
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (update_queue_data)] Unable to update queue data ' + error.message);
        }
    }
    */

    async update_queue_status(package_name) {

        try {

            await this.DB('tbl_kaltura_package_queue')
                .where({
                    package: package_name
                })
                .update({
                    is_processed: 1
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (update_job)] Unable to get job ' + error.message);
        }
    }

    async check_queue_status() {

        try {

            return await this.DB('tbl_kaltura_package_queue')
                .select('*')
                .where({
                    is_processed: 0
                });

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (get_jobs)] unable to get job record ' + error.message);
        }
    }

    async get_ks_entry_ids() {

        try {

            return await this.DB('tbl_kaltura_ids')
                .select('*');

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (get_ks_entry_ids)] unable to get ks entry ids ' + error.message);
        }
    }

    async clear_ks_queue() {

        try {

            await this.DB('tbl_kaltura_package_queue')
                .del();

            await this.DB('tbl_kaltura_ids')
                .del();

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/tasks (clear_ks_queue)] unable to clear ks queue ' + error.message);
        }
    }
}

module.exports = Kaltura_package_tasks;
