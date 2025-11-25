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

const KALTURA_CONFIG = require('../config/kaltura_config')();
const kaltura = require('kaltura-client');
const LOGGER = require("../libs/log4");
const config = new kaltura.Configuration();
const client = new kaltura.Client(config);
const DB_QUEUE = require('../config/dbqueue_config')();
const XML_PARSER = require('xml2js');

exports.get_ks_session = function (callback) {

    try {

        const secret = KALTURA_CONFIG.kaltura_secret_key;
        const userId = KALTURA_CONFIG.kaltura_user_id;
        const type = kaltura.enums.SessionType.USER;
        const partnerId = KALTURA_CONFIG.kaltura_partner_id;
        const expiry = 86400;
        const privileges = kaltura.enums.SessionType.ADMIN;

        kaltura.services.session.start(secret, userId, type, partnerId, expiry, privileges)
            .execute(client)
            .then(result => {
                callback(result);
            });

    } catch (error) {
        callback(error);
    }
};

exports.get_ks_metadata = async function (identifier, session) { // , callback

    try {

        client.setKs(session);
        const searchParams = new kaltura.objects.ESearchEntryParams();
        searchParams.orderBy = new kaltura.objects.ESearchOrderBy();
        searchParams.searchOperator = new kaltura.objects.ESearchEntryOperator();
        searchParams.searchOperator.searchItems = [];
        searchParams.searchOperator.searchItems[0] = new kaltura.objects.ESearchUnifiedItem();
        searchParams.searchOperator.searchItems[0].itemType = kaltura.enums.ESearchItemType.EXACT_MATCH;
        // searchParams.searchOperator.searchItems[0].fieldName = kaltura.enums.ESearchEntryFieldName.NAME;
        searchParams.searchOperator.searchItems[0].searchTerm = identifier;
        searchParams.aggregations = new kaltura.objects.ESearchAggregation();
        const pager = new kaltura.objects.Pager();

        return await kaltura.services.eSearch.searchEntry(searchParams, pager)
            .execute(client);

    } catch (error) {
        console.log(error);
        // callback(error);
    }
};

////////////////////////////////

exports.process_metadata = function (metadata, callback) {
    console.log(metadata);
    callback(metadata);
};

function get_public_video_data(identifier, session, callback) {

    client.setKs(session);
    let filter = new kaltura.objects.MetadataFilter();
    filter.objectIdEqual = identifier;
    filter.metadataProfileIdEqual = 10473112;
    let pager = new kaltura.objects.FilterPager();

    kaltura.services.metadata.listAction(filter, pager)
        .execute(client)
        .then(result => {
            callback(result);
        });
}

function get_video_search_data(identifier, session, callback) {

    client.setKs(session);
    const searchParams = new kaltura.objects.ESearchEntryParams();
    searchParams.orderBy = new kaltura.objects.ESearchOrderBy();
    searchParams.searchOperator = new kaltura.objects.ESearchEntryOperator();
    searchParams.searchOperator.searchItems = [];
    searchParams.searchOperator.searchItems[0] = new kaltura.objects.ESearchUnifiedItem();
    searchParams.searchOperator.searchItems[0].itemType = kaltura.enums.ESearchItemType.EXACT_MATCH;
    searchParams.searchOperator.searchItems[0].searchTerm = identifier;
    searchParams.aggregations = new kaltura.objects.ESearchAggregation();
    const pager = new kaltura.objects.Pager();

    kaltura.services.eSearch.searchEntry(searchParams, pager)
        .execute(client)
        .then(result => {
            callback(result);
        }).catch(error => {
        callback(error);
    });
}

function get_file_format(identifier, session, callback) {

    client.setKs(session);
    let filter = new kaltura.objects.AssetFilter();
    filter.entryIdEqual = identifier;
    let pager = new kaltura.objects.FilterPager();

    kaltura.services.flavorAsset.listAction(filter, pager)
        .execute(client)
        .then(result => {
            callback(result);
        }).catch(error => {
        callback(error);
    });
}

async function get_entry_id() {

    try {

        const data = await DB_QUEUE('tbl_exports')
            .select('entry_id')
            .where({
                is_processed: 0
            })
            .limit(1);

        if (data.length > 0) {
            return data[0].entry_id;
        } else {
            return false;
        }

    } catch (error) {
        LOGGER.module().error('ERROR: [/kaltura/service (get_entry_id)] unable to get entry id ' + error.message);
    }
}

async function process_public_video_data(entry_id, data) {

    if (data.objects[0] === undefined) {

        let obj = {};
        obj.reference_id = 'N/A';
        obj.original_filename = 'N/A';
        await update_record(entry_id, obj);
        return false;
    }

    let xml = data.objects[0].xml.toString();
    const parser = new XML_PARSER.Parser(/* options */);
    parser.parseStringPromise(xml).then(function (json) {

        let obj = {};
        let reference_id = json.metadata.ReferenceID;
        let original_filename = json.metadata.OriginalFileName;

        if (reference_id === undefined || reference_id === null) {
            obj.reference_id = 'N/A';
        } else {
            obj.reference_id = reference_id.toString();
        }

        if (original_filename === undefined || original_filename === null) {
            obj.original_filename = 'N/A';
        } else {
            obj.original_filename = original_filename.toString();
        }

        (async function () {
            await update_record(entry_id, obj);
        })();

    }).catch(function (error) {
        LOGGER.module().error('ERROR: [/kaltura/service (process_public_video_data)] unable to process public video ' + error.message);
    });
}

