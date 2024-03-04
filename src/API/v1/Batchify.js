/**
	
	Project Focus

		Batch request processing API

*/

const express = require('express');
const router = express.Router();
const urlParser = require('url');
const request = require('request');

/**
 * @typedef {object} BatchRequestNode
 * @property {string} method - Request's HTTP method
 * @property {string} path - API path
 * @property {string} body - Request body
 */

/**
 * @typedef {object} BatchResponseNode
 * * @property {string} method - Request's HTTP method
 * @property {string} path - API path
 * @property {Map<string, string>} headers - HTTP headers
 * @property {string} responseBody - Response body
 * @property {("success"|"error")} status - Request status
 * @property {string} [error] - Error message if status is error.
 */

const httpMethods = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

router.post('/process', async (req, res) => {
	try {
		// Resolve protocol, host, and port (consider proxy settings)
		const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
		const host = (req.headers['x-forwarded-host'] || req.headers.host.replace(/:[0-9]+/, ''))?.split(',')[0];
		let port = (req.headers['x-forwarded-port'] || (req.headers.host.match(/:([0-9]+)/) || [])[1]).split(',')[0] || '';

		// Clear port number if using defaults
		port = (protocol === 'https' && port === '443') || (protocol === 'http' && port === '80') ? '' : port;

		// Add port number if present
		const baseUrl = `${protocol}://${host}${port !== '' ? `:${port}` : ''}`;

		/** @type {BatchRequestNode[]} */
		let requests = req.body;

		if (!Array.isArray(requests)) {
			res.statusCode = 400;
			res.end(
				JSON.stringify({
					status: "error",
					error: "invalidJson"
				})
			);
			return;
		}

		// Execute requests in series if set, otherwise parallel
		const responses = await Promise.all(requests.map(async (item) => {
			let path = urlParser.parse(item.path).path;
			let url = urlParser.resolve(baseUrl, path);

			let reqParams = {
				uri: path,
				baseUrl: baseUrl,
				method: httpMethods.includes(item.method.toUpperCase()) ? item.method : 'GET',
				headers: req.headers,
				timeout: 15000, // 15 seconds
			};
			if (reqParams.method !== 'GET') {
				reqParams.body = JSON.stringify(item.body) || "{}";
			}
			// this is required, you must do this, trust me.
			// if you don't it breaks the express json parser
			reqParams.headers['content-type'] = 'text/plain';

			/** @type {BatchResponseNode} **/
			let response = {
				method: reqParams.method,
				path: path,

			}

			try {
				// Execute request
				await new Promise((resolve, reject) => {
					request(path, reqParams, (err, result, body) => {
						if (result) {
							response.code = result.statusCode;
							response.headers = result.headers;
						} else {
							response.code = 500;
							response.headers = new Map();
						}

						if (err) {
							response.status = "error";
							response.error = err.message;
						} else {
							response.responseBody = body;
							response.status = "success";
						}
						resolve();
					});
				});

				return response;
			} catch (e) {
				Focus.webLog.error(`Error processing batch request ${reqParams.url}: ${e.message}`);
				response.code = 500;
				response.status = "error";
				response.error = "genericError";
			}

			return response;
		}));

		res.status(200).json(responses);
	} catch (error) {
		Focus.webLog.error(`Error processing batch requestes! Error: ${error.message}`);
		res.status(500).send(
			JSON.stringify({
				status: "error",
				error: "genericError",
				errorMessage: "Unknown error occurred processing the batch request."
			})
		);
	}
});


module.exports = router;