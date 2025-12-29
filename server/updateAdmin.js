const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const updateAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await User.updateOne(
      { email: 'admin@jamii.com' },
      { role: 'admin', creditScore: 1000, loanLimit: 1000000 }
    );

    if (result.modifiedCount > 0) {
      console.log('Admin user updated successfully');
    } else {
      console.log('No user found or already updated');
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error updating admin:', error);
  }
};

updateAdmin();
