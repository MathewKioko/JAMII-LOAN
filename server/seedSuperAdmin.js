const bcrypt = require('bcryptjs');
const prisma = require('./config/prisma');

async function seedSuperAdmin() {
  try {
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!superAdminEmail || !superAdminPassword) {
      console.log('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in environment variables');
      return;
    }

    // Check if super admin already exists
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: superAdminEmail }
    });

    if (existingSuperAdmin) {
      console.log('Super admin already exists');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(superAdminPassword, salt);

    // Create super admin
    const superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        fullName: 'Super Administrator',
        isCitizen: true,
        creditScore: 1000,
        loanLimit: 10000000 // High limit for admin
      }
    });

    console.log('Super admin created successfully:', superAdmin.email);
  } catch (error) {
    console.error('Error seeding super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedSuperAdmin();
}

module.exports = seedSuperAdmin;
