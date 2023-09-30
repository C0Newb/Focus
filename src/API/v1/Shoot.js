/**
	
	Project Focus

		User API

*/

const express = require('express');
const router = express.Router();

const archiver = require("archiver");
const fs = require("node:fs");
const path = require('node:path');
const multer = require('multer');
const uploadDir = path.join(global.dataDirectory, "Uploads");
const upload = multer({
	dest: uploadDir,
	limits: {
		fileSize: 20000000, // 20MB
	},
	fileFilter: (req, file, callback) => {
		var ext = path.extname(file.originalname).toLowerCase();
		if (ext === ".png" || ext === ".webp" || ext === ".jpg" || ext === ".jpeg")
			return callback(null, true);
	
		return callback(new Error("Only images with the extension png, webp, jpg, jpeg."));
	},
});


const randomUUID = require('node:crypto').randomUUID;

let NeptuneCrypto = require("../../NeptuneCrypto.js");
const User = require('../../User.js');
const Shoot = require('../../Shoot.js');


/**
 * Gets the shoot object from the shoot id in the request
 * @param {Request} req - The incoming request
 * @param {Response} res - Outgoing response. If not found, we'll send an error (if doNotSendInvalidError is not true)
 * @param {boolean} [doNotSendInvalidError = false] - Whether we send an error about the shoot not being found.
 * @param {boolean} [returnViewableImages = false] - Whether to return the array of viewable images by user
 * @return {Shoot|string[]} Shoot object, or if `returnViewableImages == true` array of image ids viewable by the user.
 */
function getShootFromRequest(req, res, doNotSendInvalidError, returnViewableImages) {
	let user = Focus.sessionProvider.getRequestUser(req, res, true);
	let username = "*";
	if (user != undefined)
		username = user.username;

	let shootId = (typeof req.body.shootId === "string")? req.body.shootId : undefined;

	if (shootId != undefined) {
		/** @type {Shoot} */
		let shoot = undefined;
		Focus.webLog.debug(`Looking up images for ${shootId}`);
		if (Focus.Shoots.has(shootId)) {
			shoot = Focus.Shoots.get(shootId);
			if (user != undefined && shoot.owner === user.username) {
				if (returnViewableImages)
					return [...shoot.images];

				return shoot;
			}

			Focus.webLog.silly("Found shoot");
			let viewableImages = shoot.getViewableImages(username);
			Focus.webLog.silly(`User can view ${viewableImages.length} images`);
			if (viewableImages.length >= 1) {
				if (returnViewableImages)
					return viewableImages;

				return shoot;
			}
		}
	}

	if (doNotSendInvalidError !== true) {
		// not found, I guess
		res.statusCode = 404;
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidShoot",
				errorMessage: "You must provide a valid shoot id."
			})
		);
	}
	return undefined;
}


router.get('/images/:shootId', (req, res) => {
	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let viewableImages = getShootFromRequest(req, res, false, true);
	if (viewableImages == undefined)
		return;

	res.end(
		JSON.stringify({
			status: "success",
			images: viewableImages
		})
	);
	return;
});


router.get('/name/:shootId', (req, res) => {
	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	res.end(
		JSON.stringify({
			status: "success",
			name: shoot.title
		})
	);
});
router.put('/name/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;
	
	if (shoot.owner !== user.username) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to modify the title of this shoot."
			})
		);
		return;
	}
	
	let shootPacket = {
		name: (typeof req.body.name === "string")? req.body.name : ""
	};

	if (shootPacket.name.length < 1 || shootPacket.name.length > 255) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidName",
				errorMessage: "The provided shoot name must be between 1 and 255 characters long."
			})
		);
		return;
	}

	shoot.title = shootPacket.name;
	shoot.saveSync();

	res.end(
		JSON.stringify({
			status: "success",
			name: shoot.title
		})
	);
});

