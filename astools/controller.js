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

const MODEL = require('../astools/model');
const SERVICE = require('../astools/service');

exports.workspace = function (req, res) {

    try {

        SERVICE.get_workspace_packages((response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.processed = function (req, res) {

    try {

        SERVICE.get_processed_packages((response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.make_digital_objects = function (req, res) {

    try {

        if (Object.keys(req.body).length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        // data is sent to astools script
        const args = {
            folder: req.body.batch,
            packages: req.body.packages,
            files: req.body.files,
            is_kaltura: req.body.is_kaltura
        }

        let is_kaltura = 0;

        if (req.body.is_kaltura === 'true') {
            is_kaltura = 1;
        }

        // data used to create job record
        const job = {
            uuid: req.body.uuid,
            job_type: 'make_digital_objects',
            batch_name: req.body.batch,
            packages: JSON.stringify(req.body.packages),
            is_kaltura: is_kaltura,
            log: '---',
            error: '---'
        };

        (async function() {
            await MODEL.create_job(job);
        })();

        SERVICE.make_digital_objects(args, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.check_uri_txt = function (req, res) {

    try {

        const batch = req.body.batch;

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.check_uri_txt(batch, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.get_packages = function (req, res) {

    try {

        const batch = req.body.batch;

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.get_packages(batch, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.check_metadata = function (req, res) {

    try {

        const batch = req.body.batch;
        const ingest_package = req.body.ingest_package;
        const job_uuid = req.body.uuid;

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        // TODO: change to await
        /*
        (async function() {

            let response = await SERVICE.check_metadata(batch, ingest_package);
            console.log(response);
            return false;
            const result = await check_metadata_parts(batch, ingest_package, job_uuid, response);

            if (result !== true) {
                response.errors = result;
                console.log('metadata check result ', result);
            }

            console.log('error prop? ', response);
            res.status(200).send({
                data: response
            });

        })();
        */

        SERVICE.check_metadata(batch, ingest_package, (response) => {

            (async function() {

                const result = await check_metadata_parts(batch, ingest_package, job_uuid, response);

                if (result !== true) {
                    response.errors = result;
                }

                res.status(200).send({
                    data: response
                });

            })();
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

async function check_metadata_parts(batch, ingest_package, job_uuid, metadata) {

    try {

        const job = await MODEL.get_job(job_uuid);
        let packages = JSON.parse(job[0].packages);
        let package_files;
        let part_files = [];
        let errors = [];

        for (let i = 0; i < metadata.parts.length; i++) {
            console.log(metadata.parts[i].title);
            part_files.push(metadata.parts[i].title);
        }

        if (packages.length > 0) {

            for (let i = 0; i < packages.length; i++) {

                package_files = packages[i].files.sort();

                /* TODO: test
                if (packages[i].files.length > 0) {
                    for (let j = 0; j < packages[i].files.length; j++) {
                        console.log('package files ', packages[i].files[j]);
                    }
                }
                 */
            }
        }

        const packagef = package_files.concat().sort();
        const partf = part_files.concat().sort();

        for (let i = 0; i < packagef.length; i++) {
            if (packagef[i] !== partf[i]) {
                console.log('FAIL');
                errors.push('Package files do not match ArchivesSpace record.');
                return false;
            } else {
                console.log('PASS');
            }
        }

        // check for entry ids if kaltura packages
        if (job[0].is_kaltura === 1) {

            for (let i = 0; i < metadata.parts.length; i++) {
                console.log(metadata.parts[i].kaltura_id);
                console.log(metadata.parts[i].title);
                if (metadata.parts[i].kaltura_id === undefined || metadata.parts[i].kaltura_id.length === 0) {
                    console.log(metadata.parts[i].title);
                    console.log('missing kaltura id');
                }

            }
        }

        if (errors.length > 0) {
            return JSON.stringify(errors);
        } else {
            return true;
        }

    } catch (error) {
        console.log(error);
    }

}

exports.get_job = async function (req, res) {

    try {

        const job_uuid = req.query.uuid;
        const response = await MODEL.get_job(job_uuid);

        res.status(200).send({
            data: response
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

exports.update_job = async function (req, res) {

    try {

        const job = req.body;
        const response = await MODEL.update_job(job);

        res.status(200).send({
            data: response
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};
