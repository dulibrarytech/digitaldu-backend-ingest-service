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

const INGEST_TASKS = require('../tasks/ingest_service_tasks');
const LOGGER = require('../../libs/log4');

/**
 * Collection tasks
 * @type {Collection_tasks}
 */
const Collection_tasks = class {

    constructor(DB, DB_TABLES) {
        this.DB = DB;
        this.TABLES = DB_TABLES;
    }

    /**
     * Gets collections
     */
    async get_collections() {

        try {

            return await this.DB(this.TABLES.repo.repo_objects)
            .select('is_member_of_collection', 'pid', 'mods')
            .where({
               object_type: 'collection',
               is_active: 1
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (get_collections)] Unable to get collections ' + error.message);
        }
    }

    /**
     * Creates collection in repository
     * @param HELPER
     * @param HANDLES_LIB
     * @param ARCHIVESSPACE_LIB
     * @param INDEX_LIB
     * @param uri
     * @param is_member_of_collection
     */
    async create_collection(HELPER, HANDLES_LIB, ARCHIVESSPACE_LIB, INDEX_LIB, uri, is_member_of_collection) {

        try {

            const TASKS = new INGEST_TASKS(null, this.DB, null, this.TABLES);
            const collection = await TASKS.check_collection(uri);

            if (collection.exists === true) {
                LOGGER.module().info('INFO: [/ingester/collection_tasks (create_collection)] Collection record is already in the repository ' + uri);
                return {
                    message: 'Collection already exists'
                };
            }

            LOGGER.module().info('INFO: [/ingester/collection_tasks (create_collection)] Getting collection record ' + uri);

            let token = await ARCHIVESSPACE_LIB.get_session_token();
            let record = await ARCHIVESSPACE_LIB.get_record(uri, token);
            let result = await ARCHIVESSPACE_LIB.destroy_session_token(token);

            if (record === false) {
                LOGGER.module().error('ERROR: [/ingester/collection_tasks (create_collection)] Unable to get ArchivesSpace record');
                return false;
            }

            if (result.data.status === 'session_logged_out') {
                LOGGER.module().info('INFO: [/ingester/tasks (create_collection)] ArchivesSpace session terminated');
            }

            let tmp = uri.split('/');
            const aspace_id = tmp[tmp.length - 1];
            let collection_record = {};
            collection_record.is_member_of_collection = is_member_of_collection;
            collection_record.pid = HELPER.create_uuid();
            collection_record.handle = await HANDLES_LIB.create_handle(collection_record.pid);
            // collection_record.handle = 'test-handle';
            collection_record.object_type = 'collection';
            collection_record.mods = JSON.stringify(record.metadata);
            collection_record.mods_id = aspace_id;
            collection_record.uri = uri;
            collection_record.sip_uuid = collection_record.pid;
            collection_record.is_published = 0;

            let index_record = INDEX_LIB.create_index_record(collection_record);
            console.log('INDEX ', index_record);
            console.log('COLLECTION ', collection_record)
            collection_record.display_record = JSON.stringify(index_record);
            let is_saved = await TASKS.save_repo_record(collection_record);

            if (is_saved !== true) {
                LOGGER.module().error('ERROR: [/ingester/collection_tasks (create_collection)] Unable to save collection record to DB');
                return false;
            }

            let is_indexed = await TASKS.index_repo_record(collection_record.pid, index_record);
            console.log('IS INDEXED ', is_indexed);
            if (is_indexed === false) {
                LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (create_collection)] Unable to index collection record');
                return false;
            }

            return collection_record.pid;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/collection_tasks (create_collection)] Unable to create collection ' + error.message);
            return false
        }
    }

    /**
     *
     * @param ARCHIVESSPACE_LIB
     * @param resource_id
     * @param resource_uri
     * @param collection_uuid
     */
    async get_resources(ARCHIVESSPACE_LIB, resource_id, resource_uri, collection_uuid) {

        try {

            const token = await ARCHIVESSPACE_LIB.get_session_token();
            const data = await ARCHIVESSPACE_LIB.get_resources(resource_id, resource_uri, token);
            await ARCHIVESSPACE_LIB.destroy_session_token(token);

            const tree = data.tree.precomputed_waypoints[resource_uri]['0'];
            let data_tree = [];
            let obj = {}

            for (let i = 0;i < tree.length;i++) {
                obj.collection_uuid = collection_uuid;
                obj.resource_uri = resource_uri;
                obj.uri = tree[i].uri;
                obj.identifier = tree[i].identifier;
                obj.title = tree[i].title;
                data_tree.push(obj);
                obj = {};
            }

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(data_tree)
                .into('tbl_resource_trees')
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            console.log(result);
            return data;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/collection_tasks (get_resources)] Unable to get resources ' + error.message);
        }
    }

    /**
     * Reassigns records
     * @param collection_uuid
     */
    async reassign_records(collection_uuid) {

        try {

            const uris = await this.DB('tbl_resource_trees')
            .select('*');

            let timer = setInterval(async () => {

                if (uris.length === 0) {
                    clearInterval(timer);
                    console.log('complete');
                    return false;
                }

                let record = uris.pop();
                console.log('record tree ', record.collection_uuid);
                console.log(record.uri);

                const result = await this.DB(this.TABLES.repo.repo_objects)
                .select('*')
                .where({
                    uri: record.uri,
                    is_active: 1
                });

                if (result.length > 1) {
                    // clearInterval(timer);
                    LOGGER.module().warn('WARN: [/ingester/collection tasks (reassign_records)] Record is a duplicate!');
                    // return false;
                }

                if (result[0] !== undefined) {

                    console.log('is member of collection ', result[0].is_member_of_collection);
                    console.log('new collection ', collection_uuid);
                    console.log('pid ', result[0].pid);

                    let display_record = JSON.parse(result[0].display_record);

                    if (result[0].pid === display_record.pid) {

                        let updated_display_record = display_record;
                        updated_display_record.is_member_of_collection = collection_uuid;
                        console.log('db ', result[0].pid);
                        console.log('json ', display_record.pid);

                        const is_updated = await this.DB(this.TABLES.repo.repo_objects)
                        .where({
                            uri: record.uri,
                            pid: result[0].pid,
                            is_active: 1
                        })
                        .update({
                            is_member_of_collection: collection_uuid,
                            display_record: JSON.stringify(updated_display_record)
                        });

                        const is_tree_updated = await this.DB('tbl_resource_trees')
                        .where({
                            uri: record.uri
                        })
                        .update({
                            is_complete: 1
                        });

                        console.log(is_updated);
                        console.log(is_tree_updated);

                        LOGGER.module().info('INFO: [/ingester/collection tasks (reassign_records)] Record reassigned');

                    } else {
                        LOGGER.module().warn('WARNING: [/ingester/collection tasks (reassign_records)] Duplicate skipped');
                    }

                } else {

                    const is_updated = await this.DB('tbl_resource_trees')
                    .where({
                        uri: record.uri
                    })
                    .update({
                        message: 'URI not found in repository',
                        is_complete: 1
                    });

                    console.log(is_updated);
                    LOGGER.module().info('INFO: [/ingester/collection tasks (reassign_records)] URI not found in repository');
                }

            }, 400);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/collection_tasks (reassign_records)] Unable to reassign records ' + error.message);
        }
    }
};

module.exports = Collection_tasks;
