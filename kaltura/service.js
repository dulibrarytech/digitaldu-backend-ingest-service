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
const config = new kaltura.Configuration();
const client = new kaltura.Client(config);

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

exports.get_ks_metadata = function (identifier, session, callback) {

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
};