router.get('/description/:shootId', (req, res) => {
	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	res.end(
		JSON.stringify({
			status: "success",
			description: shoot.description
		})
	);
});
router.put('/description/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;
	
	if (shoot.owner !== user.username) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to modify the description of this shoot."
			})
		);
		return;
	}

	let shootPacket = {
		description: (typeof req.body.description === "string")? req.body.description : ""
	};

	if (shootPacket.description.length > 1000) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidDescription",
				errorMessage: "The provided shoot description cannot be longer than 1000 characters."
			})
		);
		return;
	}

	shoot.description = shootPacket.description;
	shoot.saveSync();

	res.end(
		JSON.stringify({
			status: "success",
			description: shoot.description
		})
	);
});

router.get('/owner/:shootId', (req, res) => {
	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	res.end(
		JSON.stringify({
			status: "success",
			owner: shoot.owner
		})
	);
});


router.get('/cover/:shootId', (req, res) => {
	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	res.end(
		JSON.stringify({
			status: "success",
			imageId: shoot.getCoverImage()
		})
	);
});
router.put('/cover/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;
	
	if (shoot.owner !== user.username) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to modify the cover image of this shoot."
			})
		);
		return;
	}


	let coverImage = (typeof req.body.imageId === "string")? req.body.imageId : ""

	if (coverImage == "" || !shoot.images.includes(coverImage)){
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidCoverImage",
				errorMessage: "The provided cover image id does not exist in this shoot."
			})
		);
		return;
	}

	shoot.setCoverImage(coverImage);

	if (shoot.getCoverImage() == coverImage) {
		res.end(
			JSON.stringify({
				status: "success",
				imageId: shoot.getCoverImage()
			})
		);
	} else {
		res.end(
			JSON.stringify({
				status: "error",
				error: "genericError",
				errorMessage: "Unable to set cover image."
			})
		);
	}
});






router.post('/create', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	let shootPacket = {
		name: (typeof req.body.name === "string")? req.body.name : undefined,
		description: (typeof req.body.description === "string")? req.body.description : undefined,
	};

	let missingFields = [];
	if (shootPacket.name === undefined)
		missingFields.push("name");
	if (shootPacket.description === undefined)
		missingFields.push("description");

	if (missingFields.length > 0) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "missingFields",
				errorMessage: "You are missing a few required fields.",
				fields: missingFields.join(',')
			})
		);
		return;
	}

	if (shootPacket.name.length < 1 || shootPacket.name.length > 255) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidName",
				errorMessage: "The provided shoot name must be between 1 and 255 characters long."
			})
		);
		return;
	}

	if (shootPacket.description.length > 1000) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidDescription",
				errorMessage: "The provided shoot description cannot be longer than 1000 characters."
			})
		);
		return;
	}

	try {
		let newId = randomUUID();
		let shoot = Focus.configurationManager.loadConfig(newId, Shoot);
		shoot.id = newId;
		shoot.title = shootPacket.name;
		shoot.description = shootPacket.description;
		shoot.owner = user.username;
		shoot.save();
		Focus.Shoots.set(newId, shoot);
		Focus.saveShoots(false);
		res.status = 201;
		res.end(
			JSON.stringify({
				status: "success",
				shootId: newId
			})
		);

	} catch (e) {
		let errorMessage = "A generic error has occurred.";

		Focus.webLog.warn(`Unable to create the new shoot ${shootPacket.name} because: `);
		Focus.webLog.error(e);
		res.end(
			JSON.stringify({
				status: "error",
				error: "genericError",
				errorMessage: errorMessage
			})
		);
	}
});


router.delete('/delete/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	// validate code
	let code = (typeof req.body.confirmationCode === "string")? req.body.confirmationCode : "";
	if (!user.verifyConfirmationCode(code)) {
		res.statusCode = 403;
		res.end(
			JSON.stringify({
				status: "error",
				error: "unauthorized",
				errorMessage: "A valid confirmation code is required for this request."
			})
		);
		return;
	}

	if (shoot.owner === user.username) {
		shoot.delete();
		Focus.Shoots.delete(shoot.id);
		Focus.saveShoots(false);
		res.end(
			JSON.stringify({
				status: "success"
			})
		);
	} else {
		res.statusCode = 403;
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not permitted to delete this shoot."
			})
		);
	}
});




