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

const SERVICE = require('../kaltura/service');
const DB_QUEUE = require('../config/dbqueue_config')();
const DB_TABLES = require('../config/db_tables_config')();
const KALTURA_TASKS = require('../astools/tasks/kaltra_package_tasks');
const KALTURA_TASK = new KALTURA_TASKS(DB_QUEUE, DB_TABLES);

exports.get_ks_session = function (req, res) {

    try {

        const api_key = req.query.api_key;

        if (api_key === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.get_ks_session((session) => {
            res.status(200).send({
                ks: session
            });
        });

    } catch (error) {
        res.status(500).send({message: `Unable to get session token. ${error.message}`});
    }
};

exports.get_ks_metadata = function (req, res) {

    try {

        const session = req.query.session;
        const data = req.body

        if (session === undefined || session.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        process_metadata(data, session, (data) => {

            if (data.length === 0) {

                res.status(404).send({
                    data: data
                });

                return false;
            }

            res.status(200).send({
                data: data
            });
        });

        return false;

    } catch (error) {
        res.status(500).send({message: `Unable to get metadata. ${error.message}`});
    }
};

function process_metadata(data, session, callback) {

    let updated_archival_packages = [];
    let archival_packages = data.packages;

    // serialize files
    for (let i = 0; i < archival_packages.length; i++) {
        updated_archival_packages.push({
            files: JSON.stringify(archival_packages[i].files),
            package: archival_packages[i].package
        });
    }

    // save to DB queue
    (async () => {

        await KALTURA_TASK.queue_kaltura_packages(updated_archival_packages);

        let package_timer = setInterval(async () => {

            let kaltura_package_data = await KALTURA_TASK.get_kaltura_package();

            if (kaltura_package_data.length === 0) {
                clearInterval(package_timer);
                console.log('package processing complete');
                return false;
            }

            // process files
            let kaltura_package = kaltura_package_data.pop();
            let files = JSON.parse(kaltura_package.files);
            await KALTURA_TASK.update_queue_status(kaltura_package.package);

            let files_timer = setInterval(async () => {

                if (files.length === 0) {
                    clearInterval(files_timer);
                    console.log('files processing complete');
                    return false;
                }

                let pairs = [];
                let file = files.pop();
                let term = file.slice(0, -4);
                let file_response;
                let term_response;

                file_response = await SERVICE.get_ks_metadata(file, session);

                if (file_response.totalCount === 0) {

                    term_response = await SERVICE.get_ks_metadata(term, session);

                    if (term_response.totalCount === 0) {

                        pairs.push({
                            package: kaltura_package.package,
                            file: file,
                            entry_id: '0_0',
                            status: 0,
                            message: '- file does not have an Entry ID - Please check Kaltura record for all required fields.'
                        });

                        await KALTURA_TASK.save_kaltura_ids(pairs);

                    } else {
                        pairs = get_entry_ids(term_response, file, kaltura_package.package);
                        await KALTURA_TASK.save_kaltura_ids(pairs);
                    }

                } else {
                    pairs = get_entry_ids(file_response, file, kaltura_package.package);
                    await KALTURA_TASK.save_kaltura_ids(pairs);
                }

            }, 500)

        }, 2000);

    })();

    callback({
        status: 200,
        message: 'Getting entry ids'
    });
    return false;
}

function get_entry_ids(metadata, file, package_name) {

    let pairs = [];

    if (metadata.totalCount > 1) {

        let entry_ids = [];

        for (let i = 0; i < metadata.objects.length; i++) {
            entry_ids.push(metadata.objects[i].object.id);
        }

        pairs.push({
            package: package_name,
            file: file,
            entry_id: JSON.stringify(entry_ids),
            status: 2,
            message: '- file has more than 1 Entry ID - Please check Kaltura record(s)'
        });

    } else if (metadata.totalCount === 1) {

        pairs.push({
            package: package_name,
            file: file,
            entry_id: metadata.objects[0].object.id,
            status: 1,
            message: 'success'
        });

    }

    return pairs;
}

exports.check_ks_queue = async function (req, res) {

    try {

       let response = await KALTURA_TASK.check_queue_status();
       res.status(200).send({
            data: response
        });

    } catch (error) {
        res.status(500).send({message: `Unable to check ks queue. ${error.message}`});
    }
};

exports.get_ks_entry_ids = async function (req, res) {

    try {

        let response = await KALTURA_TASK.get_ks_entry_ids();
        res.status(200).send({
            data: response
        });

    } catch (error) {
        res.status(500).send({message: `Unable to get ks entry ids. ${error.message}`});
    }
};

exports.clear_ks_queue = async function (req, res) {

    try {

        await KALTURA_TASK.clear_ks_queue();
        res.status(204).send({
            data: 'cleared'
        });

    } catch (error) {
        res.status(500).send({message: `Unable to clear ks queue ${error.message}`});
    }
};

///////////////////////////////////////////////////////////////////////

exports.export_data = function (req, res) {

    try {

        const session = req.query.session;
        const identifier = req.query.identifier;

        if (session === undefined || session.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        /*
        const api_key = req.query.api_key;

        if (api_key === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }
         */

        /*

        Description - search api
        tags - search api

        PublicVideoData -> reference id
        PublicVideoData -> Originalfilename

        publishing schedule (scheduling) - always - date and times
        source file format - flavors - AssetID
        Category
        Users
        */

        SERVICE.export_data(session,() => {});

        res.status(200).send({
            message: 'Exporting data'
        });

    } catch (error) {
        res.status(500).send({message: `Unable to export data. ${error.message}`});
    }
}
