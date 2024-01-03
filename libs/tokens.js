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

const TOKEN_CONFIG = require('../config/token_config')();
const APP_CONFIG = require('../config/app_config')();
const JWT = require('jsonwebtoken');
const LOGGER = require('../libs/log4');
const VALIDATOR = require('validator');

/**
 * Creates session token
 * @param username
 * @returns {*}
 */
exports.create = function (username) {

    let tokenData = {
        sub: username,
        iss: TOKEN_CONFIG.token_issuer
    };

    return JWT.sign(tokenData, TOKEN_CONFIG.token_secret, {
        algorithm: TOKEN_CONFIG.token_algo,
        expiresIn: TOKEN_CONFIG.token_expires
    });
};

/**
 * Verifies api key
 * @param req
 * @param res
 * @param next
 */
exports.verify = (req, res, next) => {

    const key = req.query.api_key;

    if (key !== undefined && key === TOKEN_CONFIG.api_key)  {

        let api_key = key;

        if (Array.isArray(key)) {
            api_key = key.pop();
        }

        if (!VALIDATOR.isAlphanumeric(api_key)) {
            res.redirect(APP_CONFIG.repo + '/login');
            return false;
        }

        req.query.api_key = api_key;
        next();

    } else {
        LOGGER.module().error('ERROR: [/libs/tokens lib (verify)] unable to verify api key');
        res.redirect(APP_CONFIG.repo + '/login');
    }
};