router.patch('/permissions/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	if (shoot.owner !== user.username) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to modify the permissions of this shoot."
			})
		);
		return;
	}

	let permissions = (typeof req.body.permissions === "object")? req.body.permissions : {};

	let users = Object.keys(permissions);
	for (let i = 0; i < users.length; i++) {
		let userPermissions = permissions[users[i]];
		if (userPermissions == undefined)
			continue;

		// for all image ids
		let imageIds = Object.keys(userPermissions);
		for (let u = 0; u < imageIds.length; u++) {
			let imageId = imageIds[u];
			let imagePermissions = userPermissions[imageId];
			if (typeof imagePermissions !== "string")
				continue;

			// is this a valid image?
			if (imageId !== "*" && !shoot.images.includes(imageId))
				continue;

			// can we modify that image?
			if (shoot.checkUserCanEditImage(user.username, imageId, true)) {
				if (shoot.permissions[users[i]] == undefined)
					shoot.permissions[users[i]] = {};

				// update this image for this user
				Focus.webLog.debug(`Updating the permissions for user ${users[i]} in the ${shoot.title} shoot for the image ${imageId}`);
				shoot.permissions[users[i]][imageId] = imagePermissions;
			}
		}
	}
	shoot.save();

	res.end(
		JSON.stringify({
			status: "success",
		})
	);
});

router.put('/permissions/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	if (shoot.owner !== user.username) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to modify the permissions of this shoot."
			})
		);
		return;
	}

	let permissions = (typeof req.body.permissions === "object")? req.body.permissions : {};
	shoot.permissions = permissions;
	Focus.webLog.debug(permissions);
	shoot.save();

	res.end(
		JSON.stringify({
			status: "success",
		})
	);
});

router.get('/permissions/:shootId', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.params.shootId === "string")? req.params.shootId : req.body.shootId;
	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	if (shoot.owner !== user.username) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to modify the permissions of this shoot."
			})
		);
		return;
	}

	res.end(
		JSON.stringify({
			status: "success",
			permissions: shoot.permissions
		})
	);
});




// Uploads and downloads
router.get('/download/:shootId/:quality', (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res, true);
	if (!user)
		user = {
			username: "*"
		};

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	req.body.quality = (typeof req.body.quality === "string")? req.body.quality : req.params.quality;

	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;

	let quality = (typeof req.body.quality)? req.body.quality : "high";
	
	let qualityExtension = ".high.webp";
	if (quality === "original")
		qualityExtension = ".original.webp";
	else if (quality === "high")
		qualityExtension = ".high.webp";
	else if (quality === "medium")
		qualityExtension = ".medium.webp";
	else if (quality === "low")
		qualityExtension = ".low.webp";
	else if (quality === "thumbnail")
		qualityExtension = ".thumbnail.webp";


	let imagesPath = shoot.getImagesDirectory();
	let imageFiles = fs.readdirSync(imagesPath).filter(fn => fn.endsWith(qualityExtension));
	Focus.webLog.silly(`Found images: ${imageFiles.join(',')}`)

	let zipParentDirectory = path.join(global.dataDirectory, "Temp");
	if (!fs.existsSync(zipParentDirectory))
		fs.mkdirSync(zipParentDirectory);

	//let zipFilePath = path.join(zipParentDirectory, randomUUID() + '.zip');
	let zipFile = archiver("zip", {
		comment: `${shoot.title}: ${shoot.description}`,
		zlib: {
			level: 5
		}
	})

	let viewableImages = shoot.getViewableImages(user.username);
	Focus.webLog.debug(`Generating zip file for ${user.username} for the shoot ${shoot.id}`);
	for (let i = 0; i < viewableImages.length; i++) {
		let image = viewableImages[i];
		Focus.webLog.silly(`Checking permissions for ${image} (.`);
		if (shoot.checkUserCanDownloadImage(user.username, image)
			&& imageFiles.includes(image + qualityExtension)) {

			let imageFilePath = shoot.getImagePath(image, quality);
			Focus.webLog.silly(`Adding image to zip ${image} @${imageFilePath}`);
			
			let imageName = shoot.getImageName(image);

			zipFile.file(imageFilePath, {
				name: imageName + '.webp',
			});
		}

	}

	res.attachment(`${shoot.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`).type('zip');
	zipFile.pipe(res);
	zipFile.finalize();
});


