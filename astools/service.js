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

const HTTP = require('axios');
const CONFIG = require('../config/webservices_config')();
const ARCHIVESSPACE_CONFIG = require('../config/archivesspace_config')();
const ARCHIVESSPACE = require('../libs/archivesspace');
const LOGGER = require('../libs/log4');

// TODO: Deprecate?
/*
exports.get_processed_packages = function (callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'processed?api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.get(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                let batches = [];
                let package_files = [];

                if (response.data.errors.length > 0) {
                    callback(response.data);
                } else {

                    for (let i = 0; i < response.data.result.length; i++) {
                        batches.push(response.data.result[i]);
                    }

                    let timer = setInterval(() => {

                        if (batches.length === 0) {
                            clearInterval(timer);
                            console.log('complete');
                            callback(package_files);
                            return false;
                        }

                        const package_name = batches.pop();

                        get_package_files(package_name, (response) => {

                            if (response.errors.length > 0) {
                                package_files.push(response);
                                return false;
                            }

                            let is_kaltura = [];

                            for (let i = 0; i < response.result.packages.length; i++) {

                                let files = response.result.packages[i].files;

                                if (files.toString().indexOf('.wav') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mp3') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mp4') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mov') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mkv') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.avi') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.m4v') !== -1) {
                                    is_kaltura.push(true);
                                }
                            }

                            if (is_kaltura.length > 0) {
                                response.result.is_kaltura = true;
                            } else {
                                response.result.is_kaltura = false;
                            }

                            package_files.push(response);
                        });

                    }, 500);
                }
            }

        } catch (error) {
            console.error(error);
        }

    })();
};
*/

exports.get_workspace_packages = function (callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'workspace?api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.get(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                let batches = [];
                let package_files = [];

                if (response.data.errors.length > 0) {
                    callback(response.data);
                } else {

                    for (let i = 0; i < response.data.result.length; i++) {
                        batches.push(response.data.result[i]);
                    }

                    let timer = setInterval(() => {

                        if (batches.length === 0) {
                            clearInterval(timer);
                            console.log('complete');
                            callback(package_files);
                            return false;
                        }

                        const package_name = batches.pop();

                        get_package_files(package_name, (response) => {

                            if (response.errors.length > 0) {
                                package_files.push(response);
                                return false;
                            }

                            let is_kaltura = [];

                            for (let i = 0; i < response.result.packages.length; i++) {

                                let files = response.result.packages[i].files;

                                if (files.toString().indexOf('.wav') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mp3') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mp4') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mov') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.mkv') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.avi') !== -1) {
                                    is_kaltura.push(true);
                                }

                                if (files.toString().indexOf('.m4v') !== -1) {
                                    is_kaltura.push(true);
                                }
                            }

                            if (is_kaltura.length > 0) {
                                response.result.is_kaltura = true;
                            } else {
                                response.result.is_kaltura = false;
                            }

                            package_files.push(response);
                        });

                    }, 500);
                }
            }

        } catch (error) {
            console.error(error);
        }

    })();
};

const get_package_files = function (package_name, callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'workspace/packages/files?package_name=' + package_name + '&api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.get(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {

                callback(response.data);
            } else {
                return false;
            }

        } catch (error) {
            console.error(error);
        }

    })();
}

exports.make_digital_objects = function (args, callback) {

    (async function () {

        try {

            const ASTOOLS_URL = CONFIG.astools_service + 'make-digital-objects?api_key=' + CONFIG.astools_service_api_key;
            const response = await HTTP.post(ASTOOLS_URL, {
                headers: {
                    'Content-Type': 'application/json'
                },
                data: args
            });

            if (response.status === 200) {
                callback(response.data);
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (make_digital_objects)] Unable to make digital objects - ' + error.message);
        }

    })();
};

/** TODO: merge with check_uri_txts()
 * Checks uri txt files
 * @param batch
 * @param callback
 */
