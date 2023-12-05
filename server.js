const express = require("express");
const app = express();
const blogData = require("./blog-service.js");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const stripJs = require("strip-js");
const authData = require("./auth-service.js");
const clientSessions = require("client-sessions");
const env = require("dotenv");
env.config();

// set our environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
  secure: true
});

app.use(clientSessions({
  cookieName: "session",
  secret: "myblog1",
  duration: 60 * 60 * 1000,
  activeDuration: 1000 * 60
}));

// displays res.local.session, which contains a 'user' object upon successful login
app.use(function(req, res, next) {
  res.locals.session = req.session;

  // console.log(`IN HERE: ${JSON.stringify((res.locals.session), null, 4)}`);

  next();
});

// req.session.user also displays values of 'user' object above
function ensureLogin(req, res, next) {
  console.log(`request object: ${JSON.stringify(req.session.user, null, 4)}`);


  if (!req.session.user) {
    res.redirect("/login");
  } else {
    next();
  }
}

const exphbs = require('express-handlebars');

app.use(function (req, res, next) {
  let route = req.path.substring(1);
  app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
  app.locals.viewingCategory = req.query.category;
  next();
});

app.engine('.hbs', exphbs.engine({
  extname: '.hbs',
  helpers: {
    navLink: function (url, options) {
      return '<li' +
        ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
        '><a href="' + url + '">' + options.fn(this) + '</a></li>';
    },
    equal: function (lvalue, rvalue, options) {
      if (arguments.length < 3)
        throw new Error("Handlebars Helper equal needs 2 parameters");
      if (lvalue != rvalue) {
        return options.inverse(this);
      } else {
        return options.fn(this);
      }
    },
    safeHTML: function (context) {
      return stripJs(context);
    },
    formatDate: function (dateObj) {
      let year = dateObj.getFullYear();
      let month = (dateObj.getMonth() + 1).toString();
      let day = dateObj.getDate().toString();
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
}));

app.set('view engine', '.hbs');

var HTTP_PORT = process.env.PORT || 8080;

function onHttpStart() {
  console.log("Express http server listening on: " + HTTP_PORT);
}

app.use(express.static("public"));

const upload = multer();

app.get("/", function (req, res) {
  res.redirect('/blog');
});

app.get("/about", function (req, res) {
  res.render('about');
});

app.get("/posts/add", ensureLogin, function (req, res) {
  blogData.getCategories()
    .then((data) => res.render("addPost", { categories: data }))
    .catch((err) => res.render("addPost", { categories: [] }));
});

app.get('/blog', async (req, res) => {
  let viewData = {};

  try {
    let posts = [];
    if (req.query.category) {
      posts = await blogData.getPublishedPostsByCategory(req.query.category);
    } else {
      posts = await blogData.getPublishedPosts();
    }
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    let post = posts[0];
    viewData.posts = posts;
    viewData.post = post;

  } catch (err) {
    viewData.message = "no results returned";
  }

  try {

    let categories = await blogData.getCategories();
    viewData.categories = categories;

  } catch (err) {
    viewData.categoriesMessage = "no results returned"
  }

  res.render("blog", { data: viewData })

});

app.get('/blog/:id', async (req, res) => {
  let viewData = {};
  try {

    let posts = [];
    if (req.query.category) {
      posts = await blogData.getPublishedPostsByCategory(req.query.category);
    } else {
      posts = await blogData.getPublishedPosts();
    }
    posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
    viewData.posts = posts;

  } catch (err) {
    viewData.message = "no results returned";
  }

  try {
    viewData.post = await blogData.getPostById(req.params.id);
  } catch (err) {
    viewData.message = "no results returned";
  }

  try {

    let categories = await blogData.getCategories();
    viewData.categories = categories;

  } catch (err) {
    viewData.categoriesMessage = "no results returned"
  }

  res.render("blog", { data: viewData })
});

app.get("/posts", ensureLogin, (req, res) => {
  // console.log(`*******IN /posts********`);

  if (req.query.category) {
    blogData.getPostsByCategory(req.query.category)
      .then((data) => {
        data.length > 0 ? res.render("posts", { posts: data }) : res.render("posts", { message: "no results returned" })
      })
      .catch((err) => {
        res.render("posts", { message: err })
      })
  }
  else if (req.query.minDate) {
    blogData.getPostsByMinDate(req.query.minDate)
      .then((data) => {
        data.length > 0 ? res.render("posts", { posts: data }) : res.render("posts", { message: "no results returned" })
      })
      .catch((err) => res.render("posts", { message: err }))
  }
  else {
    blogData.getAllPosts().then((data) => {
      data.length > 0 ? res.render("posts", { posts: data }) : res.render("posts", { message: "no results returned" });
    })
      .catch((err) => {
        res.render("posts", { message: err })
      })
  }
});

app.get("/post/:id", ensureLogin, (req, res) => {
  blogData.getPostById(req.params.id)
    .then((data) => {
      res.json(data)
    })
    .catch((err) => res.json({ "message": err }))
})

app.post("/posts/add", ensureLogin, upload.single("featureImage"), (req, res) => {
  if (req.file) {
    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    async function upload(req) {
      let result = await streamUpload(req);
      return result;
    }

    upload(req).then((uploaded) => {
      processPost(uploaded.url);
    });
  } else {
    processPost("");
  }

  function processPost(imageUrl) {
    req.body.featureImage = imageUrl;

    blogData.addPost(req.body)
      .then(() => {
        res.redirect("/posts");
      })
  }
});

app.get("/posts/delete/:id", ensureLogin, (req, res) => {
  blogData.deletePostById(req.params.id)
    .then(res.redirect("/posts"))
    .catch((err) => {
      res.status(500).send("Unable to Remove Post / Post not found")
    })
})

app.use(express.urlencoded({ extended: true }));

app.get("/categories", ensureLogin, (req, res) => {
  blogData.getCategories()
    .then((data) => {
      data.length > 0 ? res.render("categories", { categories: data }) : res.render("categories", { message: "no results returned" });
    }).catch((err) =>
      res.render("categories", { message: "no results returned" }))
});

app.get("/categories/add", ensureLogin, (req, res) => {
  res.render('addCategory');
});

app.post("/categories/add", ensureLogin, (req, res) => {
  blogData.addCategory(req.body)
    .then(() => {
      res.redirect("/categories");
    })
});

app.get("/categories/delete/:id", ensureLogin, (req, res) => {
  blogData.deleteCategoryById(req.params.id)
    .then(() => { res.redirect("/categories") })
    .catch((err) => {
      res.status(500).send("Unable to Remove Category / Category not found")
    })
})

app.get('/login', (req, res) => {
  res.render('login');
});

app.post("/login", (req, res) => {
  req.body.userAgent = req.get('User-Agent');
  authData.checkUser(req.body)
    .then(user => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory
      }
      res.redirect('/posts');
    })
    .catch(err => {
      console.log(err);
      res.render('login', {errorMessage: err, userName: req.body.userName})
    })
})

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  console.log(req.body);

  authData.registerUser(req.body)
    .then((data) => {
      console.log(data);
      res.render('register', {
        successMessage: "USER CREATED"
      })
    })
    .catch((err) => {
      console.log(err);
      res.render('register', {
        errorMessage: err,
        userName: req.body.userName
      })
    })
})

app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect('/');
});

app.get("/userHistory", ensureLogin, (req, res) => {
  res.render('userHistory');
})

app.use((req, res) => {
  res.render('404', {
    data: null,
    layout: 'main'
  })
});

blogData.initialize()
  .then(authData.initialize)
  .then(() => {
    app.listen(HTTP_PORT, onHttpStart);
  })
  .catch((err) => {
    console.log(err);
  })