router.post('/upload/:shootId', upload.array('images', 100), (req, res) => {
	function deleteUploads() {
		for (let i = 0; i < req.files.length; i++) {
			try {
				let uploadPath = req.files[i].path;
				if (fs.existsSync(uploadPath)) {
					fs.unlinkSync(uploadPath);
				}
			} catch {}
		}
	}

	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user) {
		deleteUploads();
		return;
	}

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;

	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot) {
		deleteUploads();
		return;
	}

	if (shoot.owner !== user.username) {
		deleteUploads();
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to upload photos to this shoot."
			})
		);
		return;
	}


	let results = {};
	let allSuccessful = true;
	for (let i = 0; i < req.files.length; i++) {
		let uploadPath = req.files[i].path;
		let originalName = path.parse(req.files[i].originalname).name;
		try {
			Focus.webLog.debug(`Adding image ${originalName} to ${shoot.title}`);
			let imageId = shoot.addImage(uploadPath, originalName);
			results[originalName] = imageId;
		} catch (e) {
			Focus.webLog.debug("Failed to add image");
			Focus.webLog.error(e);
			results[originalName] = false;
			allSuccessful = false;
		}
	}

	shoot.saveSync();
	Focus.webLog.debug(`Added ${req.files.length} images`);
	if (allSuccessful)
		res.statusCode = 201;
	res.end(
		JSON.stringify({
			status: "success",
			results: results
		})
	);
});


// Individual image:
function getImagePathFromRequest(req, res, doNotSendInvalidError) {
	let user = Focus.sessionProvider.getRequestUser(req, res, true);
	if (!user)
		user = {
			username: "*"
		}

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	req.body.imageId = (typeof req.body.imageId === "string")? req.body.imageId : req.params.imageId;
	req.body.quality = (typeof req.body.quality === "string")? req.body.quality : req.params.quality;

	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res, true);
	if (!shoot)
		return;

	let imageId = req.body.imageId;
	if (imageId == undefined || imageId == "" || !shoot.checkUserCanViewImage(user.username, imageId)) {
		Focus.webLog.debug(`User ${user.username} cannot view ${imageId} in ${shoot.id}`);
		if (doNotSendInvalidError !== true) {
			res.status = 404;
			res.end(
				JSON.stringify({
					status: "error",
					error: "invalidImage",
					errorMessage: "The image provided does not exist in this shoot."
				})
			);
		}
		return;
	}

	let quality = (typeof req.body.quality)? req.body.quality : "high";

	if (!shoot.images.includes(imageId))
		return undefined;

	return {
		id: imageId,
		path: shoot.getImagePath(imageId, quality),
		name: shoot.getImageName(imageId),
		canDownload: shoot.checkUserCanDownloadImage(user.username, imageId)
	};
}

router.get('/image/:shootId/:imageId/:quality', (req, res) => {
	try {
		let imageData = getImagePathFromRequest(req, res, true);
		res.setHeader('Content-Type', 'image/webp');
		if (imageData == undefined) {
			res.statusCode = 404;
			res.sendFile(path.join(global.webDirectory, "image-not-found.webp"));
			return;
		}

		fs.exists(imageData.path, (exists) => {
			if (exists) {
				res.setHeader('Content-Type', 'image/webp');
				res.sendFile(imageData.path);
			}
			else {
				Focus.webLog.debug(`Unable to find ${imageData.id} at ${imageData.path}`);
				res.statusCode = 404;
				res.setHeader('Content-Type', 'image/webp');
				res.sendFile(path.join(global.webDirectory, "image-not-found.webp"));
			}
		});
	} catch (e) {
		Focus.webLog.error(e);
		res.statusCode = 500;
		res.setHeader('Content-Type', 'image/webp');
		res.sendFile(path.join(global.webDirectory, "image-load-error.webp"));
		return;
	}
});

