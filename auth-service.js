var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const env = require("dotenv");
env.config();

var userSchema = new Schema({
  "userName": {
    type: String,
    unique: true
  },
  "password": String,
  "email": String,
  "loginHistory": [{
    dateTime: Date,
    userAgent: String
  }]
});

let User;

module.exports.initialize = () => {
  return new Promise((resolve, reject) => {
    let db = mongoose.createConnection(process.env.MONGO_URI_STRING);

    db.on('error', (err) => {
      reject(err);
    });
    db.once('open', () => {
      User = db.model("users", userSchema);
      console.log("connected to MongoDB");
      resolve();
    });
  });
};

module.exports.registerUser = (userData) => {
  return new Promise((resolve, reject) => {
    if (userData.password !== userData.password2) {
      reject("PASSWORDS DO NOT MATCH!");
    }
    else {
      bcrypt.hash(userData.password, 10).then((hash) => {
        userData.password = hash
        let newUser = new User(userData)
        newUser.save((err) => {
          if (err) {
            if (err.code == 11000) {
              reject("USERNAME TAKEN!");
            } else {
              reject("ERROR: " + err);
            }
          } else {
            console.log("success");
            resolve();
          }
        });
      }).catch((error) => {
        reject("ERROR WITH PASSWORD ENCRYPTION: " + error);
      })
    }
  })
}

module.exports.checkUser = (userData) => {
  return new Promise((resolve, reject) => {
    User.find({ userName: userData.userName })
      .exec()
      .then(users => {
        if (users.length == 0) reject("Unable to find user: " + userData.userName);
        bcrypt.compare(userData.password, users[0].password).then((result) => {
          if (result) {
            try {
              users[0].loginHistory.push({ dateTime: (new Date()).toString(), userAgent: userData.userAgent });
              User.update({ userName: users[0].userName },
                { $set: { loginHistory: users[0].loginHistory } })
              resolve(users[0]);
            }
            catch (err) { reject("There was an error verifying the user: " + err); }
          }
          else reject("Incorrect Password for user: " + userData.userName);
        });
      }).catch(err => {
        reject("Unable to find user: " + userData.userName);
      })
  })
}