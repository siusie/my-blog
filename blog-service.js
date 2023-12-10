const Sequelize = require('sequelize');

// allows loading of environment variables from .env file
const env = require("dotenv");
env.config();

var sequelize = new Sequelize(process.env.POSTGRES_DB, process.env.POSTGRES_DB, process.env.POSTGRES_PASSWORD, {
    host: process.env.POSTGRES_HOST,
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
        ssl: { rejectUnauthorized: false }
    },
    query: { raw: true }
});

var Post = sequelize.define('Post', {
    body: Sequelize.TEXT,
    title: Sequelize.STRING,
    postDate: Sequelize.DATE,
    featureImage: Sequelize.STRING,
    published: Sequelize.BOOLEAN
});

var Category = sequelize.define('Category', {
    category: Sequelize.STRING
});

Post.belongsTo(Category, { foreignKey: 'category' });

module.exports.initialize = () => {
    return new Promise((resolve, reject) => {
        sequelize.sync()
            .then(resolve("POSTGRES CONNECTION HAS BEEN MADE SUCCESSFULLY!"))
            .catch((err) => {reject("POSTGRES CONNECTION FAILED: " + err)})
    })
}

module.exports.getAllPosts = () => {
    return new Promise((resolve, reject) => {
        Post.findAll()
            .then((data) => {
                resolve(data)
            })
            .catch((err) => {
                reject(err)
            })
    })
}

module.exports.getPublishedPosts = () => {
    return new Promise((resolve, reject) => {
        Post.findAll({
            where: {
                published: true
            }
        }).then((data) => {
            resolve(data);
        }).catch((err) => {
            reject(err)
        })
    })
}

module.exports.getPublishedPostsByCategory = (category) => {
    return new Promise((resolve, reject) => {
        Post.findAll({
            where: {
                published: true,
                category: category
            }
        }).then(resolve(Post.findAll({ where: { published: true, category: category } }))).catch((err) => {
            reject(err)
        })
    })
}

module.exports.getCategories = () => {
    return new Promise((resolve, reject) => {
        Category.findAll()
            .then((data) => {
                resolve(data);
            }).catch((err) => {
                reject(err);
            })
    })
}

module.exports.addPost = (postData) => {
    return new Promise((resolve, reject) => {
        postData.published = (postData.published) ? true : false;
        for (var i in postData) {
            if (postData[i] == "") postData[i] = null;
        }
        postData.postDate = new Date();
        Post.create(postData)
            .then(resolve(Post.findAll()))
            .catch((err) => { reject("Unable to create post"); })
    })
}

module.exports.getPostsByCategory = (category) => {
    return new Promise((resolve, reject) => {
        Post.findAll({
            where: {
                category: category
            }
        })
            .then((data) => {
                resolve(data);
            })
            .catch((err) => { 
                reject("No results returned");
             })
    })
}

module.exports.getPostsByMinDate = (minDateStr) => {
    return new Promise((resolve, reject) => {
        const { gte } = Sequelize.Op;
        Post.findAll({
            where: {
                postDate: {
                    [gte]: new Date(minDateStr)
                }
            }
        })
            .then((data) => {
                resolve(data);
            })
            .catch((err) => {
                reject("No results returned");
            })
    })
}

module.exports.getPostById = (id) => {
    return new Promise((resolve, reject) => {
        Post.findAll({
            where: {
                id: id
            }
        }).then((data) => {
            resolve(data[0]);
        }).catch((err) => {
            reject("No results returned");
        })
    })
}

module.exports.addCategory = (categoryData) => {
    return new Promise((resolve, reject) => {
        for (var i in categoryData) {
            if (categoryData[i] == "") {
                categoryData[i] = null;
            }
            Category.create(categoryData)
                .then(resolve(Category.findAll()))
                .catch((err) => { reject("Unable to create category") });
        }
    });
}

module.exports.deleteCategoryById = (id) => {
    return new Promise((resolve, reject) => {
        Category.destroy({
            where: {
                id: id
            }
        }).then((resolve("Category deleted")))
            .catch((err) => { reject("Unable to delete category") })
    })
}

module.exports.deletePostById = (id) => {
    return new Promise((resolve, reject) => {
        Post.destroy({
            where: {
                id: id
            }
        }).then((resolve("Post deleted")))
            .catch((err) => { reject("Unable to delete post") })
    })
}