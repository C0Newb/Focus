/**
	
	Project Focus

		Shoot class file

*/

const ConfigItem = require("./ConfigItem");
const randomUUID = require("node:crypto").randomUUID;

const path = require("node:path");
const fs = require("node:fs");
const sharp = require('sharp'); // image compression

class Shoot extends ConfigItem{
	/**
	 * The id of the shoot (UUID)
	 * @type {string} 
	 */
	id = randomUUID();

	/**
	 * Friendly name of the shoot (album), such as "Oliver the cat!"
	 * @type {string}
	 */
	title;


	/**
	 * Description of the shoot.
	 * @type {string} 
	 */
	description;

	/**
	 * User's username that owns this shoot (full permissions).
	 * @type {string}
	 */
	owner;


	/**
	 * @typedef {Map<string, string> imagePermission
	 * Image name: permission
	 * Permission is as follows:
	 * ```
	 *  -------
	 *  f------: full permissions (everything)
	 *  -d-----: download permissions (download the shoot, requires view)
	 *  --v----: view permissions (view the shoot)
	 *  ---r---: remove permissions (remove an image from the shoot)
	 *  ----s--: share permissions (set permissions for others)
	 *  -----e-: edit the image (name/description)
	 * ```
	 */

	/**
	 * User permissions for the shoot.
	 * @type {Map<string, imagePermission>}
	 */
	permissions;

	/**
	 * List of image ids contained in this shoot
	 * @type {string[]}
	 */
	images;

	/**
	 * The main image to display as the cover for this shoot
	 * @type {string}
	 */
	coverImage;


	/**
	 * A map of image ids to the image friendly name
	 * @type {Map<string, string>}
	 */
	imageNames = new Map();


	constructor(configurationManager, fileName) {
		super(configurationManager, fileName);
		this.loadSync();
	}

	/**
	 * Returns the main image id of this shoot
	 * @return {string}
	 */
	getCoverImage() {
		if (this.coverImage === undefined
			|| typeof this.coverImage !== "string"
			|| !this.images.includes(this.coverImage))
			return this.images[0];
		else
			return this.coverImage;
	}

	setCoverImage(imageId) {
		if (!this.images.includes(imageId)) {
			throw new Error("Image id is not in shoot");
		} else {
			this.coverImage = imageId;
			this.saveSync();
		}
	}


	/**
	 * Gets the permission string for an image for a user.
	 * This combines both the "everyone", "every image", and specific permissions together.
	 * The permission ranking goes:
	 * 	1) User's image permission
	 * 	2) User's every image permission
	 * 	3) Everyone's image permission
	 * 	4) Everyone's every image permission
	 * 
	 * This means, the user's permission for an image (if set) overrides the permissions set by a lower rank. 
	 * 
	 * @param {string} username - User to lookup
	 * @param {string} imageId - The image to lookup permissions for
	 * @return {string} Permission string  for that image
	 */
	getUserPermission(username, imageId) {
		let permission = "";

		if (this.permissions["*"] !== undefined) { // the everyone permissions
			if (this.permissions["*"]["*"] !== undefined) // applies to all images
				permission = this.permissions["*"]["*"];

			if (this.permissions["*"][imageId] !== undefined)
				permission = this.permissions["*"][imageId];
		}

		if (this.permissions[username] !== undefined) { // user's permissions
			if (this.permissions[username]["*"] !== undefined) // applies to all images
				permission = this.permissions[username]["*"];

			if (this.permissions[username][imageId] !== undefined)
				permission = this.permissions[username][imageId];
		}

		return permission;
	}

	/**
	 * Returns a map of image ids. Important note, if an image id is not present they do not have access to it.
	 * @param {string} username - The user to lookup permissions for
	 * @return {Map<string, string>} Mapping of the image id/name to their permissions.
	 */
	getUserPermissions(username) {
		let images = {};

		if (this.owner === username) {
			// easy
			let images = {
				"*": "f"
			};

			this.images.forEach((imageId) => {
				images[imageId] = "f";
			});
			return images;
		}

		this.images.forEach((imageId) => {
			let permission = this.getUserPermission(username, imageId);
			if (permission != undefined && permission != "" && permission !== "b") {
				images[imageId] = permission;
			}
		});
		return images;
	}


