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
}

exports.get_ks_metadata = function (call_number, session, callback) {

    // client.setKs(session);

    const searchParams = new kaltura.objects.ESearchEntryParams();
    searchParams.orderBy = new kaltura.objects.ESearchOrderBy();
    searchParams.searchOperator = new kaltura.objects.ESearchEntryOperator();
    searchParams.searchOperator.searchItems = [];
    searchParams.searchOperator.searchItems[0] = new kaltura.objects.ESearchUnifiedItem();
    searchParams.searchOperator.searchItems[0].itemType = kaltura.enums.ESearchItemType.EXACT_MATCH;
    searchParams.searchOperator.searchItems[0].searchTerm = call_number;
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

/*
{
    "ks": {
        "code": "SERVICE_FORBIDDEN",
        "message": "The access to service [elasticsearch_esearch->searchEntry] is forbidden",
        "objectType": "KalturaAPIException",
        "args": {
            "SERVICE": "elasticsearch_esearch->searchEntry"
        }
    }
}
 */

/*
    let id = 10;

    kaltura.services.metadata.get(id)
        .execute(client)
        .then(result => {
            callback(result);
        });
    */

/*
let filter = new kaltura.objects.MetadataProfileFilter();
let pager = new kaltura.objects.FilterPager();

kaltura.services.metadataProfile.listAction(filter, pager)
    .execute(client)
    .then(result => {
        callback(result);
    });
*/

/*
let metadataProfileId = 10779852;

kaltura.services.metadataProfile.listFields(metadataProfileId)
    .execute(client)
    .then(result => {
        console.log(result);
        callback(result);
    });
*/


/*
let entryId = '1_9eieqig9'; // "0_uy4iovcq"; //'0_p3lcqis6'; // '1_9eieqig9';
let version = -1;

kaltura.services.media.get(entryId, version)
    .execute(client)
    .then(result => {
        callback(result);
    })
    .catch(error => {console.log(error);});
*/

/*
let bulkUploadFilter = new kaltura.objects.BulkUploadFilter();
let pager = new kaltura.objects.FilterPager();

bulkUploadFilter.orderBy = '+createdAt';
pager.pageIndex = 24;
pager.pageSize = 100;

kaltura.services.bulk.listAction(bulkUploadFilter, pager)
    .execute(client)
    .then(result => {
        callback(result);
    })
    .catch(error => {console.log(error);});
*/

/*
let filter = new kaltura.objects.MetadataFilter();
let pager = new kaltura.objects.FilterPager();

filter.objectIdEqual = '0_uy4iovcq';
filter.metadataProfileIdEqual = 10473112;

kaltura.services.metadata.listAction(filter, pager)
    .execute(client)
    .then(result => {
        callback(result);
    }).catch(error => {
        console.log(error);
});

 */

/*
kaltura.services.metadataProfile.get(10473112)
    .execute(client)
    .then(result => {
        callback(result);
    }).catch(error => {
        console.log(error);
});

 */

/*
// "creatorId": "DigitalCollections@du.edu",
// "userId": "SCA-DCS-Owners"
// PublicVideoData
const filter = new kaltura.objects.MediaEntryFilter();
const pager = new kaltura.objects.FilterPager();
// filter.mediaTypeEqual = kaltura.enums.MediaType.VIDEO;
// filter.nameLike = 'Marda';
// filter.createdAtGreaterThanOrEqual = 1561982373;
// filter.createdAtLessThanOrEqual = 1564660773;
// filter.advancedSearch = new kaltura.objects.SearchComparableCondition();
// filter.advancedSearch.comparison = kaltura.enums.SearchConditionComparison.EQUAL;
filter.nameEqual = 'D009.03.0005.00002'; // D009.23.0007.0047.00001 // 1_9eieqig9
// filter.partnerIdEqual = 2357732
// filter.userIdEqual = 'SCA-DCS-Owners';
// filter.creatorIdEqual = 'DigitalCollections@du.edu';
// filter.searchTextMatchAnd = 'Marda Kirn Oral History, 2005-2006'
kaltura.services.media.listAction(filter, pager)
    .execute(client)
    .then(result => {
        callback(result);
    }).catch(error => {
        callback(error);
});

 */