# Focus API (v1): Batchify route (/api/v1/batchify/)



---

## Batchify
Route: `/api/v1/batchify/`

### Process
Process a batch of server requests.\
**DOES NOT WORK FOR UPLOADS/DOWNLOADS**\
(well, it might, but it is NOT guaranteed!)\
Endpoint: `./process`

POST: process a batch of API requests.
_Send:_
```json5
[
	{
		"method": "GET",
		"path": "/v1/shoot/cover/534cec36-f90c-4acb-ab36-25119348e3c4",
		"body": ""
	},
	{
		"method": "POST",
		"path": "/v1/user/validateUsername",
		"body": "{ \"username\": \"oliver_the_cat\" }"
	}
]
```

_Receive:_
```json5
[
	{
		"method": "GET",
		"path": "/v1/shoot/cover/534cec36-f90c-4acb-ab36-25119348e3c4",
		"code": 200,
		"headers": {
			"x-powered-by": "Focus",
            "content-type": "application/json",
            "date": "Mon, 04 Mar 2024 00:00:00 GMT",
            "connection": "keep-alive",
            "keep-alive": "timeout=5",
            "content-length": "69"
		}
		"responseBody": "{\"status\":\"success\",\"imageId\":\"adb4349e-4c3c-4b81-a0ef-771f28089b92\"}"
		"status": "success",
	},
	{
		"method": "POST",
		"path": "/v1/user/validateUsername",
		"code": 200,
        "headers": {
            "x-powered-by": "Focus",
            "content-type": "application/json",
            "date": "Mon, 04 Mar 2024 00:00:00 GMT",
            "connection": "keep-alive",
            "keep-alive": "timeout=5",
            "content-length": "39"
        },
		"responseBody": "{ \"status\": \"success\", \"valid\": true }"
		"status": "success",
	}
]
```
Possible errors include:\
`invalidJson`: you did not provide a valid json array for the request body.\
`invalidRequest`: generic error.\
`genericError`: generic error.