	/**
	 * @typedef {object} imagePermissionObj
	 * Not to be confused with imagePermission (sorry), this is the object containing the permissions translated from a string.
	 * @property {boolean} full
	 */


	/**
	 * Checks whether a user has the particular set of permissions or not.
	 * Use `/[f]/g` for full permissions, `/[ds]/g` for download and share, etc.
	 * Where you do `/` followed by the permission code and `/g`.
	 * @param {string} username - User to check for
	 * @param {string|string[]} imageId - The image/images to check for
	 * @param {RegExp} regMatch - Regular expression to use for checking the permissions.
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|Map<string, bool>} Either a yes/no, or a yes/no mapped to the image id.
	 */
	checkUserHasImagePermission(username, imageId, regMatch, allMustMatch) {
		allMustMatch = allMustMatch !== false;

		if (typeof username !== "string")
			throw new TypeError("username expected string got " + (typeof username).toString());
		if (typeof imageId !== "string")
			throw new TypeError("imageId expected string got " + (typeof imageId).toString());
		if (!(regMatch instanceof RegExp))
			throw new TypeError("regMatch expected instance of RegExp, got type " + (typeof RegExp).toString());

		if (Array.isArray(imageId)) {
			let result = {};
			imageId.forEach((singleImageId) => {
				result[singleImageId] = this.checkUserHasImagePermission(username, singleImageId, regMatch);
			});
			return result;
		}

		// single image
		if (this.owner === username)
			return true; // clearly

		if (this.permissions === undefined)
			return false; // who knows really

		let me = this; // ugh
		function checkAll(user) { // yeah, I don't like functions in functions either but :shrug:
			try {
				if (imageId === "*") { // go through each image and check manually
					let match = false;
					if (allMustMatch)
						match = true

					if (me.permissions[user] == undefined)
						return false;

					let images = Object.keys(me.permissions[user]);
					// filter out unknown images
					images = images.filter(x => me.images.includes(x) || x == "*");

					if (allMustMatch) { // this is here so we're not checking in the for loop
						// match cannot be false.
						for (let i = 0; i < images.length; i++) {
							match = me.permissions[user][images[i]].match(regMatch) != undefined;
							if (!match)
								break; // one does not match
						}
					} else {
						// match must become true
						for (let i = 0; i < images.length; i++) {
							match = me.permissions[user][images[i]].match(regMatch) != undefined;
							if (match)
								break; // one *does* match
						}
					}

					return match;
				}
			} catch (e) {
				Focus.log.error(e);
			}
		}

		if (imageId !== "*") {
			// get permission
			let permission = this.getUserPermission(username, imageId);
			return permission.match(regMatch) != undefined;
		} else {
			// check all images
			let allow = true;
			if (this.permissions["*"] !== undefined)
				allow = checkAll("*");

			if (allow && this.permissions[username] !== undefined)
				allow = checkAll(username);

			return allow;
		}

		// let allow = false;
		// if (this.permissions["*"] !== undefined) { // the everyone permissions
		// 	if (this.permissions["*"]["*"] !== undefined) // applies to all images
		// 		allow = this.permissions["*"]["*"].match(regMatch) != undefined;
		// 	// .match(/[fv]/g) will return an array IF 'regMatch' is in the permission string (there's a match)
		// 	// if 'regMatch' does not exist in the string, it returns 'null' (yes, null, not undefined, so use loose "!=")

		// 	if (!allow) {
		// 		if (this.permissions["*"][imageId] !== undefined) // if already allow, skip
		// 			allow = this.permissions["*"][imageId].match(regMatch) != undefined;
		// 		else
		// 			allow = checkAll("*");
		// 	}
		// }

		// if (this.permissions[username] !== undefined) { // user's permissions
		// 	if (this.permissions[username]["*"] !== undefined) // applies to all images
		// 		allow = this.permissions[username]["*"].match(regMatch) != undefined;

		// 	if (!allow) {
		// 		if (this.permissions[username][imageId] !== undefined)
		// 			allow = this.permissions[username][imageId].match(regMatch) != undefined;
		// 		else
		// 			allow = checkAll(username);
		// 	}
		// }
		// return allow;
	}

