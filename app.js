const fs = require('fs');
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const placesRoutes = require('./routes/places-routes');
const usersRoutes = require('./routes/users-routes');
const HttpError = require('./models/http-error');

const app = express();

app.use(bodyParser.json());

app.use('/uploads/images', express.static(path.join('uploads', 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Request-With, Content-Type, Accept, Authorization',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  next();
});

app.use('/api/places', placesRoutes);
app.use('/api/users', usersRoutes);

app.use((req, res, next) => {
  const error = new HttpError('Could not find this route', 404);
  throw error;
});

app.use((error, req, res, next) => {
  if (req.file) {
    console.log('req.file.path: ', req.file.path);
    fs.unlink(req.file.path, error => {
      console.log(error);
    });
  }

  if (res.headerSent) return next(error);

  res.status(error.code || 500);
  res.json({ message: error.message || 'An unknown error occurred!' });
});

// object added as 2nd argument for connect() as workaround to avoid error: User validation failed: _id: Error, expected `_id` to be unique. Value: `.....`
// occurs if user database in mongoDB has more than 1 user
// must use mongoose 5.11.3 and mongoose-unique-validator 2.0.3 until solution can be found
mongoose
  .connect(
    'mongodb+srv://mars:n3fRS3MdwkOxMti9@cluster0.db63l.mongodb.net/mern?retryWrites=true&w=majority',
    { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true },
  )
  .then(() => {
    app.listen(5000);
  })
  .catch();