async function process_video_search_data(entry_id, data) {

    if (data.objects[0] === undefined) {

        let obj = {};
        obj.description = 'N/A';
        obj.tags = 'N/A';
        await update_record(entry_id, obj);
        return false;
    }

    let user_id = data.objects[0].object.userId;
    let creator_id = data.objects[0].object.creatorId;
    let description = data.objects[0].object.description;
    let tags = data.objects[0].object.tags;
    let obj = {};

    if (user_id !== undefined || user_id !== null) {
        obj.user_id = user_id;
    } else {
        obj.user_id = 'N/A';
    }

    if (creator_id !== undefined || creator_id !== null) {
        obj.creator_id = creator_id;
    } else {
        obj.creator_id = 'N/A';
    }

    if (description !== undefined || description !== null) {
        obj.description = description;
    } else {
        obj.description = 'N/A';
    }

    if (tags !== undefined || tags !== null) {
        obj.tags = tags;
    } else {
        obj.tags = 'N/A';
    }

    await update_record(entry_id, obj);
}

async function process_file_format(entry_id, data) {

    console.log(`Processing entry id ${entry_id}`);

    if (data.objects.length > 0) {

        for (let i = 0; i < data.objects.length; i++) {
            if (data.objects[i].tags.indexOf('source') !== -1) {

                let obj = {
                    file_format: `${data.objects[i].containerFormat}`,
                    file_extension: `${data.objects[i].fileExt}`
                };

                await update_record(entry_id, obj);
                break;
            }
        }

    } else {
        console.log('no format');
    }
}

function get_categories(category_id, session, callback) {

    console.log('Processing category_id', category_id);

    client.setKs(session);
    kaltura.services.category.get(category_id)
        .execute(client)
        .then(result => {
           callback(result);
        }).catch(error => {
        callback(error);
    });
}

// TODO
async function process_category_entries(identifier, data, session) {

    try {

        let category_ids = [];

        if (data.objects.length > 0) {

            console.log('multiple category_ids', data.objects.length);

            for (let i = 0; i < data.objects.length; i++) {
                category_ids.push(data.objects[0].categoryId);
            }

            return category_ids;

        } else if (data.objects.length === 1) {
            category_ids.push(data.objects[0].categoryId);
        }

        return category_ids;

    } catch (error) {
        LOGGER.module().error('ERROR: [/kaltura/service (update_record)] unable to process category entries ' + error.message);
    }
}

function get_category_entries(entry_id, session, callback) {

    client.setKs(session);
    let filter = new kaltura.objects.CategoryEntryFilter();
    filter.entryIdEqual = entry_id;
    let pager = new kaltura.objects.FilterPager();

    kaltura.services.categoryEntry.listAction(filter, pager)
        .execute(client)
        .then(result => {
            callback(result);
        }).catch(error => {
        callback(error);
    });
}

async function update_record(entry_id, data) {

    try {

        await DB_QUEUE('tbl_exports')
            .where({
                entry_id: entry_id
            })
            .update(data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/kaltura/service (update_record)] unable to update export record ' + error.message);
    }
}

async function flag_record(entry_id) {

    try {

        await DB_QUEUE('tbl_exports')
            .where({
                entry_id: entry_id
            })
            .update({
                is_processed: 1
            });

    } catch (error) {
        LOGGER.module().error('ERROR: [/kaltura/service (complete_record)] unable to complete record ' + error.message);
    }
}

exports.export_data = function (session) {

    try {

        // TODO: get entry id from database
        // TODO: get xml for reference id and original file name
        // TODO: parse xml values and update database record with values by entry id
        // TODO: get tags and description via search api
        // TODO: update database record by entry id

        (async function () {

            let timer = setInterval(async function () {

                let identifier = await get_entry_id();

                console.log(`Processing ${identifier} ....`);

                if (identifier === false) {
                    clearInterval(timer);
                    return false;
                }

                get_public_video_data(identifier, session, async (data) => {
                    await process_public_video_data(identifier, data);
                });

                get_video_search_data(identifier, session, async (data) => {
                    await process_video_search_data(identifier, data);
                });

                get_file_format(identifier, session, async (data) => {
                    await process_file_format(identifier, data, session);
                });

                get_category_entries(identifier, session, async (data) => {

                    let category_ids = await process_category_entries(identifier, data, session);

                    if (category_ids.length === 1) {

                        let category_id = category_ids.pop();
                        get_categories(category_id, session, async (data) => {
                            console.log(`Processing ${identifier} ...`);
                            console.log('SINGLE CATEGORY ', data.name);

                            if (data.name !== 'InContext') {
                                let obj = {
                                    category: data.name,
                                };

                                await update_record(identifier, obj);
                            }
                        });

                    } else if (category_ids.length > 1) {

                        console.log('MULTIPLE CATEGORIES ', category_ids);

                        let categories = [];
                        let category_timer = setInterval(async () => {

                            if (category_ids.length === 0) {

                                clearInterval(category_timer);
                                console.log('Category entries complete.');
                                console.log(identifier);
                                console.log(categories);

                                if (categories.length > 0) {

                                    let obj = {
                                        category: categories.toString(),
                                    };

                                    await update_record(identifier, obj);
                                }

                                return false;
                            }

                            let category_id = category_ids.pop();

                            get_categories(category_id, session, async (data) => {
                                console.log(`Processing ${identifier} ...`);
                                console.log('CATEGORY ', data.name);

                                if (data.name !== 'InContext') {
                                    categories.push(data.name);
                                }
                            });

                        }, 500);
                    }
                });

                await flag_record(identifier);

            }, 1000);

        })();

    } catch (error) {
        LOGGER.module().error('ERROR: [/kaltura/service (export_data)] unable to export data ' + error.message);
    }
}