	/**
	 * Checks if a user has full permissions on an image or an array of images
	 * @param {string} username - The user
	 * @param {string|string[]} imageId - Image(s) to check against 
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|bool[]} User has full permissions over an image.
	 */
	checkUserHasFullImageAccess(username, imageId, allMustMatch) {
		return this.checkUserHasImagePermission(username, imageId, /[f]/g, allMustMatch);
	}

	/**
	 * Checks if a user can download an image or an array of images (or if the image(s) is include in the zip download)
	 * @param {string} username - The user
	 * @param {string|string[]} imageId - Image(s) to check against 
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|bool[]} User can download (and is included in zips) an image or multiple.
	 */
	checkUserCanDownloadImage(username, imageId, allMustMatch) {
		return this.checkUserHasImagePermission(username, imageId, /[fd]/g, allMustMatch); // if they have the f then yeah
	}

	/**
	 * Checks if a user can view an image or an array of images
	 * @param {string} username - The user
	 * @param {string|string[]} imageId - Image(s) to check against
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|bool[]} User can view the image(s)
	 */
	checkUserCanViewImage(username, imageId, allMustMatch) {
		return this.checkUserHasImagePermission(username, imageId, /[fv]/g, allMustMatch);
	}


	/**
	 * Checks if a user can remove an image or an array of images from the album.
	 * Typically if the user can remove an image they can remove all, but you should check.
	 * Check by using the image id `*`, which stands for all images.
	 * 
	 * If a user has the remove permission for all images and removes all images, that deletes the shoot.
	 * @param {string} username - The user
	 * @param {string|string[]} imageId - Image(s) to check against
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|bool[]} User can remove an image or multiple.
	 */
	checkUserCanRemoveImage(username, imageId, allMustMatch) {
		return this.checkUserHasImagePermission(username, imageId, /[fr]/g, allMustMatch);
	}


	/**
	 * Checks if a user can modify the permissions for an image or an array of images from the album.
	 * If the user can manage ALL images, this is effectively the same as being able to share the shoot.
	 * 
	 * _Technically, if a user has access to one image in the shoot, then they have access to the shoot._
	 * _So yes, technically, yes one image with the share permission permits the user to share the album._
	 * @param {string} username - The user
	 * @param {string|string[]} imageId - Image(s) to check against
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|bool[]} User can share an image or multiple.
	 */
	checkUserCanShareImage(username, imageId, allMustMatch) {
		return this.checkUserHasImagePermission(username, imageId, /[fs]/g, allMustMatch);
	}

	/**
	 * Checks if a user can modify an image / images.
	 * @param {string} username - The user
	 * @param {string|string[]} imageId - Image(s) to check against
	 * @param {boolean} [allMustMatch = false] - If the imageId is `*`, this specifies that _all_ images must have the regMatch.
	 * @return {bool|bool[]} User can edit an image or multiple.
	 */
	checkUserCanEditImage(username, imageId, allMustMatch) {
		return this.checkUserHasImagePermission(username, imageId, /[fe]/g, allMustMatch);
	}


	/**
	 * Returns an array of images ids of images the user has access to view.
	 * @param {string} username - Username to generate this for
	 * @return {string[]} Image ids the user can view
	 */
	getViewableImages(username) {
		let images = [];
		for (let i = 0; i < this.images.length; i++) {
			let currentImageId = this.images[i];
			if (currentImageId == "*") // this does not count
				continue;

			if (this.checkUserCanViewImage(username, currentImageId)) {
				images.push(currentImageId);
			}
		}
		return images;
	}


