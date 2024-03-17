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
const ARCHIVEMATICA_CONFIG = require('../config/archivematica_config')();
const ARCHIVESSPACE_CONFIG = require('../config/archivesspace_config')();
const DURACLOUD_CONFIG = require('../config/duracloud_config')();
const CONVERT_SERVICE_CONFIG = require('../config/webservices_config')();
const VALIDATOR_CONFIG = require('../config/index_records_validator_config')();
const INDEX_RECORD = require('../libs/index_record_lib');
const INDEX_LIB = new INDEX_RECORD(VALIDATOR_CONFIG);
const HANDLES = require('../libs/handles');
const HANDLES_LIB = new HANDLES();
const ARCHIVEMATICA = require('../libs/archivematica');
const ARCHIVEMATICA_LIB = new ARCHIVEMATICA(ARCHIVEMATICA_CONFIG);
const ARCHIVESSPACE = require('../libs/archivesspace');
const ARCHIVEASSPACE_LIB = new ARCHIVESSPACE(ARCHIVESSPACE_CONFIG);
const DURACLOUD = require('../libs/duracloud');
const DURACLOUD_LIB = new DURACLOUD(DURACLOUD_CONFIG, CONVERT_SERVICE_CONFIG);
const DB = require('../config/db_config')();
const DB_QUEUE = require('../config/dbqueue_config')();
const DB_TABLES = require('../config/db_tables_config')();
const QA_SERVICE_TASKS = require('../ingester/tasks/qa_service_tasks');
const INGEST_SERVICE_TASKS = require('../ingester/tasks/ingest_service_tasks');
const INGEST_TASKS = new INGEST_SERVICE_TASKS(WEB_SERVICES_CONFIG, DB, DB_QUEUE, DB_TABLES);
const QA_TASKS = new QA_SERVICE_TASKS(WEB_SERVICES_CONFIG);
const HELPER_TASKS = require('../libs/helper');
const HELPER = new HELPER_TASKS();
const LOGGER = require('../libs/log4');

/**
 * Runs QA and Repository ingest processes
 * @type {Ingest_service}
 */
