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

const HTTP = require('axios');
const KA = require('http');
const {Client} = require('@elastic/elasticsearch');
const ES_CONFIG = require('../../config/elasticsearch_config')();
const WEBSERVICES_CONFIG = require('../../config/webservices_config')();
const LOGGER = require('../../libs/log4');
const QA_ENDPOINT_PATH = '/api/v2/qa/';
const TIMEOUT = 60000 * 25;
const CLIENT = new Client({
    node: ES_CONFIG.elasticsearch_host
});

/**
 * Ingest service tasks
 * @type {Ingest_service_tasks}
 */
const Ingest_service_tasks = class {

    constructor(CONFIG, DB, DB_QUEUE, TABLES) {
        this.CONFIG = CONFIG;
        this.DB = DB;
        this.DB_QUEUE = DB_QUEUE;
        this.TABLES = TABLES;
    }

    /**
     * Gets ingest status
     */
    async get_status() {

        try {
            return await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .select('id', 'status', 'batch', 'package', 'collection_uuid', 'batch_size', 'file_count', 'metadata_uri', 'micro_service', 'error', 'is_complete')
            .orderBy('created', 'desc');
        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (get_status)] Unable get status ' + error.message);
            return false;
        }
    }

    /**
     * Adds packages to ingest queue
     * @param packages
     */
    async queue_packages(packages) {

        try {

            const result = await this.DB_QUEUE.transaction((trx) => {
                this.DB_QUEUE.insert(packages)
                .into(this.TABLES.repo_queue.repo_ingest_queue)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            if (result.length !== 1) {
                LOGGER.module().info('INFO: [/ingester/ingest_service_tasks (queue_packages)] Unable to queue packages.');
                return false;
            } else {
                LOGGER.module().info('INFO: [/ingester/ingest_service_tasks (queue_packages)] ' + result.length + ' Packages added to queue.');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (queue_packages)] Unable to queue packages ' + error.message);
        }
    }

    /**
     * Updates ingest queue
     * @param where_obj
     * @param data
     * @return {Promise<void>}
     */
    async update_ingest_queue(where_obj, data) {

        try {

            await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .where(where_obj)
            .update(data);
            LOGGER.module().info('INFO: [/ingester/tasks (update_ingest_queue)] Queue updated');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (update_ingest_queue)] unable to update ingest queue ' + error.message);
            return false;
        }
    }

    /**
     * Gets queue data by archival package
     * @param archival_package
     */
    async get_queue_data(archival_package) {

        try {

            return await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .select('*')
            .where({
                package: archival_package
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (get_queue_data)] unable to get ingest queue data ' + error.message);
        }
    }

    /**
     * Gets queue data by sip uuid
     * @param sip_uuid
     */
    async get_queue_data_by_uuid(sip_uuid) {

        try {

            return await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .select('*')
            .where({
                sip_uuid: sip_uuid
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (get_queue_data)] unable to get ingest queue data ' + error.message);
        }
    }

    /**
     * Checks uri to determine if collection already exists
     * @param uri
     * @returns boolean
     */
    async check_collection(uri) {

        try {

            const data = await this.DB(this.TABLES.repo.repo_objects)
            .select('is_member_of_collection', 'pid')
            .where({
                uri: uri,
                object_type: 'collection',
                is_active: 1
            });

            if (data.length === 1) {
                return {
                    is_member_of_collection: data[0].is_member_of_collection,
                    uuid: data[0].pid,
                    exists: true
                };
            } else {
                return {
                    exists: false
                };
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (check_collection)] Unable to check collection ' + error.message);
        }
    }

    /**
     * Creates collection in repository
     * @param HELPER
     * @param HANDLES_LIB
     * @param ARCHIVESSPACE_LIB
     * @param INDEX_LIB
     * @param uri
     */
    async create_collection(HELPER, HANDLES_LIB, ARCHIVESSPACE_LIB, INDEX_LIB, uri) {

        try {

            LOGGER.module().info('INFO: [/ingester/service_tasks (create_collection)] Getting collection record ' + uri);

            let token = await ARCHIVESSPACE_LIB.get_session_token();
            let record = await ARCHIVESSPACE_LIB.get_record(uri, token);
            let result = await ARCHIVESSPACE_LIB.destroy_session_token(token);

            if (result.data.status === 'session_logged_out') {
                LOGGER.module().info('INFO: [/ingester/tasks (create_collection)] ArchivesSpace session terminated');
            }

            let tmp = uri.split('/');
            const aspace_id = tmp[tmp.length - 1];

            let collection_record = {};
            collection_record.is_member_of_collection = 'codu:root';
            collection_record.pid = HELPER.create_uuid();
            collection_record.handle = await HANDLES_LIB.create_handle(collection_record.pid);
            collection_record.object_type = 'collection';
            collection_record.mods = JSON.stringify(record.metadata);
            collection_record.mods_id = aspace_id;
            collection_record.uri = uri;
            collection_record.sip_uuid = collection_record.pid;

            let index_record = INDEX_LIB.create_index_record(collection_record);
            collection_record.display_record = JSON.stringify(index_record);

            let is_saved = await this.save_repo_record(collection_record);

            if (is_saved !== true) {

                await this.update_ingest_queue({
                    metadata_uri: uri,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to save collection record',
                    is_complete: 1
                });

                return false;
            }

            let is_indexed = await this.index_repo_record(collection_record.pid, JSON.parse(collection_record.display_record));

            if (is_indexed !== true) {
                LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (create_collection)] Unable to index collection record ');
                await this.update_ingest_queue({
                    metadata_uri: uri,
                    is_complete: 0
                }, {
                    index_record: JSON.stringify(index_record),
                    collection_uuid: collection_record.pid,
                    status: 'COLLECTION_RECORD_NOT_INDEXED',
                    error: 'Unable to index collection record'
                });
            }

            if (is_saved === true && is_indexed === true) {

                await this.update_ingest_queue({
                    metadata_uri: uri,
                    is_complete: 0
                }, {
                    index_record: JSON.stringify(index_record),
                    collection_uuid: collection_record.pid,
                    status: 'REPOSITORY_COLLECTION_RECORD_CREATED_AND_INDEXED'
                });
            }

            return collection_record.pid;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (create_collection)] Unable to create collection ' + error.message);
            return false
        }
    }

    /**
     * Gets package
     * @param batch
     */
    async get_package(batch) {

        try {

            const data = await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .select('collection_uuid', 'package')
            .where({
                batch: batch,
                is_complete: 0
            })
            .orderBy('id', 'asc')
            .limit(1);

            if (data.length > 0) {
                return data[0];
            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (get_package)] unable to get package ' + error.message);
        }
    }

    /**
     * Gets metadata uri
     * @param folder_name
     * @param archival_package
     */
    async get_metadata_uri(folder_name, archival_package) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'get-uri-txt?folder=' + folder_name + '&package=' + archival_package + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                timeout: TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (get_uri_txt)] Unable to get uri.txt - ' + error.message);
        }
    }

    /**
     * Moves packages to ingested folder
     * @param uuid
     * @param callback
     */
    async move_to_ingested(uuid, callback) {

        try {

            const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}move-to-ingested?uuid=${uuid}&folder=collection&api_key=${this.CONFIG.qa_service_api_key}`;
            await HTTP.get(QA_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (move_to_ingest)] Unable to move packages to ingested folder - ' + error.message);
        }

        callback(true);
    }

    /**
     * Get total file count for all packages
     */
    async get_file_count() {

        try {

            const data = await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .sum('file_count as file_count');

            return parseInt(data[0].file_count);

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (get_file_count)] Unable to get file count - ' + error.message);
        }
    }

    /**
     * Gets metadata
     * @param ARCHIVESSPACE_LIB
     * @param uri
     */
    async process_metadata(ARCHIVESSPACE_LIB, uri) {

        try {

            let token = await ARCHIVESSPACE_LIB.get_session_token();
            let errors = [];
            let error = null;

            LOGGER.module().info('INFO: [/qa/service_tasks (check_metadata)] Checking record ' + uri);

            let record = await ARCHIVESSPACE_LIB.get_record(uri, token);

            if (record.metadata.title === undefined || record.metadata.title.length === 0) {
                errors.push('Title field is missing');
            }

            if (record.metadata.uri === undefined || record.metadata.uri.length === 0) {
                errors.push('URI field is missing');
            }

            if (record.metadata.identifiers === undefined || record.metadata.identifiers.length === 0) {
                errors.push('Identifier field is missing');
            }

            if (record.metadata.notes === undefined || record.metadata.notes.length === 0) {
                errors.push('Notes field is missing - The notes field contains the abstract and rights statement');
            } else {

                for (let i = 0; i < record.metadata.notes.length; i++) {

                    if (record.metadata.notes[i].type === 'abstract' && record.metadata.notes[i].content.length === 0) {
                        errors.push('Abstract field is missing');
                    }

                    if (record.metadata.notes[i].type === 'userestrict' && record.metadata.notes[i].content.length === 0) {
                        errors.push('Rights statement field is missing');
                    }
                }
            }

            if (record.metadata.dates !== undefined) {

                for (let i = 0; i < record.metadata.dates.length; i++) {

                    if (record.metadata.dates[i].expression === undefined || record.metadata.dates[i].expression.length === 0) {
                        errors.push('Date expression is missing');
                    }
                }
            }

            if (record.metadata.is_compound === true) {
                if (record.metadata.parts === undefined || record.metadata.parts.length < 2) {
                    errors.push('Compound objects are missing');
                }
            }

            if (record.metadata.parts === undefined || record.metadata.parts.length === 0) {
                errors.push('Parts is missing');
            } else {

                for (let i = 0; i < record.metadata.parts.length; i++) {
                    if (record.metadata.parts[i].type === null || record.metadata.parts[i].type.length === 0) {
                        errors.push('Mime-type is missing (' + record.metadata.parts[i].title + ')');
                    }
                }
            }

            if (errors.length > 0) {
                error = JSON.stringify(errors);
            }

            await this.update_ingest_queue({
                metadata_uri: uri
            }, {
                metadata: JSON.stringify(record.metadata),
                error: error
            });

            let result = await ARCHIVESSPACE_LIB.destroy_session_token(token);

            if (result.data.status === 'session_logged_out') {
                LOGGER.module().info('INFO: [/ingester/tasks (process_metadata)] ArchivesSpace session terminated');
            }

            return record.metadata;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (process_metadata)] Unable to process metadata - ' + error.message);
        }
    }

    /**
     * Gets metadata uri by sip_uuid
     * @param sip_uuid
     */
    async get_uri(sip_uuid) {

        try {

            const data = await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .select('metadata_uri')
            .where({
                sip_uuid: sip_uuid,
                is_complete: 0
            });

            if (data.length > 0) {
                return data[0].metadata_uri;
            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (get_uri)] unable to get uri ' + error.message);
        }
    }

    /**
     * Gets metadata
     * @param sip_uuid
     */
    async get_metadata(sip_uuid) {

        try {

            const data = await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .select('metadata')
            .where({
                sip_uuid: sip_uuid,
                is_complete: 0
            });

            if (data.length > 0) {
                return data[0].metadata;
            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (get_uri)] unable to get uri ' + error.message);
        }
    }

    /**
     * Gets record transcript if one is available
     * @param data
     */
    async get_transcript(data) {

        try {

            let metadata = JSON.parse(data);
            let call_number = metadata.identifiers.map(function (node) {
                if (node.type === 'local') {
                    return node.identifier;
                }
            });
            // TODO: get transcript service config
            let endpoint = WEBSERVICES_CONFIG.transcript_service + '/api/v1/transcript?call_number=' + call_number + '&api_key=' + WEBSERVICES_CONFIG.transcript_service_api_key;
            let response = await HTTP.get(endpoint, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('transcript ', response);

            if (response.status === 200) {
                let transcript_search = response.data.transcript_search;  // for search - save to index
                let transcript_obj = {};
                transcript_obj.transcript = response.data.transcripts;  // display and edits - save to DB
                transcript_obj.transcript_search = transcript_search;
                return transcript_obj;
            }

        } catch (error) {
            LOGGER.module().info('INFO: [/ingester/tasks (get_transcript)] No transcript found for this record. ' + error.message);
            return false;
        }
    }

    /**
     * Saves repository record
     * @param record
     */
    async save_repo_record(record) {

        try {

            const result = await this.DB.transaction((trx) => {
                this.DB.insert(record)
                .into(this.TABLES.repo.repo_objects)
                .transacting(trx)
                .then(trx.commit)
                .catch(trx.rollback);
            });

            if (result.length !== 1) {
                LOGGER.module().info('INFO: [/ingester/ingest_service_tasks (save_repo_record)] Unable to save repository record.');
                return false;
            } else {
                LOGGER.module().info('INFO: [/ingester/ingest_service_tasks (save_repo_record)] ' + result.length + ' Repository record saved.');
                return true;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (save_repo_record)] Unable to save repository record ' + error.message);
        }
    }

    /**
     * Indexes repository record
     * @param uuid
     * @param index_record
     */
    async index_repo_record(uuid, index_record) {

        try {

            const index = ES_CONFIG.elasticsearch_back_index;

            LOGGER.module().info('INFO: [/ingester/ingest_service_tasks (index_repo_record)] indexing ' + uuid + ' into ' + index);

            const response = await CLIENT.index({
                index: index,
                id: uuid,
                body: index_record,
                refresh: true
            });

            if (response.statusCode === 201 || response.statusCode === 200) {
                return true;
            } else {
                return false;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (index_repo_record)] unable to index record ' + error.message);
            return false;
        }
    }

    /**
     * Adds  handle to ArchivesSpace record
     * @param handle
     * @param aspace_id,
     * @param callback
     */
    add_handle(handle, aspace_id, callback) {

        try {

            (async () => {

                if (this.CONFIG.handle_update_service_host !== 'localhost') {

                    let endpoint = this.CONFIG.handle_update_service_host + this.CONFIG.handle_update_service_endpoint + '?api_key=' + this.CONFIG.handle_update_service_api_key + '&object_id=' + aspace_id;
                    let response = await HTTP.get(endpoint, {
                        timeout: 15000
                    });

                    if (response.data !== 'OK') {
                        LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (add_handle)] Unable to add ArchivesSpace handle');
                        callback(false);
                    } else if (response.data === 'OK') {
                        LOGGER.module().info('INFO: [/ingester/ingest_service_tasks (add_handle)] ArchivesSpace handle added');
                        callback(true);
                    }

                } else {
                    console.log('Skipping aspace handle update');
                }

            })();

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks (add_handle)] unable to add handle to ArchivesSpace record ' + error.message);
        }
    }

    /**
     * Creates .jpg derivatives from .tiff files
     * @param sip_uuid
     * @param mime_type
     * @param compound_parts
     * @param duracloud
     * @param callback
     */
    convert(sip_uuid, mime_type, compound_parts, duracloud, callback) {

        LOGGER.module().info('INFO: [/ingester/service module (create_repo_record)] Generating jpg derivatives');

        const parts = JSON.parse(compound_parts);
        let data_obj = {};
        let data_arr = [];
        data_obj.sip_uuid = sip_uuid;
        data_obj.mime_type = mime_type;

        for (let i = 0; i < parts.length; i++) {
            data_obj.full_path = parts[i].object;
            let tmp = parts[i].object.split('/');
            data_obj.object_name = tmp[tmp.length - 1];
            data_arr.push(data_obj);
        }

        let convert_timer = setInterval(function () {

            if (data_arr.length === 0) {
                clearInterval(convert_timer);
                LOGGER.module().info('INFO: [/ingester/service module (convert)] Conversions completed');
                callback(true);
                return false;
            }

            let data = data_arr.pop();
            LOGGER.module().info('INFO: [/ingester/service module (convert)] Converting ' + data.full_path);
            duracloud.convert_service(data);

        }, 9000);
    }

    /** TODO: deprecate
     * Checks file names in QA service
     * @param folder_name
     */
    async check_file_names(folder_name) {

        try {

            const QA_URL = this.CONFIG.qa_service + QA_ENDPOINT_PATH + 'check-file-names?folder=' + folder_name + '&api_key=' + this.CONFIG.qa_service_api_key;
            const response = await HTTP.get(QA_URL, {
                httpAgent: new KA.Agent({
                    keepAlive: true,
                    maxSockets: 1,
                    keepAliveMsecs: 3000
                }),
                timeout: TIMEOUT,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                return response.data;
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks (check_file_names)] Unable to check file names - ' + error.message);
        }
    }

    /**
     * Deletes completed queue record
     * @param sip_uuid
     */
    async remove_completed_queue_record(sip_uuid) {

        try {

            await this.DB_QUEUE(this.TABLES.repo_queue.repo_ingest_queue)
            .where({
                sip_uuid: sip_uuid
            })
            .delete();

        } catch (error) {
            LOGGER.module().error('ERROR: [/qa/tasks  (dremove_completed_queue_record)] unable to delete queue record ' + error.message);
        }
    }

    /**
     *
     * @param uuid
     */
    async check_ingest_record(uuid) {

        try {

            const index = ES_CONFIG.elasticsearch_back_index;
            const response = await CLIENT.get({
                index: index,
                id: uuid,
            });

            if (response.body.found === true) {
                return response.body._source;
            } else {
                return {
                    message: 'Record Not Found'
                }
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/ingest_service_tasks] unable to check ingested record ' + error.message);
        }
    }

    /** Deprecated Archivematica no longer supports ssh
     * Removes packages from Archivematica SFTP
     * @param uuid
     * @param archival_package
     * @param callback
     */
    async cleanup_sftp(uuid, archival_package, callback) {

        try {

            const QA_URL = `${this.CONFIG.qa_service}${QA_ENDPOINT_PATH}cleanup_sftp?uuid=${uuid}&archival_package=${archival_package}&api_key=${this.CONFIG.qa_service_api_key}`;
            await HTTP.get(QA_URL, {
                timeout: 60000 * 5,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            /* console.log('task sftp cleanup ', response);
            if (response.status === 200) {

                return {
                    data: response.data
                };

            } else {
                return false;
            }

             */

            callback(true);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/tasks (upload_status)] unable to clean up sftp - ' + error.message);
        }
    }
};

module.exports = Ingest_service_tasks;
