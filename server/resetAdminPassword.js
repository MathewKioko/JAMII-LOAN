const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const resetAdminPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const newPassword = 'Admin123456'; // Change this to your desired password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const result = await User.updateOne(
      { email: 'admin@jamii.com' },
      { password: hashedPassword }
    );

    if (result.modifiedCount > 0) {
      console.log('Admin password reset successfully. New password:', newPassword);
    } else {
      console.log('No admin user found with email admin@jamii.com');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error resetting admin password:', error);
  }
};

resetAdminPassword();
