const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const setupAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if user with name 'EUNICE KITHUKU' exists
    const existingUser = await User.findOne({ fullName: 'MATHEW KIOKO' });

    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log('User MATHEW KIOKO is already an admin.');
      } else {
        // Update role to admin
        existingUser.role = 'admin';
        await existingUser.save();
        console.log('Updated MATHEW KIOKO to admin role.');
      }
    } else {
      // Create new admin user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Delvis@2025', salt);

      const adminUser = new User({
        fullName: 'MATHEW KIOKO',
        email: 'mathewkioko86@gmail.com',
        password: hashedPassword,
        nationalId: '87654321', // Placeholder, adjust if needed
        isCitizen: true,
        role: 'admin',
        creditScore: 1000,
      });

      await adminUser.save();
      console.log('Admin user MATHEW KIOKO created successfully');
      console.log('Email: mathewkioko86@gmail.com');
      console.log('Password: Delvis@2025');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error setting up admin:', error);
  }
};

setupAdmin();