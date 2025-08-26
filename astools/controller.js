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
const LOGGER = require('../libs/log4');

exports.workspace = function (req, res) {

    try {

        SERVICE.get_workspace_packages((response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (workspace)] unable to get workspace packages ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

/*
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
*/

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
            job_type: 'ingest',
            batch_name: req.body.batch,
            packages: JSON.stringify(req.body.packages),
            is_kaltura: is_kaltura,
            log: '---',
            error: '---',
            job_run_by: req.body.job_run_by
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
        LOGGER.module().error('ERROR: [/astools/controller (make_digital_objects)] unable to make digital objects ' + error.message);
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
        LOGGER.module().error('ERROR: [/astools/controller (check_uri_txt)] unable to check uri txt ' + error.message);
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
        LOGGER.module().error('ERROR: [/astools/controller (get_packages)] unable to get packages ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.check_metadata = function (req, res) {

    try {

        const batch = req.body.batch;
        const job_uuid = req.body.uuid;
        const ingest_package = req.body.ingest_package;

        if (batch === undefined || job_uuid === undefined || ingest_package === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.check_metadata(batch, ingest_package, (response) => {

            (async function() {

                const result = await check_metadata_parts(batch, ingest_package, job_uuid, response);

                if (result !== true) {
                    response.errors = result;
                } else {
                    response.errors = false;
                }

                res.status(200).send({
                    data: response
                });

            })();
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_metadata)] unable to check metadata ' + error.message);
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

            if (job[0].is_kaltura === 1) {
                if (metadata.parts[i].kaltura_id === undefined) {
                    errors.push(metadata.parts[i].title + ' is missing its kaltura_id');
                }
            }

            part_files.push(metadata.parts[i].title);
        }

        if (packages.length > 0) {

            for (let i = 0; i < packages.length; i++) {
                package_files = packages[i].files.sort();
            }
        }

        const packagef = package_files.concat().sort();
        const partf = part_files.concat().sort();

        for (let i = 0; i < packagef.length; i++) {

            if (packagef[i] !== partf[i]) {
                errors.push('Package files do not match ArchivesSpace record.');
                return false;
            }
        }

        if (errors.length > 0) {
            return JSON.stringify(errors);
        } else {
            return true;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (check_metadata_parts)] unable to check metadata parts ' + error.message);
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
        LOGGER.module().error('ERROR: [/astools/controller (get_job)] unable to get job ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.get_metadata_jobs = async function (req, res) {

    try {

        const response = await MODEL.get_metadata_jobs();

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_metadata_jobs)] unable to get metadata jobs ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};

exports.get_ingest_jobs = async function (req, res) {

    try {

        const response = await MODEL.get_ingest_jobs();

        res.status(200).send({
            data: response
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/astools/controller (get_ingest_jobs)] unable to get ingest jobs ' + error.message);
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
        LOGGER.module().error('ERROR: [/astools/controller (update_job)] unable to get update job ' + error.message);
        res.status(500).send({message: `${error.message}`});
    }
};
