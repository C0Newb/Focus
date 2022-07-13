'use strict';

let crypto = require('crypto');

let config = {
  digestAlgorithm: 'sha512',
  keyLen: 64,
  saltSize: 64,
  iterations: 15000
};

// Token: $Iterations$keySize$algorithm$Salt$Cipher

function hashPassword(password, callback) {
    crypto.randomBytes(config.saltSize, (err, salt) => {
        if (err)
            error(err);

        let combinedSalt = `${Buffer.from(salt).toString('base64')}`;
        crypto.pbkdf2(Buffer.from(password, 'utf8'), Buffer.from(combinedSalt, 'utf8'), config.iterations, config.keyLen, config.digestAlgorithm, (err, hash) => {
            if (err)
                error(err);
    
            let cipherText = new Buffer.from(hash).toString('base64');
            callback("$" + config.iterations + "$" + config.keyLen + "$" + config.digestAlgorithm + "$" + combinedSalt + "$" + cipherText);
        });
    });
}

var AABBCC;

function verifyPassword(token, checkPassword) {
  return new Promise((resolve, reject) => {
    let tokenS = token.split('$');
    let iterations = parseInt(tokenS[1]);
    let keySize = parseInt(tokenS[2]);
    let algorithm = tokenS[3];
    let salt = tokenS[4];
    let cipher = tokenS[5];


    crypto.pbkdf2(Buffer.from(checkPassword, 'utf8'), Buffer.from(salt, 'utf8'), iterations, keySize, algorithm, (err, verify) => {
      if(err){
        reject(err);
      } else {
        let isValidPassword = verify.toString('base64') === cipher;
        resolve(isValidPassword);
      }
    });
  });
}


module.exports = {
  hashPassword: hashPassword,
  verifyPassword: verifyPassword
};