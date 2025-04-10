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

const VALIDATOR = require('validator');
const CONFIG = require('../config/app_config')();
const I_SERVICE = require('../ingester/ingest_service');
const C_SERVICE = require('../ingester/collection_service');
const INGEST_SERVICE = new I_SERVICE();
const COLLECTION_SERVICE = new C_SERVICE();

/**
 *
 * @type {Ingest_controller}
 */
const Ingest_controller = class {

    constructor() {
    }

    /**
     * Gets ingest status
     * @param req
     * @param res
     */
    async get_status(req, res) {
        const data = await INGEST_SERVICE.get_status();
        res.status(data.status).send(data.data);
    }

    /**
     * Gets collection packages
     * @param req
     * @param res
     */
    async get_collection_packages(req, res) {
        const data = await INGEST_SERVICE.get_collection_packages();
        res.status(data.status).send(data.data);
    }

    /**
     * Starts ingest process - QA process starts first
     * @param req
     */
    async start_ingest(req) {
        const batch = req.query.batch;
        await INGEST_SERVICE.queue_packages(batch);
    }

    /**
     * Bypasses automatic upload to archivematica sftp - CLI
     * @param req
     */
    async start_archivematica_ingest(req, res) {
        const batch = req.query.batch;
        await INGEST_SERVICE.ingest_packages(batch);
        res.status(200).send({message: 'ingest started'});
    }

    /**
     * Checks ingest record (indexed record and duracloud storage)
     * @param req
     * @param res
     */
    async check_ingest(req, res) {
        const uuid = req.query.uuid;
        const response = await INGEST_SERVICE.check_ingest(uuid);
        res.status(200).send(response);
    }

    /**
     * Gets repository collections
     * @param req
     * @param res
     */
    async get_collections(req, res) {
        const collections = await COLLECTION_SERVICE.get_collections();
        res.status(200).send(collections);
    }

    /**
     * Creates repository collection
     * @param req
     * @param res
     */
    async create_collection(req, res) {

        if (req.body.collection_uri === undefined || req.body.is_member_of_collection === undefined) {
            res.status(400).send('Bad Request');
            return false;
        }

        const uri = VALIDATOR.unescape(req.body.collection_uri);
        const is_member_of_collection = req.body.is_member_of_collection;
        const uuid = await COLLECTION_SERVICE.create_collection(uri, is_member_of_collection);

        if (typeof uuid === 'object') {
            res.status(200).send({
                message: 'Collection Already Exists'
            });

            return false;
        }

        if (uuid) {
            res.status(201).send({
                uuid: uuid
            });
        } else {
            res.status(200).send({
                message: 'Unable to create collection'
            });
        }
    }

    /**
     * Renders ingest dashboard view
     * @param req
     * @param res
     */
    get_dashboard_ingest_view(req, res) {
        res.render('dashboard-ingest', {
            host: CONFIG.host,
            appname: CONFIG.app_name,
            appversion: CONFIG.app_version,
            organization: CONFIG.organization,
            app_path: CONFIG.app_path
        });
    };

    /**
     * Renders ingest status dashboard view
     * @param req
     * @param res
     */
    get_dashboard_ingest_status_view(req, res) {
        res.render('dashboard-ingest-status', {
            host: CONFIG.host,
            appname: CONFIG.app_name,
            appversion: CONFIG.app_version,
            organization: CONFIG.organization,
            app_path: CONFIG.app_path
        });
    };

    /**
     * Renders collections view
     * @param req
     * @param res
     */
    get_dashboard_collections_view(req, res) {
        res.render('dashboard-collections', {
            host: CONFIG.host,
            appname: CONFIG.app_name,
            appversion: CONFIG.app_version,
            organization: CONFIG.organization,
            app_path: CONFIG.app_path
        });
    };

    /**
     * Redirects to repo completed ingests view
     * @param req
     * @param res
     */
    get_dashboard_ingest_complete(req, res) {
        res.redirect(CONFIG.repo + '/dashboard/import/complete');
    }

    /**
     * Gets objects by resource id and uri
     * @param req
     * @param res
     */
    async get_resources(req, res) {

        if (req.query.resource_id === undefined || req.query.resource_uri === undefined || req.query.collection_uuid === undefined) {
            res.status(400).send('Bad Request');
            return false;
        }

        const resource_id = req.query.resource_id;
        const resource_uri = VALIDATOR.unescape(req.query.resource_uri);
        const collection_uuid = req.query.collection_uuid;
        const tree = await COLLECTION_SERVICE.get_resources(resource_id, resource_uri, collection_uuid);

        res.status(200).send({
            data: tree
        });
    }

    /**
     * Reassign repository records
     * @param req
     * @param res
     */
    async reassign_records(req, res) {

        if (req.query.collection_uuid === undefined) {
            res.status(400).send('Bad Request');
            return false;
        }

        const collection_uuid = req.query.collection_uuid;
        const result = await COLLECTION_SERVICE.reassign_records(collection_uuid);
        console.log(result);

        res.status(200).send({
            data: []
        });
    }
}

module.exports = Ingest_controller;