const Ingest_service = class {

    constructor() {
        this.batch = 'PENDING';
        this.collection_uuid = 0;
        this.archival_package = 'PENDING';
        this.metadata_uri = 'PENDING';
        this.metadata = 'PENDING';
    }

    /**
     * Checks ingest queue
     */
    async get_status() {

        try {

            const data = await INGEST_TASKS.get_status();
            let status = 200;

            if (data === false) {
                status = 404;
            }

            return {
                status: status,
                data: data
            };

        } catch(error) {
            LOGGER.module().error('ERROR: [/ingester/service (get_status)] Unable to get status - ' + error.message);
        }
    }

    /**
     * Gets ingest packages
     */
    async get_collection_packages() {

        try {

            const response = await QA_TASKS.get_collection_packages();

            if (response !== false) {
                return {
                    status: 200,
                    data: response
                };
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (get_ingest_packages)] request to QA service failed - ' + error.message);
        }
    }

    /**
     * Queues archival packages
     * @param batch
     */
    async queue_packages(batch) {

        try {

            this.batch = batch;
            const item_package_names = await QA_TASKS.get_item_packages(batch);
            let packages = [];

            for (let i = 0; i < item_package_names.packages.length; i++) {
                let obj = {}
                obj.batch = batch;
                obj.package = item_package_names.packages[i];
                packages.push(obj);
            }

            const result = await INGEST_TASKS.queue_packages(packages);

            if (result === false) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to queue packages',
                    is_complete: 1
                });

                return false;
            }

            await this.start_qa(batch);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (queue_packages)] Unable to queue packages - ' + error.message);
            return false;
        }
    }

    /**
     * Checks if collection exists in the repository
     * @param batch
     */
    async check_collection(batch) {

        try {

            // check if collection exists in repository
            // parse uri out of batch name
            let tmp = batch.split('-');
            let resource_uri = tmp[tmp.length - 1];
            const uri = '/repositories/2/' + resource_uri.replace('_', '/')
            const collection = await INGEST_TASKS.check_collection(uri);

            if (collection.exists === false) {

                LOGGER.module().info('INFO: [/ingester/service module (check_collection)] Collection does not exist');

                const collection = await INGEST_TASKS.create_collection(HELPER, HANDLES_LIB, ARCHIVEASSPACE_LIB, INDEX_LIB, uri);

                if (collection === false) {

                    LOGGER.module().error('ERROR: [/ingester/service module (check_collection)] Ingest halted');

                    await INGEST_TASKS.update_ingest_queue({
                        batch: batch,
                        is_complete: 0
                    }, {
                        status: 'INGEST_HALTED',
                        error: 'Unable to create collection',
                        is_complete: 1
                    });

                    return false;

                } else {

                    await INGEST_TASKS.update_ingest_queue({
                        batch: batch,
                        is_complete: 0
                    }, {
                        collection_uuid: collection
                    });
                }

            } else if (collection.exists === true) {

                LOGGER.module().info('INFO: [/ingester/service module (check_collection)] Collection exists');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    collection_uuid: collection.uuid
                });
            }

            let folder_set = await QA_TASKS.set_folder_name(batch);

            if (folder_set.is_set === false) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to set collection',
                    is_complete: 1
                });

                return false;
            }

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] collection folder set');

            let folder_name_checked = await QA_TASKS.check_folder_name(batch);

            if (folder_name_checked.folder_name_results.errors.length > 0) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to check collection folder name',
                    is_complete: 1
                });

                return false;
            }

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] ' + folder_name_checked.folder_name_results.result);
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (check_collection)] Unable to check collection - ' + error.message);
            return false;
        }
    }

    /**
     * Checks packages
     * @param batch
     */
    async check_package_names(batch) {

        try {

            let package_names_checked = await QA_TASKS.check_package_names(batch);

            if (package_names_checked.package_name_results.errors.length > 0) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST HALTED',
                    error: 'Unable to check package names',
                    is_complete: 1
                });

                return false;
            }

            LOGGER.module().info('INFO: [/ingester/service module (check_package_names)] Package names checked');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (check_package_names)] Unable to check packages - ' + error.message);
            return false;
        }
    }

    /**
     * Checks uri txt files
     * @param batch
     */
    async check_uri_txt(batch) {

        try {

            let uri_txts_checked = await QA_TASKS.check_uri_txt(batch);

            if (uri_txts_checked.uri_results.errors.length > 0) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST HALTED',
                    error: 'Unable to check uri txt files',
                    is_complete: 1
                });

                return false;
            }

            LOGGER.module().info('INFO: [/ingester/service module (check_uri_txt)] ' + uri_txts_checked.uri_results.result);
            return true

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service (check_uri_txt)] Unable to check uri txt - ' + error.message);
            return false;
        }

    }

    /**
     * Gets total batch size
     * @param batch
     * @param archival_package
     */
    async get_batch_size(batch, archival_package) {

        try {

            let batch_size = await QA_TASKS.get_total_batch_size(batch);

            if (batch_size.total_batch_size.errors.length > 0) {

                LOGGER.module().error('ERROR: [/ingester/service module (get_batch_size)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST HALTED',
                    error: 'Unable to get total batch size',
                    is_complete: 1
                });

                return false;
            }

            let batch_size_results = HELPER.format_bytes(batch_size.total_batch_size.result);

            if (batch_size_results.size_type === 'GB' && batch_size_results.batch_size > 500) {

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST HALTED',
                    error: 'Batch is too large', // 'Package must be under 250GB'
                    is_complete: 1
                });

                return false;
            }

            // TODO: check package size

            await INGEST_TASKS.update_ingest_queue({
                batch: batch,
                package: archival_package,
                is_complete: 0
            }, {
                batch_size: batch_size_results.batch_size + batch_size_results.size_type
            });

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] batch size calculated');
            return true;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (get_batch_size)] Unable to get batch size ' + error.message);
            return false;
        }
    }

    /**
     * Starts package QA processes
     * @param batch
     */
    async start_qa(batch) {

        if (await this.check_collection(batch) === false) {
            return false;
        }

        if (await this.check_package_names(batch) === false) {
            return false;
        }

        if (await this.check_uri_txt(batch) === false) {
            return false;
        }

        await this.process_package(batch);
    }

    /**
     * Starts QA and ingest process
     * @param batch
     * @return {Promise<void>}
     */
    async process_package(batch) {

        try {

            let archival_package = await INGEST_TASKS.get_package(batch);

            if (archival_package === false) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to get archival package',
                    is_complete: 1
                });

                return false;
            }

            await INGEST_TASKS.update_ingest_queue({
                batch: batch,
                package: archival_package.package,
                is_complete: 0
            }, {
                status: 'PROCESSING'
            });

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Processing archival package');

            if (await this.get_batch_size(batch, archival_package.package) === false) {
                return false;
            }

            let package_file_count = await QA_TASKS.get_package_file_count(batch, archival_package.package);

            if (typeof package_file_count !== 'object') {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to get package file count',
                    is_complete: 1
                });

                return false;
            }

            await INGEST_TASKS.update_ingest_queue({
                batch: batch,
                package: archival_package.package,
                is_complete: 0
            }, {
                file_count: package_file_count.file_count
            });

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Archival package file count calculated');

            let metadata_uri = await INGEST_TASKS.get_metadata_uri(batch, archival_package.package);

            if (metadata_uri.uri_results.errors.length > 0) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to get metadata uri',
                    is_complete: 1
                });

                return false;
            }

            this.metadata_uri = metadata_uri.uri_results.result.toString();

            await INGEST_TASKS.update_ingest_queue({
                batch: batch,
                package: archival_package.package,
                is_complete: 0
            }, {
                metadata_uri: metadata_uri.uri_results.result.toString(),
                status: 'METADATA_URI_SAVED',
            });

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Metadata URI retrieved - ' + metadata_uri.uri_results.result.toString());

            let is_moved_to_ingest = await QA_TASKS.move_to_ingest(archival_package.collection_uuid, batch, archival_package.package);

            if (is_moved_to_ingest.errors.length > 0 || is_moved_to_ingest === false) {

                LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted - unable to move to ingest folder');

                await INGEST_TASKS.update_ingest_queue({
                    batch: batch,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Unable to move package to ingest folder',
                    is_complete: 1
                });

                return false;
            }

            LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Package moved to ingest folder');

            QA_TASKS.move_to_sftp(archival_package.collection_uuid, () => {
                LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Uploading package');
            });

            await INGEST_TASKS.update_ingest_queue({
                batch: batch,
                package: archival_package.package,
                is_complete: 0
            }, {
                status: 'UPLOADING'
            });

            LOGGER.module().info('INFO: [/ingester/service module (sftp_upload_status)] Uploading package');

            let upload_timer = setInterval(async () => {

                let upload_status = await QA_TASKS.sftp_upload_status(archival_package.collection_uuid, package_file_count.file_count);

                if (upload_status.data.message === 'upload_complete') {

                    clearInterval(upload_timer);

                    await INGEST_TASKS.update_ingest_queue({
                        batch: batch,
                        package: archival_package.package,
                        is_complete: 0
                    }, {
                        status: 'UPLOAD_COMPLETE'
                    });

                    LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Package upload complete');

                    setTimeout(() => {
                        this.start_ingest(archival_package.collection_uuid, archival_package.package);
                        return true;
                    }, 3000);
                }

            }, 10000); // 10 sec

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Ingest halted ' + error.message);
        }
    }

    /**
     * Starts ingest process
     * @param collection_uuid
     * @param archival_package
     */
    start_ingest(collection_uuid, archival_package) {

        try {

            (async () => {

                LOGGER.module().info('INFO: [/ingester/service module (start_ingest)] Starting ingest');
                await this.start_transfer(collection_uuid, archival_package);

            })();

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (start_ingest)] Unable to Start ingest ' + error.message);
        }
    }

    /**
     * Starts transfer
     * @param collection_uuid
     * @param archival_package
     * @return transfer_folder
     */
    async start_transfer(collection_uuid, archival_package) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (start_transfer)] Starting Archivematica transfer');

            this.collection_uuid = collection_uuid;
            this.archival_package = archival_package;
            await INGEST_TASKS.update_ingest_queue({
                package: archival_package,
                is_complete: 0
            }, {
                status: 'TRANSFER_STARTED'
            });

            let init_transfer_response = await ARCHIVEMATICA_LIB.start_transfer(collection_uuid, archival_package);

            if (init_transfer_response.message !== 'Copy successful.') {

                await INGEST_TASKS.update_ingest_queue({
                    package: archival_package,
                    is_complete: 0
                }, {
                    status: 'INGEST_HALTED',
                    error: 'Package transfer failed.',
                    is_complete: 1
                });

                return false;
            }

            // Construct transfer folder from successful transfer
            let path = init_transfer_response.path;
            let pathArr = path.split('/');

            let arr = pathArr.filter(function (result) {
                if (result.length !== 0) {
                    return result;
                }
            });

            // Used to approve transfer
            const transfer_folder = arr.pop();

            await INGEST_TASKS.update_ingest_queue({
                package: archival_package,
                is_complete: 0
            }, {
                transfer_folder: transfer_folder,
                status: 'TRANSFER_IN_PROGRESS',
            });

            this.approve_transfer(transfer_folder);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (start_transfer)] Unable to Start Archivematica transfer');
        }
    }

    /**
     * Approves transfer
     * @param transfer_folder
     * @return approval
     */
    approve_transfer(transfer_folder) {

        try {

            let approve_transfer_timer = setInterval(async () => {

                let list = await ARCHIVEMATICA_LIB.get_unapproved_transfer_list();

                if (list.results.length > 0) {

                    clearInterval(approve_transfer_timer);

                    let is_transfer_available = false;

                    for (let i = 0; i < list.results.length; i++) {

                        if (transfer_folder === list.results[i].directory) {
                            is_transfer_available = true;
                            break;
                        }
                    }

                    if (is_transfer_available === true) {

                        let transfer_approval_response = await ARCHIVEMATICA_LIB.approve_transfer(transfer_folder);

                        if (transfer_approval_response.message === 'Approval successful.') {

                            LOGGER.module().info('INFO: [/ingester/service module (approve_transfer)] Archivematica transfer approved');

                            await INGEST_TASKS.update_ingest_queue({
                                transfer_folder: transfer_folder,
                                is_complete: 0
                            }, {
                                status: 'TRANSFER_APPROVED',
                                transfer_uuid: transfer_approval_response.uuid
                            });

                            this.get_transfer_status(transfer_approval_response.uuid);
                        }
                    }
                }

            }, 1000);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (approve_transfer)] Unable to approve Archivematica transfer ' + error.message);
        }
    }

    /**
     * Gets transfer status
     * @param transfer_uuid
     */
    get_transfer_status(transfer_uuid) {

        try {

            let transfer_status_timer = setInterval(async () => {

                let transfer = await ARCHIVEMATICA_LIB.get_transfer_status(transfer_uuid);

                if (transfer.status === 'COMPLETE' && transfer.sip_uuid !== undefined) {

                    clearInterval(transfer_status_timer);
                    LOGGER.module().info('INFO: [/ingester/service module (get_transfer_status)] Archivematica transfer complete');
                    await ARCHIVEMATICA_LIB.clear_transfer(transfer_uuid);
                    await INGEST_TASKS.update_ingest_queue({
                        transfer_uuid: transfer_uuid,
                        is_complete: 0
                    }, {
                        status: 'TRANSFER_COMPLETE',
                        micro_service: transfer.micro_service,
                        sip_uuid: transfer.sip_uuid
                    });

                    this.get_ingest_status(transfer.sip_uuid);

                    return false;
                }

                LOGGER.module().info('INFO: [/ingester/service module (get_transfer_status)] Archivematica transfer status - ' + transfer.status);

                await INGEST_TASKS.update_ingest_queue({
                    transfer_uuid: transfer_uuid,
                    is_complete: 0
                }, {
                    status: transfer.status,
                    micro_service: transfer.microservice
                });

            }, 5000);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (confirm_approval)] Unable to check Archivematica transfer status ' + error.message);
        }
    }

    /**
     * Gets ingest status
     * @param sip_uuid
     */
    get_ingest_status(sip_uuid) {

        try {

            setTimeout(async () => {
                await INGEST_TASKS.move_to_ingested(this.collection_uuid);
            }, 50);

            let ingest_status_timer = setInterval(async () => {

                let ingest = await ARCHIVEMATICA_LIB.get_ingest_status(sip_uuid);

                if (ingest.status === 'FAILED') {

                    LOGGER.module().error('ERROR: [/ingester/service module (get_ingest_status)] Archivematica ingest failed');

                    await INGEST_TASKS.update_ingest_queue({
                        sip_uuid: sip_uuid,
                        is_complete: 1
                    }, {
                        status: ingest.status,
                        micro_service: ingest.microservice
                    });

                    return false;
                }

                if (ingest.status === 'COMPLETE') {

                    clearInterval(ingest_status_timer);
                    LOGGER.module().info('INFO: [/ingester/service module (get_ingest_status)] Archivematica ingest complete');
                    await ARCHIVEMATICA_LIB.clear_ingest(sip_uuid);
                    await this.process_metadata(sip_uuid);
                    return false;
                }

                LOGGER.module().info('INFO: [/ingester/service module (get_ingest_status)] Archivematica ingest status - ' + ingest.status);

                await INGEST_TASKS.update_ingest_queue({
                    sip_uuid: sip_uuid,
                    is_complete: 0
                }, {
                    status: ingest.status,
                    micro_service: ingest.microservice
                });

            }, 5000);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (confirm_approval)] Unable to check Archivematica ingest status ' + error.message);
        }
    }

    /**
     * Process Metadata
     * @param sip_uuid
     */
    async process_metadata(sip_uuid) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (process_metadata)] Processing Metadata');

            await INGEST_TASKS.update_ingest_queue({
                sip_uuid: sip_uuid,
                is_complete: 0
            }, {
                status: 'PROCESSING_METADATA',
                micro_service: '',
            });

            this.metadata = await INGEST_TASKS.process_metadata(ARCHIVEASSPACE_LIB, this.metadata_uri);
            await INGEST_TASKS.update_ingest_queue({
                sip_uuid: sip_uuid,
                is_complete: 0
            }, {
                status: 'METADATA_PROCESSED'
            });

            setTimeout(async () => {
                await this.import_object_data(sip_uuid);
            }, 5000);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (process_metadata)] Unable to process metadata ' + error.message);
        }
    }

    /**
     * Gets object data from DuraCloud
     * @param sip_uuid
     */
    async import_object_data(sip_uuid) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (import_object_data)] Importing object data');

            await INGEST_TASKS.update_ingest_queue({
                sip_uuid: sip_uuid,
                is_complete: 0
            }, {
                status: 'IMPORTING_OBJECT_DATA'
            });

            let dip_path = await this.get_dip_path(sip_uuid);
            let file_data = await this.process_mets_xml(sip_uuid, dip_path);

            await INGEST_TASKS.update_ingest_queue({
                sip_uuid: sip_uuid,
                is_complete: 0
            }, {
                status: 'PROCESSING_OBJECT_DATA',
                file_data: JSON.stringify(file_data)
            });

            await this.create_object_parts(sip_uuid, file_data);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (import_object_data)] Unable to import object data ' + error.message);
        }
    }

    /**
     * Gets dip path
     * @param sip_uuid
     */
    async get_dip_path(sip_uuid) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (get_dip_path)] Getting DIP path');

            let dip_path = await ARCHIVEMATICA_LIB.get_dip_path(sip_uuid);

            await INGEST_TASKS.update_ingest_queue({
                sip_uuid: sip_uuid,
                is_complete: 0
            }, {
                dip_path: dip_path,
                status: 'DIP_PATH_SAVED'
            });

            return dip_path;

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (import_object_data)] Unable to get DIP path ' + error.message);
        }
    }

    /**
     * Get dip METS file
     * @param sip_uuid
     * @param dip_path
     */
    async process_mets_xml(sip_uuid, dip_path) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (process_mets_xml)] Processing METS XML');
            const mets = await DURACLOUD_LIB.get_mets(sip_uuid, dip_path);
            return HELPER.process_mets_xml(sip_uuid, dip_path, mets);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (process_mets_xml)] Unable to process METS XML ' + error.message);
        }
    }

    /**
     * Constructs object paths for the metadata record
     * @param sip_uuid
     * @param file_data
     */
    async create_object_parts(sip_uuid, file_data) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (create_object_parts)] Creating object parts');
            let parts = this.metadata.parts;

            for (let i = 0; i < file_data.length; i++) {
                for (let j = 0; j < parts.length; j++) {
                    if (parts[j].title === file_data[i].file) {
                        parts[j].object = file_data[i].dip_path + '/objects/' + file_data[i].uuid + '-' + file_data[i].file;
                        parts[j].thumbnail = file_data[i].dip_path + '/thumbnails/' + file_data[i].uuid + '.jpg';
                    }
                }
            }

            await INGEST_TASKS.update_ingest_queue({
                sip_uuid: sip_uuid,
                is_complete: 0
            }, {
                status: 'CONSTRUCTED_OBJECT_PATHS',
                object_parts: JSON.stringify(parts)
            });

            await this.get_master_object_data(sip_uuid, file_data, parts);

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (create_object_parts)] Unable to create object parts ' + error.message);
        }
    }

    /**
     * Gets master object data
     * @param sip_uuid
     * @param file_data
     * @param parts
     */
    async get_master_object_data(sip_uuid, file_data, parts) {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (get_master_object_data)] Getting master object data');
            let master_object_data = {};
            let file_name;
            let type;

            // get record one
            for (let j = 0; j < parts.length; j++) {
                if (parts[j].order === '1') {
                    file_name = parts[j].title;
                    type = parts[j].type;
                    break;
                }
            }

            for (let i = 0; i < file_data.length; i++) {
                if (file_data[i].file === file_name) {
                    master_object_data.uuid = file_data[i].uuid;
                    master_object_data.file = file_data[i].file;
                    master_object_data.dip_path = file_data[i].dip_path;
                    master_object_data.file_name = file_data[i].dip_path + '/objects/' + file_data[i].uuid + '-' + file_data[i].file;
                    master_object_data.thumbnail = file_data[i].dip_path + '/thumbnails/' + file_data[i].uuid + '.jpg';
                    master_object_data.mime_type = type;
                    break;
                }
            }

            let manifest = await DURACLOUD_LIB.get_object_manifest(master_object_data.uuid, master_object_data.dip_path, master_object_data.file);

            if (manifest === false) {

                let object_info = await DURACLOUD_LIB.get_object_info(master_object_data.uuid, master_object_data.dip_path, master_object_data.file);

                master_object_data.checksum = object_info.headers['content-md5'];
                master_object_data.file_size = object_info.headers['content-length'];

                await INGEST_TASKS.update_ingest_queue({
                    sip_uuid: sip_uuid,
                    is_complete: 0
                }, {
                    status: 'MASTER_OBJECT_DATA_SAVED',
                    master_data: JSON.stringify(master_object_data)
                });

            } else { // Objects over 1GB have a manifest because they are "chunked" by DuraCloud

                let manifest_data = HELPER.process_manifest(manifest);

                if (manifest.length > 0) {
                    master_object_data.checksum = manifest_data[0].checksum;
                    master_object_data.file_size = manifest_data[0].file_size;
                }

                master_object_data.file_name = master_object_data.file_name + '.dura-manifest';

                await INGEST_TASKS.update_ingest_queue({
                    sip_uuid: sip_uuid,
                    is_complete: 0
                }, {
                    status: 'MASTER_OBJECT_DATA_SAVED',
                    master_data: JSON.stringify(master_object_data)
                });
            }

            await this.get_transcript();

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (get_master_object_data)] Unable to get master object data ' + error.message);
        }
    }

    /**
     * Gets transcript if one is available
     */
    async get_transcript() {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (get_transcript)] checking for transcript data');

            await INGEST_TASKS.update_ingest_queue({
                package: this.archival_package,
                is_complete: 0
            }, {
                status: 'CHECKING_FOR_TRANSCRIPT_DATA'
            });

            let data = await INGEST_TASKS.get_transcript(this.metadata);
            let transcript_data = JSON.stringify(data);

            await INGEST_TASKS.update_ingest_queue({
                package: this.archival_package,
                is_complete: 0
            }, {
                status: 'TRANSCRIPT_CHECKED',
                transcript_data: transcript_data
            });

            await this.create_repo_record();

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (get_transcript)] Unable to get transcript ' + error.message);
        }
    }

    /**
     * Creates repository record
     */
    async create_repo_record() {

        try {

            LOGGER.module().info('INFO: [/ingester/service module (create_repo_record)] Creating repository record');

            await INGEST_TASKS.update_ingest_queue({
                package: this.archival_package,
                is_complete: 0
            }, {
                status: 'CREATING_REPOSITORY_RECORD'
            });

            let record = {};
            let transcript_data;
            const data = await INGEST_TASKS.get_queue_data(this.archival_package);
            const handle = await HANDLES_LIB.create_handle(data[0].sip_uuid);
            let tmp = data[0].metadata_uri.split('/');
            const aspace_id = tmp[tmp.length - 1];

            INGEST_TASKS.add_handle(handle, aspace_id, (response) => {
                if (response === false) {
                    LOGGER.module().error('ERROR: [/ingester/service module (create_repo_record)] Unable to add ArchivesSpace handle');
                }
            });

            const master_data = JSON.parse(data[0].master_data);
            transcript_data = JSON.parse(data[0].transcript_data);

            if (transcript_data !== false) {
                record.transcript = transcript_data.transcript;
                record.transcript_search = transcript_data.transcript_search;
                record.has_transcript = 1;
            } else {
                record.transcript = null;
                record.transcript_search = null;
            }

            let metadata = JSON.parse(data[0].metadata);

            if (metadata.is_compound === true) {
                record.is_compound = 1;
            } else {
                record.is_compound = 0;
            }

            record.object_type = 'object';
            record.compound_parts = data[0].object_parts;
            record.is_member_of_collection = data[0].collection_uuid;
            record.pid = data[0].sip_uuid; // pid - legacy
            record.handle = handle;
            record.mods = data[0].metadata;
            record.thumbnail = master_data.thumbnail;
            record.file_name = master_data.file_name;
            record.uri = data[0].metadata_uri;
            record.mime_type = master_data.mime_type;
            record.checksum = master_data.checksum;
            record.file_size = master_data.file_size;
            record.sip_uuid = data[0].sip_uuid;
            record.is_published = 0;

            let index_record = INDEX_LIB.create_index_record(record);
            record.display_record = JSON.stringify(index_record);
            record.mods_id = aspace_id;

            await INGEST_TASKS.save_repo_record(record);

            await INGEST_TASKS.update_ingest_queue({
                package: this.archival_package,
                is_complete: 0
            }, {
                index_record: JSON.stringify(index_record),
                status: 'REPOSITORY_RECORD_CREATED'
            });

            await INGEST_TASKS.index_repo_record(record.pid, record.display_record);

            await INGEST_TASKS.update_ingest_queue({
                package: this.archival_package,
                is_complete: 0
            }, {
                index_record: JSON.stringify(index_record),
                status: 'REPOSITORY_RECORD_INDEXED'
            });

            if (record.mime_type === 'image/tiff') {
                INGEST_TASKS.convert(record.pid, record.mime_type, record.compound_parts, DURACLOUD_LIB, () => {
                    LOGGER.module().info('INFO: [/ingester/service module (create_repo_record)] jpg derivatives created');
                });
            }

            await INGEST_TASKS.update_ingest_queue({
                package: this.archival_package,
                is_complete: 0
            }, {
                status: 'COMPLETE',
                is_complete: 1
            });

            await this.next();

        } catch (error) {
            LOGGER.module().error('ERROR: [/ingester/service module (create_repo_record)] Unable to create repository record ' + error.message);
        }
    }

    async next() {

        const data = await INGEST_TASKS.get_package(this.batch);

        if (data !== undefined) {
            LOGGER.module().info('INFO: [/ingester/service module (next)] Retrieving next package from ' + this.batch);
            await this.process_package(this.batch);
        } else {
            LOGGER.module().info('INFO: [/ingester/service module (next)] ' + this.batch + ' batch is complete');
        }
    }
}

module.exports = Ingest_service;