	/**
	 * Gets the path where the images for this shoot are stored.
	 * @return {string}
	 */
	getImagesDirectory() {
		let directory = path.join(global.dataDirectory, "shoot-images", this.id);
		if (!fs.existsSync(directory))
			fs.mkdirSync(directory);

		return directory;
	}

	/**
	 * Moves an image from the upload directory to the shoot's image directory.
	 * Adds the image to the list of images.
	 * @param {string} imagePath - Current location of the image
	 * @param {string} name - Name of the image
	 * @return {string} The new image's id.
	 */
	addImage(imagePath, name) {
		if (typeof imagePath !== "string")
			throw new TypeError("imagePath expected string got " + (typeof imagePath).toString());
		if (typeof name !== "string")
			throw new TypeError("name expected string got " + (typeof name).toString());

		// Generate the different qualities
		// Delete image

		if (!fs.existsSync(imagePath))
			throw new Error("File not found");

		let imagesDirectory = this.getImagesDirectory();

		// This makes it so after all 5 are finished processing, we'll delete the uploaded image.
		let needsToComplete = 5;
		let completed = 0;
		function deleteImage() {
			if (completed>=needsToComplete) {
				fs.unlinkSync(imagePath);
			}
		}

		// this becomes the new image name
		let imageId = randomUUID();
		function processImage(data, width, quality, fileName) {
			sharp(data)
				.resize((typeof width === "number")? { width: width } : {})
				.webp({
					quality: (typeof quality === 'number')? quality : 80,
					effort: 2,
					preset: 'photo',
					force: true,
				})
				.toFile(path.join(imagesDirectory, fileName)).then(() => {
					completed += 1;
					deleteImage();
				});
		}

		sharp(imagePath)
			.toBuffer()
			.then(data => {
				processImage(data, undefined, 100, imageId + '.original.webp'); // high quality
				processImage(data, 2560, 90, imageId + '.high.webp'); // high quality
				processImage(data, 1920, 75, imageId + '.medium.webp'); // medium quality
				processImage(data, 1280, 75, imageId + '.low.webp'); // low quality
				processImage(data, 250, 95, imageId + '.thumbnail.webp'); // thumbnail quality
				deleteImage();
			});

		this.images.push(imageId);
		this.imageNames.set(imageId, name);
		return imageId;
	}

	/**
	 * Returns the original name of an image given the id.
	 * @param {string} imageId - The id of the image.
	 * @return {string}
	 */
	getImageName(imageId) {
		return this.imageNames.get(imageId) || imageId;
	}

	/**
	 * Sets the new name of an image given the id.
	 * @param {string} imageId - The id of the image.
	 * @param {string} newName - New name of this image.
	 * @return {void}
	 */
	setImageName(imageId, newName) {
		if (this.imageNames.has(imageId))
			this.imageNames.set(imageId, newName);
	}


	/**
	 * Returns the path to an image given the quality.
	 * @param {string} imageId - The id of the image.
	 * @param {("original"|"high"|"medium"|"low"|"thumbnail")} [quality = "high"] - Quality level of the image.
	 * @return {string} Path to the image or unknown (not accessible)
	 */
	getImagePath(imageId, quality) {
		if (typeof imageId !== "string")
			throw new TypeError("imageId expected string got " + (typeof imageId).toString());

		if (!this.images.includes(imageId))
			throw new Error("Unknown image id, not a part of this shoot.");

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

		return path.join(this.getImagesDirectory(), imageId + qualityExtension);
	}

