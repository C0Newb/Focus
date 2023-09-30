# Focus API (v1): Shoot route (/api/v1/shoot/)

## Images
Returns the images viewable by the user.\
Endpoint: `./images/:shootId`

GET: redirects you to the `/register` web page.

_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2" // Which shoot to retrieve the images for
}
```

_Receive:_
```json5
{
	"status": "success",
	"images": [
		"--image id--"
	]
}
```
Possible errors include:\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.


## Post shoot
Creates a new shoot for your user. Images are added later.\
Endpoint: `./create`

POST: creates a new shoot using the details provided and the current session data.\
Names can only be up to 255 characters and must contain at least one character.\
Descriptions can only be up to 1000 characters.

_Send:_
```json5
{
	"name": "A day in the park",					// User friendly (viewable) name
	"description": "Went for a walk in the park!",	// Optional description displayed on the shoot
}
```

_Receive:_
```json5
{
	"status": "success",
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2" // New shoot's random id
}
```
Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`missingFields`: you're missing required fields, such as the username and password. (There will be the "fields" property that will list the fields missing.)\
`invalidName`: the new shoot's name is an invalid length.\
`invalidDescription`: the new shoot's description is an invalid length.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## Get name
Quickly retrieve the name of a shoot.\
Endpoint: `./name/:shootId`

POST:\
_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2"
}
```

_Receive:_
```json5
{
	"status": "success",
	"name": "A day in the park"
}
```
Possible errors include:\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.


## Get description
Quickly retrieve the description of a shoot.\
Endpoint: `./description/:shootId`

POST:\
_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2"
}
```

_Receive:_
```json5
{
	"status": "success",
	"description": "Went for a walk in the park!"
}
```
Possible errors include:\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.


## Get owner
Quickly retrieve the owner of a shoot.\
Endpoint: `./owner/:shootId`

POST:\
_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2"
}
```

_Receive:_
```json5
{
	"status": "success",
	"owner": "oliver_the_cat"
}
```
Possible errors include:\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## Delete shoot
Deletes the shoot if you are the owner. Requires a user confirmation code\
Endpoint: `./delete`

DELETE:\
_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2",
	"confirmationCode": ""
}
```

_Receive:_
```json5
{
	"status": "success",
}
```
Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`notPermitted`: user does not have permissions to delete this shoot.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## Update permissions
Updates permissions for one or more images for one or more users.\
Endpoint: `./permissions`

PATCH: updates permissions by adding your changes\
POST: sets the shoot permissions to what you upload\
_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2",
	"permissions": {
		"*": {					// The username of the user (use "*" for everyone)
			"imageId": "f" 		// The id of the image and the permission. Use "*" as the image id to represent all images
		}
	}
}
```

_Receive:_
```json5
{
	"status": "success",
}
```
Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`notPermitted`: user does not have permissions to delete this shoot.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## Download the shoot
Generates and downloads a zip file contain all images the user is permitted to download.\
Endpoint: `./download/:shootId/:quality`

ShootId is the shoot id, and quality is the image quality you wish to download.\
Quality can be "original", "high", "medium", "low", or "thumbnail". The default quality is "high".

If you do not provide the shootId or quality in the URL, you can do so in the request itself like:
GET:\
_Send:_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2",
	"quality": "high"
}
```

_Receive:_
A zip file download

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## Upload
Uploads \
Endpoint: `./upload/:shootId/`

ShootId is the shoot id, and quality is the image quality you wish to download.\

The shoot id is required to be in the URL. To upload images, add them to the "images" key in your form data.
GET:\
_Send:_
```
images: [File]
```

_Receive:_
```json5
{
	"status": "success",
	"results": {
		"Park entrance": "8eaee64c-7a59-493a-8d8c-7e8a0ba976e9",	// Upload succeeded, this is the image's id
		"A leafless fall tree": false 								// Upload failed
	}
}
```

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## View/download image
Gets an image given the shoot id, image id, and quality (defaults to high).\
Endpoint (view): `./image/:shootId/:imageId/:quality`
Endpoint (download): `./imageDownload/:shootId/:imageId/:quality`

ShootId is the shoot id, and quality is the image quality you wish to download.\
Quality can be "original", "high", "medium", "low", or "thumbnail". The default quality is "high".\
Image id is the id of the image you wish to get.

If you do not provide the shootId, imageId or quality in the URL, you can do so in the request itself like:

GET:\
_Send (optional):_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2",
	"quality": "high"
}
```

_Receive:_
The image.

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidImage`: the provided image id is either blank, doesn't exist, or is not accessible by the user.\
`invalidRequest`: generic error.\
`genericError`: generic error.



## Delete image
Deletes an image from a shoot.\
Endpoint: `./image/:shootId/:imageId`

ShootId is the shoot id, and image id is the id of the image you wish to delete.

If you do not provide the shootId, imageId or quality in the URL, you can do so in the request itself like:

DELETE:\
_Send (optional):_
```json5
{
	"shootId": "5c32a692-2cf7-412f-b28d-6cd66848dcd2",
}
```

_Receive:_
```json5
{
	"status": "success"
}
```

Possible errors include:\
`unauthorized`: session is not authorized to access this data. Try re-logging in.\
`invalidUsername`: unknown user account. Was you user account deleted but not the session?\
`invalidShoot`: the provided shoot id is either blank, doesn't exist, or is not accessible by the user.\
`invalidImage`: the provided image id is either blank, doesn't exist, or is not accessible by the user.\
`notPermitted`: user does not have permissions to delete this image.\
`invalidRequest`: generic error.\
`genericError`: generic error.