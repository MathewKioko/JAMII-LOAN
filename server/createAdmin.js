const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Loan = require('./models/Loan');
const Notification = require('./models/Notification');
const Transaction = require('./models/Transaction');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear all collections
    await User.deleteMany({});
    await Loan.deleteMany({});
    await Notification.deleteMany({});
    await Transaction.deleteMany({});
    console.log('Database cleared');

    // Create new admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Delvis@2025', salt);

    const adminUser = new User({
      fullName: 'Mathew Kioko',
      email: 'mathewkioko86@gmail.com',
      password: hashedPassword,
      nationalId: '223544423',
      isCitizen: true,
      role: 'admin',
      creditScore: 1000,
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    console.log('Email: mathewkioko86@gmail.com');
    console.log('Password: Delvis@2025');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating admin:', error);
  }
};

createAdmin();