	/**
	 * Deletes an image from this shoot
	 * @param {string} imageId - Image id to delete
	 * @return {void}
	 */
	deleteImage(imageId) {
		if (typeof imageId !== "string")
			throw new TypeError("imageId expected string got " + (typeof imageId).toString());

		if (!this.images.includes(imageId))
			return;

		let attempt = 1;
		let maxAttempts = 10;
		let attemptDelay = 250;
		function deleteFile(path) {
			try {
				if (fs.existsSync(path)) {
					fs.unlinkSync(path);
				}
				Focus.log.debug(`Successfully deleted ${imageId} (${path})`);
			} catch (e) {
				Focus.log.warn(`Failed to delete ${imageId} (${path}) (attempt ${attempt})`);

				if (e.code === "EBUSY" && attempt < maxAttempts) {
					attempt++;
					setTimeout(() => deleteFile(path), attemptDelay);
				} else {
					Focus.log.error(e);
				}
			}
		}


		let qualities = ["original","high","medium","low","thumbnail"];
		qualities.forEach((quality) => {
			try {
				Focus.log.debug(`Deleting ${imageId} (${quality}) from ${this.id}`);
				let filePath = this.getImagePath(imageId, quality);
				deleteFile(filePath);
			} catch (e) {
				Focus.log.error(e);
			}
		});

		this.images = this.images.filter((value) => value !== imageId);
		this.imageNames.delete(imageId);
	}



	/**
	 * @inheritdoc
	 */
	toJSON() {
		let jsonObject = super.toJSON();
		jsonObject["id"] = this.id;
		jsonObject["title"] = this.title;
		jsonObject["description"] = this.description;
		jsonObject["owner"] = this.owner;
		jsonObject["coverImage"] = this.coverImage;

		jsonObject["permissions"] = this.permissions;
		
		jsonObject["images"] = this.images;
		jsonObject["imageNames"] = Object.fromEntries(this.imageNames);
		
		return jsonObject;
	}

	/**
	 * @inheritdoc
	 */
	fromJSON(JSONObject) {
		if (typeof JSONObject !== "string" && typeof JSONObject !== "object")
			throw new TypeError("JSONObject expected string or object got " + (typeof JSONObject).toString());

		this.id = (typeof JSONObject.id === "string")? JSONObject.id : randomUUID();
		this.title = (typeof JSONObject.title === "string")? JSONObject.title : 'New album';
		this.description = (typeof JSONObject.description === "string")? JSONObject.description : '';
		this.owner = (typeof JSONObject.owner === "string")? JSONObject.owner : '';
		this.coverImage = (typeof JSONObject.coverImage === "string")? JSONObject.coverImage : undefined;

		this.permissions = (typeof JSONObject.permissions === "object")? JSONObject.permissions : {};
		
		this.images = (Array.isArray(JSONObject.images))? JSONObject.images : [];
		this.imageNames = (typeof JSONObject.imageNames === "object")? new Map(Object.entries(JSONObject.imageNames)) : new Map();

		// clean up the images
		let anyDeleted = false;
		this.images.forEach((imageId) => {
			if (!fs.existsSync(this.getImagePath(imageId, "original"))) {
				this.deleteImage(imageId);
				anyDeleted = true;
			}
		});
		if (anyDeleted)
			this.saveSync();
	}

	/**
	 * @inheritdoc
	 */
	delete() {
		try {
			let directory = this.getImagesDirectory();
			let attempt = 1;
			let maxAttempts = 10;
			let attemptDelay = 250;
			function deleteAllImages() {
				try {
					fs.rmSync(directory, {
						recursive: true,
						force: true
					});
					Focus.log.debug(`Successfully deleted all images for ${this.id}`);
				} catch (e) {
					Focus.log.warn(`Failed to delete the images for shoot ${this.id} (attempt ${attempt})`);

					if (e.code === "EBUSY" && attempt < maxAttempts) {
						attempt++;
						setTimeout(deleteAllImages, attemptDelay);
					} else {
						Focus.log.error(e);
					}
				}
			}
			deleteAllImages();
		} catch (e) {
			Focus.log.error(`Failed to delete the images for shoot ${this.id}`);
			Focus.log.error(e);
		}

		super.delete();
	}
}


module.exports = Shoot;