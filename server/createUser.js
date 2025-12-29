const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const createUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: 'kethikioko2018@gmail.com' },
        { nationalId: '24792014' }
      ]
    });

    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Delvis@2025', salt);

    // Create new user
    const newUser = new User({
      fullName: 'EUNICE KITHUKU',
      email: 'kethikioko2018@gmail.com',
      password: hashedPassword,
      nationalId: '24792014',
      isCitizen: true,
      role: 'user',
      creditScore: 650,
      loanLimit: 25000,
    });

    await newUser.save();
    console.log('User created successfully');
    console.log('Name: EUNICE KITHUKU');
    console.log('Email: kethikioko2018@gmail.com');
    console.log('National ID: 24792014');
    console.log('Password: Delvis@2025');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating user:', error);
  }
};

createUser();
