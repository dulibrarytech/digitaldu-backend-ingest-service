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

exports.make_digital_objects = function (req, res) {

    try {

        if (Object.keys(req.body).length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const args = {
            folder: req.body.folder,
            batch_data: req.body.batch_data,
            files: req.body.files,
            is_kaltura: req.body.is_kaltura
        }

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

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.check_metadata(batch, ingest_package, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};


/*
exports.move_to_ready = function (req, res) {

    try {

        const batch = req.body.batch;

        if (batch === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        SERVICE.move_to_ready(batch, (response) => {
            res.status(200).send({
                data: response
            });
        });

    } catch (error) {
        res.status(500).send({message: `${error.message}`});
    }
};

 */
