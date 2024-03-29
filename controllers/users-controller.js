const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const uuid = require('uuid').v4;
const mongoose = require('mongoose');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const HttpError = require('../models/http-error');
const User = require('../models/user');

const bucketName = `${process.env.BUCKET_NAME}`;
const bucketRegion = `${process.env.BUCKET_REGION}`;
const accessKeyId = `${process.env.ACCESS_KEY}`;
const secretAccessKey = `${process.env.SECRET_ACCESS_KEY}`;

const s3 = new S3Client({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region: bucketRegion,
});

const getUsers = async (req, res, next) => {
  let users;

  try {
    users = await User.find({}, '-password');
  } catch (err) {
    const error = new HttpError(
      'Fetching users failed, please try again later.',
      500
    );
    return next(error);
  }

  const returnUsers = users.map((user) => user.toObject({ getters: true }));

  for (user of returnUsers) {
    user.image = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: user.image,
      }),
      { expiresIn: 3600 }
    );
  }

  // res.json({ users: users.map((user) => user.toObject({ getters: true })) });
  res.json({ users: returnUsers });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data', 422)
    );
  }

  const { name, email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'Signing up failed, please try again later',
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      'User exists already, please login instead',
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      'Could not create new user, please try again.',
      500
    );
    return next(error);
  }

  let fileType;
  let imageName;

  if (req.file) {
    fileType = req.file.mimetype.split('/')[1];
    imageName = `${uuid()}.${fileType}`;
  }

  const createdUser = new User({
    name,
    email,
    image: req.file ? imageName : null,
    password: hashedPassword,
    places: [],
  });

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdUser.save({ session: sess });

    if (req.file) {
      params = {
        Bucket: bucketName,
        Key: imageName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      await s3.send(new PutObjectCommand(params));
    }

    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError('Signup failed, please try again!', 500);

    return next(error);
  }

  let token;

  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    const error = new HttpError('Signup failed, please try again!', 500);
    return next(error);
  }

  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError('Login failed, please try again later', 500);
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      'Invalid credentials, could not log you in.',
      403
    );
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      'Could not log you in, please check credentials and try again.',
      500
    );
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      'Invalid credentials, could not log you in.',
      401
    );
    return next(error);
  }

  let token;

  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    const error = new HttpError('Login failed, please try again!', 500);
    return next(error);
  }

  // res.json({
  //   message: 'Logged in!...',
  //   user: existingUser.toObject({ getters: true }),
  // });
  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