router.get('/imageDownload/:shootId/:imageId/:quality', (req, res) => {
	try {
		let imageData = getImagePathFromRequest(req, res, true);
		if (imageData == undefined) {
			res.statusCode = 404;
			// res.end(
			// 	JSON.stringify({
			// 		status: "error",
			// 		error: "invalidImage",
			// 		errorMessage: "That image does not exist."
			// 	})
			// );
			res.end();
			return;
		}


		fs.exists(imageData.path, (exists) => {
			if (exists && imageData.canDownload) {
				Focus.webLog.debug(`Sending image download for "${imageData.name}.webp"`);
				res.setHeader('Content-Type', 'image/webp');
				res.set("Content-Disposition", `attachment; filename="${imageData.name}.webp"`);
				res.sendFile(imageData.path);
			} else {
				res.statusCode = 404;
				// res.end(
				// 	JSON.stringify({
				// 		status: "error",
				// 		error: "invalidImage",
				// 		errorMessage: "That image does not exist."
				// 	})
				// );
				res.end();
				return;
			}
		});
	} catch (e) {
		Focus.webLog.error(e);
		res.statusCode = 500;
		// res.end(
		// 	JSON.stringify({
		// 		status: "error",
		// 		error: "genericError",
		// 		errorMessage: "There was an error while trying to retrieve that image."
		// 	})
		// );
		res.end();
		return;
	}
});

// /imageName/:shootId || /imageName/:shootId/:imageId
function imageName(req, res) {
	let user = Focus.sessionProvider.getRequestUser(req, res, true);
	if (!user)
		user = {
			username: "*"
		}

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;
	
	req.body.imageId = (typeof req.body.imageId === "string")? req.body.imageId : req.params.imageId;

	let imageId = req.body.imageId;
	if (imageId == undefined || imageId == "") {
		// all viewable images
		let imageNames = {};
		shoot.images.forEach((imageId) => {
			if (shoot.checkUserCanViewImage(user.username, imageId)) {
				imageNames[imageId] = shoot.getImageName(imageId);
			}
		});

		res.end(
			JSON.stringify({
				status: "success",
				names: imageNames
			})
		);
		return;
	}

	if (imageId == undefined || imageId == "" || !shoot.checkUserCanViewImage(user.username, imageId)) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to view that image."
			})
		);
		return;
	}

	if (!shoot.images.includes(imageId)) {
		res.status = 404;
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidImage",
				errorMessage: "The image provided does not exist in this shoot."
			})
		);
		return;
	}

	res.end(
		JSON.stringify({
			status: "success",
			name: shoot.getImageName(imageId)
		})
	);		
}

router.get('/imageName/:shootId/:imageId', imageName);
router.get('/imageName/:shootId', imageName);

router.delete('/image/:shootId/:imageId',  (req, res) => {
	let user = Focus.sessionProvider.getRequestUser(req, res);
	if (!user)
		return;

	req.body.shootId = (typeof req.body.shootId === "string")? req.body.shootId : req.params.shootId;
	/** @type {Shoot} */
	let shoot = getShootFromRequest(req, res);
	if (!shoot)
		return;
	
	req.body.imageId = (typeof req.body.imageId === "string")? req.body.imageId : req.params.imageId;

	let imageId = req.body.imageId;
	if (imageId == undefined || imageId == "" || !shoot.checkUserCanEditImage(user.username, imageId)) {
		res.end(
			JSON.stringify({
				status: "error",
				error: "notPermitted",
				errorMessage: "You are not allowed to delete that image."
			})
		);
		return;
	}

	if (!shoot.images.includes(imageId)) {
		res.status = 404;
		res.end(
			JSON.stringify({
				status: "error",
				error: "invalidImage",
				errorMessage: "The image provided does not exist in this shoot."
			})
		);
		return;
	}

	Focus.webLog.debug(`Deleting the image ${imageId}`);
	shoot.deleteImage(imageId);

	res.end(
		JSON.stringify({
			status: "success"
		})
	);		
});

module.exports = router;