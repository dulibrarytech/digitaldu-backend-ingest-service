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

const HTTP = require('http');
const EXPRESS = require('express');
const COMPRESS = require('compression');
const BODYPARSER = require('body-parser');
const METHODOVERRIDE = require('method-override');
const HELMET = require('helmet');
const XSS = require('../libs/dom');

module.exports = function () {

    const APP = EXPRESS();
    const SERVER = HTTP.createServer(APP);

    if (process.env.NODE_ENV === 'development') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    } else if (process.env.NODE_ENV === 'production') {
        APP.use(COMPRESS());
    }

    APP.use(BODYPARSER.urlencoded({
        extended: true
    }));
    APP.use(BODYPARSER.json());
    APP.use(METHODOVERRIDE());
    APP.use(HELMET());
    APP.use('/ingester/static', EXPRESS.static('./public'));
    APP.use(XSS.sanitize_req_query);
    APP.use(XSS.sanitize_req_body);
    APP.use(XSS.validate_uuid);
    APP.set('views', './views');
    APP.set('view engine', 'ejs');

    require('../ingester/routes.js')(APP);
    require('../migration/routes.js')(APP);
    require('../astools/routes.js')(APP);
    require('../kaltura/routes.js')(APP);
    SERVER.listen(process.env.APP_PORT);

    return APP;
};