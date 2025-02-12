/**

 Copyright 2024 University of Denver

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

const LOGGER = require('../libs/log4');
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const HTTP = require('axios');

/**
 * Starts AIP migration process
 * @param callback
 */
exports.migrate_aips = function (callback) {

    try {

        get_aip_locations();

        return callback({
            status: 200,
            message: 'Migration started.'
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/migration/tasks (migrate_aips)] Unable to start migration ' + error.message);
    }
};

/**
 * Migrate aip-store
 * @param callback
 */
exports.migrate_aip_store = function (callback) {

    try {

        get_aip_stores()

        return callback({
            status: 200,
            message: 'AIP store migration started.'
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/migration/tasks (migrate_aips)] Unable to start migration ' + error.message);
    }
};

/**
 * Gets AIP locations
 */
function get_aip_locations() {

    (async function () {

        const uuids = await get_uuids();
        let migration_timer = setInterval(async () => {

            try {

                if (uuids.length === 0) {
                    console.log('migration complete.');
                    clearInterval(migration_timer);
                    return false;
                }

                let record = uuids.pop();
                console.log('Migrating record ' + record.pid);
                const service_host = 'http://localhost:8187/'
                const migration_service = `${service_host}api/v1/migration-service/aip-location?uuid=${record.pid}&api_key=8dFSweim2RyTQ7RyFo52TlW4l72DLVh0`;
                console.log(migration_service);
                const response = await HTTP.get(migration_service, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 200) {
                    await save_aip_location({
                        uuid: record.pid,
                        aip: response.data.aip
                    });
                }

            } catch (error) {
                LOGGER.module().error('ERROR: [/ingester/model (get_aip_locations)] request to migration service failed - ' + error.message);
            }

        }, 250);

    })();
}

/**
 * Saves AIP locations
 */
async function save_aip_location(data) {

    const result = await DB.transaction((trx) => {
        DB.insert(data)
        .into('tbl_aip_store')
        .transacting(trx)
        .then(trx.commit)
        .catch(trx.rollback);
    });

    console.log(result);
}

/**
 * Gets repository uuid records
 */
async function get_uuids() {

    try {

        return await DB(DB_TABLES.repo.repo_objects)
        .select('pid')
        .where({
            object_type: 'object',
            is_active: 1
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/migration/tasks (get_uuids)] Unable to get uuids ' + error.message);
    }
}

/**
 * Moves AIPs to aip-store
 * @param callback
 */
exports.move_to_aip_store = function (callback) {

    try {

        // get_aip_stores();
        update_aips();

        return callback({
            status: 200,
            message: 'AIP updates started.'
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/migration/tasks (migrate_aips)] Unable to start move to aip store ' + error.message);
    }

};

function update_aips () {

    (async function () {

        const aips = await get_aips();
        let migration_timer = setInterval(async () => {

            try {

                if (aips.length === 0) {
                    console.log('aip store file name updates complete.');
                    clearInterval(migration_timer);
                    return false;
                }

                let record = aips.pop();
                let tmp = record.aip_legacy.split('/');
                let aip = tmp[tmp.length - 1];

                aip = aip.replace('_transfer', '');
                console.log('Updating record ' + aip);

                await update_aip_store(aip, record.aip_legacy);

            } catch (error) {
                LOGGER.module().error('ERROR: [/ingester/model (get_aip_stores)] request to migration service failed - ' + error.message);
            }

        }, 250);

    })();

}

function get_aip_stores() {

    (async function () {

        const aips = await get_aips();
        let migration_timer = setInterval(async () => {

            try {

                if (aips.length === 0) {
                    console.log('aip store migration complete.');
                    clearInterval(migration_timer);
                    return false;
                }

                let record = aips.pop();
                let tmp = record.aip.split('/');
                console.log(tmp[tmp.length - 1]);
                let aip = tmp[tmp.length - 1];

                aip = aip.replace('_transfer', '');
                console.log('Migrating record ' + aip);

                const service_host = 'http://libsftp01-vlp.du.edu:8187/'
                // const migration_service = `${service_host}api/v1/migration-service/aip-store?aip=${record.aip}&api_key=8dFSweim2RyTQ7RyFo52TlW4l72DLVh0`;
                const migration_service = `${service_host}api/v1/storage-service/?aip=${aip}&api_key=8dFSweim2RyTQ7RyFo52TlW4l72DLVh0`;
                const response = await HTTP.post(migration_service, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 201) {
                    console.log(aip + ' updated');
                    await update_aip_store(record.aip);
                }

            } catch (error) {

                LOGGER.module().error('ERROR: [/ingester/model (get_aip_stores)] request to migration service failed - ' + error.message);
                // return false;
                if (error.response.status === 404) {
                    // console.log(error);
                    console.log(error.response.data);

                    (async function () {

                        await DB('tbl_aip_store')
                        .where({
                            aip: error.response.data
                        })
                        .update({
                            message: 'NOT_FOUND',
                            is_migrated: 2
                        });

                    })();
                }

                if (error.response.status === 500) {

                    console.log(error.response.data);

                    (async function () {

                        await DB('tbl_aip_store')
                        .where({
                            aip: error.response.data
                        })
                        .update({
                            message: 'REQUEST_FAILED',
                            is_migrated: 3
                        });

                    })();
                }
            }

        }, 1000*10);

    })();
}

/**
 * Gets AIPs
 */
async function get_aips() {

    try {

        return await DB('tbl_aip_store')
        .select('aip_legacy')
        .where({
            is_migrated: 2
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/migration/tasks (get_aips)] Unable to get aips ' + error.message);
    }
}

/**
 * Updates is migrated flog
 * @param aip
 * @param aip_legacy
 */
async function update_aip_store(aip, aip_legacy) {

    try {

        console.log(aip + ' updated.');
        return await DB('tbl_aip_store')
        .where({
            aip_legacy: aip_legacy
        })
        .update({
            aip: aip
            // is_migrated: 5,
        });

    } catch (error) {
        LOGGER.module().error('ERROR: [/migration/model (update_aip_store)] Unable to update migration status ' + error.message);
    }
}

// java -jar retrievaltool-6.2.0-driver.jar -h archivesdu.duracloud.org -u archivesd-denveru -s dip-store -c . --list-file content-list.txt



// java -jar retrievaltool-{version}-driver.jar -h {your-duracloud-subdomain}.duracloud.org -u {your-username} -p {your-password} -s {name-of-the-space-where-the-file-is-stored} -c {name-of-local-directory-to-place-content} --list-file content-list.txt
// java -jar retrievaltool-6.2.0-driver.jar -h archivesdu.duracloud.org -u archivesd-denveru -p archProc20!8 -s dip-store/a4c3/d66d/b63d/444d/a88d/1b1a/666d/c732/737865da-bde1-4c81-a585-1a339ed830ee_D047.02.0001.0004.00001_transfer-8deadda3-0e2d-4bfa-81c8-d1c64921f986/objects/ -c . --list-file 947d592f-4f79-4107-94c9-bb9e144ae34d-D047.02.0001.0004.00001.mp4


// a4c3/d66d/b63d/444d/a88d/1b1a/666d/c732/737865da-bde1-4c81-a585-1a339ed830ee_D047.02.0001.0004.00001_transfer-8deadda3-0e2d-4bfa-81c8-d1c64921f986/objects/947d592f-4f79-4107-94c9-bb9e144ae34d-D047.02.0001.0004.00001.mp4.dura-manifest
// works
// java -jar retrievaltool-6.2.0-driver.jar -h archivesdu.duracloud.org -u archivesd-denveru -s dip-store -c . --list-file 947d592f-4f79-4107-94c9-bb9e144ae34d-D047.02.0001.0004.00001.mp4

// java -jar retrievaltool-6.2.0-driver.jar -h archivesdu.duracloud.org -u archivesd-denveru -s dip-store -c . --list-file 947d592f-4f79-4107-94c9-bb9e144ae34d-D047.02.0001.0004.00001.mp4



// java -jar retrievaltool-{version}-driver.jar -h {your-duracloud-subdomain}.duracloud.org -u {your-username} -p {your-password} -s {name-of-the-space-to-list} -c {name-of-local-directory-to-place-list} --list-only

// java -jar retrievaltool-6.2.0-driver.jar -h archivesdu.duracloud.org -u archivesd-denveru -s dip-store -c . --list-file 947d592f-4f79-4107-94c9-bb9e144ae34d-D047.02.0001.0004.00001.mp4