exports.check_uri_txt = function (batch, callback) {

    (async function () {

        try {

            let uri_txts_checked = await check_uri_txts(batch);

            LOGGER.module().info('INFO: [/astools/service module (check_uri_txt)] ' + uri_txts_checked.uri_results.result);
            callback(uri_txts_checked.uri_results);

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (check_uri_txt)] Unable to check uri txt - ' + error.message);
        }

    })();
};

/**
 * Checks uri.txt in QA service
 * @param folder_name
 */
async function check_uri_txts(folder_name) {

    try {

        const ASTOOLS_URL = CONFIG.astools_service + 'check-uri-txt?folder=' + folder_name + '&api_key=' + CONFIG.astools_service_api_key;
        const response = await HTTP.get(ASTOOLS_URL, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            return response.data;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (check_uri_txts)] Unable to check uri.txt - ' + error.message);
        return false;
    }
}

/**
 * gets list of packages
 * @param batch
 */
exports.get_packages = async function (batch, callback) {

    try {

        const ASTOOLS_URL = CONFIG.astools_service + 'workspace/packages?batch=' + batch + '&api_key=' + CONFIG.astools_service_api_key;
        const response = await HTTP.get(ASTOOLS_URL, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            callback(response.data);
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (get_packages)] Unable to get packages - ' + error.message);
    }
}

exports.check_metadata = async function(batch, archival_package, callback){

    try {

        let data = await get_metadata_uri(batch, archival_package);

        if (data.errors.length > 0) {
            console.log(data.errors);
            callback(data.result);
            return false;
        }

        const metadata = await process_metadata(data.result.toString());
        callback(metadata);
        return false;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (get_packages)] Unable to get packages - ' + error.message);
    }
};

/**
 * Gets metadata
 * @param uri
 */
const process_metadata = async function(uri) {

    try {

        const ARCHIVESSPACE_LIB = new ARCHIVESSPACE(ARCHIVESSPACE_CONFIG);
        let token = await ARCHIVESSPACE_LIB.get_session_token();
        let errors = [];
        let error = null;

        LOGGER.module().info('INFO: [/astools/service (process_metadata)] Checking record ' + uri);

        let record = await ARCHIVESSPACE_LIB.get_record(uri, token);

        if (record === false) {
            record = {
                errors: ['Record not found.']
            };

            return record;
        }

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
            record.metadata.errors = error;
        }

        let result = await ARCHIVESSPACE_LIB.destroy_session_token(token);

        if (result.data.status === 'session_logged_out') {
            LOGGER.module().info('INFO: [/astools/service (process_metadata)] ArchivesSpace session terminated');
        }

        return record.metadata;

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (process_metadata)] Unable to process metadata - ' + error.message);
    }
}

/**
 * Gets metadata uri
 * @param folder_name
 * @param archival_package
 */
const get_metadata_uri = async function(folder_name, archival_package) {

    try {

        const ASTOOLS_URL =  CONFIG.astools_service + 'workspace/uri?folder=' + folder_name + '&package=' + archival_package + '&api_key=' + CONFIG.qa_service_api_key;
        const response = await HTTP.get(ASTOOLS_URL, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            return response.data;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (get_metadata_uri)] Unable to get uri.txt - ' + error.message);
    }
}

/*
async function move_to_ready_folder(folder_name) {

    try {

        const ASTOOLS_URL = CONFIG.astools_service + 'move-to-ready?folder=' + folder_name + '&api_key=' + CONFIG.astools_service_api_key;
        const response = await HTTP.get(ASTOOLS_URL, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            return response.data;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/service (move_to_ready_folder)] Unable to move batch to ready folder - ' + error.message);
        return false;
    }
}

 */

/**
 * Moves batch to ready folder
 * @param batch
 * @param callback
 */
/*
exports.move_to_ready = function (batch, callback) {

    (async function () {

        try {

            let is_moved = await move_to_ready_folder(batch);
            LOGGER.module().info('INFO: [/astools/service module (move_to_ready)] ');
            callback(is_moved);

        } catch (error) {
            LOGGER.module().error('ERROR: [/astools/service (move_to_ready)] Unable to move batch to ready folder - ' + error.message);
        }

    })();
};

 */
